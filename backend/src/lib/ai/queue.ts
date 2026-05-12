import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";

import { schoolDb } from "@/lib/school-db";

import { aiStream } from "./gateway";
import { SOP_REVIEW_SYSTEM, sopReviewPrompt } from "./prompts";

const QUEUE_NAME = "gradapply-ai-jobs";

export interface SOPReviewJobData {
  userId: string;
  /** School document id (GradApply tracks applications per school). */
  schoolId: string;
  sop: string;
  programContext?: string;
}

let sharedConnection: IORedis | null = null;
let aiQueueSingleton: Queue<SOPReviewJobData> | null = null;

function getRedisConnection(): IORedis | null {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;
  if (!sharedConnection) {
    sharedConnection = new IORedis(url, {
      maxRetriesPerRequest: null,
    });
  }
  return sharedConnection;
}

/** Returns null when `REDIS_URL` is not configured. */
export function getAiQueue(): Queue<SOPReviewJobData> | null {
  const connection = getRedisConnection();
  if (!connection) return null;
  if (!aiQueueSingleton) {
    aiQueueSingleton = new Queue<SOPReviewJobData>(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: "exponential", delay: 3000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });
  }
  return aiQueueSingleton;
}

let workerSingleton: Worker<SOPReviewJobData> | null = null;
let workerStarted = false;

/** BullMQ worker for async SOP review. Requires `REDIS_URL`. */
export function startAIWorker(): Worker<SOPReviewJobData> | null {
  const connection = getRedisConnection();
  if (!connection) {
    console.warn(
      "[ai-worker] REDIS_URL not set — gateway SOP review queue is disabled.",
    );
    return null;
  }
  if (workerStarted) return workerSingleton;
  workerStarted = true;

  const worker = new Worker<SOPReviewJobData>(
    QUEUE_NAME,
    async (job: Job<SOPReviewJobData>) => {
      const { userId, schoolId, sop, programContext } = job.data;

      const owned = await schoolDb.findOne({
        _id: schoolId,
        userId,
      }).lean();
      if (!owned) {
        throw new Error("School not found or access denied");
      }

      await schoolDb.updateOne(
        { _id: schoolId, userId },
        { $set: { "gatewaySopReview.status": "processing" } },
      );

      const stream = aiStream(
        "sop_review",
        SOP_REVIEW_SYSTEM,
        sopReviewPrompt(sop, programContext),
      );
      let feedback = "";
      for await (const chunk of stream.textStream) {
        feedback += chunk;
      }

      await schoolDb.updateOne(
        { _id: schoolId, userId },
        {
          $set: {
            "gatewaySopReview.status": "done",
            "gatewaySopReview.feedback": feedback,
            "gatewaySopReview.reviewedAt": new Date(),
            "gatewaySopReview.sopSnapshot": sop,
          },
        },
      );
    },
    { connection, concurrency: 3 },
  );

  worker.on("failed", async (job, err) => {
    if (!job?.data?.schoolId || !job?.data?.userId) return;
    console.error(`[ai-worker] job ${job.id} failed:`, err);
    await schoolDb.updateOne(
      { _id: job.data.schoolId, userId: job.data.userId },
      { $set: { "gatewaySopReview.status": "failed" } },
    );
  });

  worker.on("error", (err) => {
    console.error("[ai-worker] worker error:", err);
  });

  console.info(`[ai-worker] started (${QUEUE_NAME})`);
  workerSingleton = worker;
  return worker;
}
