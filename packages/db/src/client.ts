// @ts-nocheck
import mongoose, { type PipelineStage } from "mongoose";

import {
  Account,
  AppSetting,
  BillingPayment,
  ChatMessage,
  Connector,
  ContentVersion,
  Document,
  Folder,
  PaystackEventLog,
  ProfEmail,
  Profile,
  School,
  Session,
  SopVariant,
  StripeEventLog,
  User,
  VerificationToken,
} from "./models/index";

import { createDelegate } from "./prisma/delegate";
import { mapLean } from "./prisma/map-doc";
import { prismaWhereToMongo } from "./prisma/where";

const baseUser = createDelegate(User);
const baseSchool = createDelegate(School);
const baseDocument = createDelegate(Document);
const baseProfEmail = createDelegate(ProfEmail);
const baseChatMessage = createDelegate(ChatMessage);
const baseConnector = createDelegate(Connector);
const baseContentVersion = createDelegate(ContentVersion);
const baseProfile = createDelegate(Profile);
const baseSopVariant = createDelegate(SopVariant);
const baseAppSetting = createDelegate(AppSetting);
const baseBillingPayment = createDelegate(BillingPayment);
const baseVerificationToken = createDelegate(VerificationToken);
const baseStripeEventLog = createDelegate(StripeEventLog);
const basePaystackEventLog = createDelegate(PaystackEventLog);
const baseFolder = createDelegate(Folder);
const baseAccount = createDelegate(Account);
const baseSession = createDelegate(Session);

/** PrismaAdapter calls `include: { user: true }` on Account + Session. */
const account = {
  ...baseAccount,
  async findUnique(args: {
    where: Record<string, unknown>;
    select?: Record<string, boolean>;
    include?: Record<string, unknown>;
  }) {
    const inc = args.include as { user?: boolean } | undefined;
    if (!inc?.user) {
      return baseAccount.findUnique(args);
    }
    const filter = prismaWhereToMongo(args.where);
    const doc = await Account.findOne(filter).lean();
    if (!doc) return null;
    const mapped = mapLean(doc as Record<string, unknown>);
    const uid = doc.userId as string | undefined;
    if (uid) {
      const u = await User.findById(uid).lean();
      (mapped as Record<string, unknown>).user = u
        ? mapLean(u as Record<string, unknown>)
        : null;
    } else {
      (mapped as Record<string, unknown>).user = null;
    }
    return mapped;
  },
};

const session = {
  ...baseSession,
  async findUnique(args: {
    where: Record<string, unknown>;
    select?: Record<string, boolean>;
    include?: Record<string, unknown>;
  }) {
    const inc = args.include as { user?: boolean } | undefined;
    if (!inc?.user) {
      return baseSession.findUnique(args);
    }
    const filter = prismaWhereToMongo(args.where);
    const doc = await Session.findOne(filter).lean();
    if (!doc) return null;
    const mapped = mapLean(doc as Record<string, unknown>);
    const uid = doc.userId as string | undefined;
    if (uid) {
      const u = await User.findById(uid).lean();
      (mapped as Record<string, unknown>).user = u
        ? mapLean(u as Record<string, unknown>)
        : null;
    } else {
      (mapped as Record<string, unknown>).user = null;
    }
    return mapped;
  },
};

/** WebAuthn — not used by GradApply; stub satisfies PrismaAdapter shape. */
const authenticator = {
  async create() {
    throw new Error("Passkeys / WebAuthn are not enabled for this deployment.");
  },
  async findUnique() {
    return null;
  },
  async findMany() {
    return [];
  },
  async update() {
    throw new Error("Passkeys / WebAuthn are not enabled for this deployment.");
  },
};

async function userAggregate(args: {
  where?: Record<string, unknown>;
  _sum?: Record<string, boolean>;
  _count?: { _all?: boolean };
}): Promise<{ _sum: Record<string, number | null>; _count: { _all: number } }> {
  const match = args.where ? prismaWhereToMongo(args.where) : {};
  const group: Record<string, unknown> = { _id: null };
  if (args._sum) {
    for (const [k, v] of Object.entries(args._sum)) {
      if (v) group[k] = { $sum: `$${k}` };
    }
  }
  if (args._count?._all) {
    group.__cnt = { $sum: 1 };
  }
  const pipeline = [{ $match: match }, { $group: group }] as PipelineStage[];
  const [row] = await User.aggregate(pipeline);
  const _sum: Record<string, number | null> = {};
  if (args._sum) {
    for (const k of Object.keys(args._sum)) {
      _sum[k] =
        row && typeof row[k] === "number"
          ? row[k]
          : row?.[k] == null
            ? null
            : Number(row[k]);
    }
  }
  return {
    _sum,
    _count: { _all: row && args._count?._all ? Number(row.__cnt ?? 0) : 0 },
  };
}

async function billingAggregate(args: {
  where?: Record<string, unknown>;
  _sum?: Record<string, boolean>;
  _count?: { _all?: boolean };
}): Promise<{
  _sum: Record<string, number | null>;
  _count: { _all: number };
}> {
  const match = args.where ? prismaWhereToMongo(args.where) : {};
  const group: Record<string, unknown> = { _id: null };
  if (args._sum) {
    for (const [k, v] of Object.entries(args._sum)) {
      if (v) group[k] = { $sum: `$${k}` };
    }
  }
  if (args._count?._all) {
    group.__cnt = { $sum: 1 };
  }
  const pipeline = [{ $match: match }, { $group: group }] as PipelineStage[];
  const [row] = await BillingPayment.aggregate(pipeline);
  const _sum: Record<string, number | null> = {};
  if (row && args._sum) {
    for (const k of Object.keys(args._sum)) {
      _sum[k] = typeof row[k] === "number" ? row[k] : null;
    }
  }
  return {
    _sum,
    _count: { _all: row && args._count?._all ? Number(row.__cnt ?? 0) : 0 },
  };
}

async function documentAggregate(args: {
  where?: Record<string, unknown>;
  _sum?: Record<string, boolean>;
  _count?: { _all?: boolean };
}): Promise<{
  _sum: Record<string, number | null>;
  _count: { _all: number };
}> {
  const match = args.where ? prismaWhereToMongo(args.where) : {};
  const group: Record<string, unknown> = { _id: null };
  if (args._sum) {
    for (const [k, v] of Object.entries(args._sum)) {
      if (v) group[k] = { $sum: `$${k}` };
    }
  }
  if (args._count?._all) {
    group.__cnt = { $sum: 1 };
  }
  const pipeline = [{ $match: match }, { $group: group }] as PipelineStage[];
  const [row] = await Document.aggregate(pipeline);
  const _sum: Record<string, number | null> = {};
  if (row && args._sum) {
    for (const k of Object.keys(args._sum)) {
      _sum[k] = typeof row[k] === "number" ? row[k] : null;
    }
  }
  return {
    _sum,
    _count: { _all: row && args._count?._all ? Number(row.__cnt ?? 0) : 0 },
  };
}

async function documentGroupBy(args: {
  by: string[];
  where?: Record<string, unknown>;
  _count?: { _all?: boolean };
  _sum?: Record<string, boolean>;
}): Promise<
  Array<
    Record<string, unknown> & {
      _count: { _all: number };
      _sum?: { size?: number | null };
    }
  >
> {
  const match = args.where ? prismaWhereToMongo(args.where) : {};
  const idExpr =
    args.by.length === 1 ? `$${args.by[0]}` : args.by.map((b) => `$${b}`);
  const group: Record<string, unknown> = {
    _id: idExpr,
  };
  if (args._count?._all) {
    group.__c = { $sum: 1 };
  }
  if (args._sum) {
    for (const [k, v] of Object.entries(args._sum)) {
      if (v) group[`__sum_${k}`] = { $sum: `$${k}` };
    }
  }
  const rows = await Document.aggregate(
    [{ $match: match }, { $group: group }] as PipelineStage[],
  );
  return rows.map((row) => {
    const field = args.by[0]!;
    const out = {
      [field]: row._id,
      _count: { _all: Number(row.__c ?? 0) },
      _sum: {} as { size?: number | null },
    };
    if (args._sum) {
      for (const k of Object.keys(args._sum)) {
        const val = row[`__sum_${k}`];
        out._sum[k as "size"] =
          typeof val === "number" ? val : val == null ? null : Number(val);
      }
    }
    return out;
  });
}

async function chatGroupBy(args: {
  by: string[];
  where?: Record<string, unknown>;
  _count?: { _all?: boolean };
}): Promise<Array<Record<string, unknown> & { _count: { _all: number } }>> {
  const match = args.where ? prismaWhereToMongo(args.where) : {};
  const idExpr = args.by.length === 1 ? `$${args.by[0]}` : args.by.map((b) => `$${b}`);
  const rows = await ChatMessage.aggregate(
    [
      { $match: match },
      {
        $group: {
          _id: idExpr,
          __c: { $sum: 1 },
        },
      },
    ] as PipelineStage[],
  );
  return rows.map((row) => ({
    [args.by[0]!]: row._id,
    _count: { _all: Number(row.__c ?? 0) },
  }));
}

async function userGroupBy(args: {
  by: string[];
  where?: Record<string, unknown>;
  _count?: { _all?: boolean };
}): Promise<Array<Record<string, unknown> & { _count: { _all: number } }>> {
  const match = args.where ? prismaWhereToMongo(args.where) : {};
  const rows = await User.aggregate(
    [
      { $match: match },
      {
        $group: {
          _id: `$${args.by[0]}`,
          __c: { $sum: 1 },
        },
      },
    ] as PipelineStage[],
  );
  return rows.map((row) => ({
    [args.by[0]!]: row._id,
    _count: { _all: Number(row.__c ?? 0) },
  }));
}

export const prisma = {
  user: {
    ...baseUser,
    aggregate: userAggregate,
    groupBy: userGroupBy,
  },
  account,
  session,
  authenticator,
  school: baseSchool,
  document: {
    ...baseDocument,
    aggregate: documentAggregate,
    groupBy: documentGroupBy,
  },
  profEmail: baseProfEmail,
  chatMessage: {
    ...baseChatMessage,
    groupBy: chatGroupBy,
  },
  connector: baseConnector,
  contentVersion: baseContentVersion,
  profile: baseProfile,
  sopVariant: baseSopVariant,
  appSetting: {
    ...baseAppSetting,
    async upsert(args: {
      where: { key: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) {
      const key = args.where.key;
      const doc = await AppSetting.findOneAndUpdate(
        { _id: key },
        {
          $set: {
            ...(args.update as object),
            ...(args.create as object),
          },
        },
        { upsert: true, new: true },
      ).lean();
      return mapLean(doc as Record<string, unknown>);
    },
  },
  billingPayment: {
    ...baseBillingPayment,
    aggregate: billingAggregate,
  },
  verificationToken: baseVerificationToken,
  stripeEventLog: {
    ...baseStripeEventLog,
    async create(args: { data: { eventId: string } }) {
      await StripeEventLog.collection.insertOne({
        _id: args.data.eventId,
        createdAt: new Date(),
      } as never);
      return { eventId: args.data.eventId };
    },
    async deleteMany(args: { where: Record<string, unknown> }) {
      const filter = prismaWhereToMongo(args.where);
      const res = await StripeEventLog.deleteMany(filter);
      return { count: res.deletedCount };
    },
  },
  paystackEventLog: basePaystackEventLog,
  folder: baseFolder,

  async $transaction<T>(
    arg: Promise<unknown>[] | ((tx: unknown) => Promise<T>),
  ): Promise<T | unknown[]> {
    if (Array.isArray(arg)) {
      return Promise.all(arg) as Promise<unknown[]>;
    }
    return arg(prisma);
  },

  async $disconnect() {
    await mongoose.disconnect();
  },
};
