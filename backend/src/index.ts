import "dotenv/config";
import cors from "cors";
import express from "express";
import mongoose from "mongoose";

import { ensureMongoConnected } from "@gradapply/db";

import {
  errorLoggingMiddleware,
  requestLoggingMiddleware,
} from "./http/request-logging";
import { registerApiRoutes } from "./http/registerRoutes";

const app = express();
const PORT = Number(process.env.PORT ?? 8080);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(",").map((s) => s.trim()) ?? true,
    credentials: true,
  }),
);

app.use(requestLoggingMiddleware());

registerApiRoutes(app);

app.get("/health", async (_req, res) => {
  const uri = process.env.MONGODB_URI?.trim();
  let okDb = false;
  let err: string | undefined;
  if (uri) {
    try {
      await mongoose.connection.db?.admin().command({ ping: 1 });
      okDb = true;
    } catch (e) {
      err = e instanceof Error ? e.message : "ping_failed";
    }
  }

  res.json({
    ok: true,
    service: "gradapply-backend",
    database: {
      configured: Boolean(uri),
      reachable: okDb,
      error: err,
    },
  });
});

app.use(errorLoggingMiddleware);

async function connectDb(): Promise<void> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    console.warn("[backend] MONGODB_URI not set — database calls will fail.");
    return;
  }
  await ensureMongoConnected();
  console.info("[backend] Mongoose connected");
}

async function main() {
  await connectDb().catch((e) => {
    console.error("[backend] MongoDB connection failed:", e);
  });

  app.listen(PORT, () => {
    console.info(`[backend] listening on http://localhost:${PORT}`);
    console.info(
      "[backend] HTTP access logs: lines starting with [backend] → / ← on each request.",
    );
    console.info(
      "[backend] If you never see those lines, nothing is calling this port (Next.js uses :3000 unless NEXT_PUBLIC_API_URL points here). Try: curl -s http://localhost:" +
        PORT +
        "/health",
    );
  });
}

void main();
