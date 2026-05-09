import { AppSetting, BillingPayment, ChatMessage, Connector, ContentVersion, Document, Folder, PaystackEventLog, ProfEmail, Profile, School, SopVariant, StripeEventLog, User, VerificationToken, } from "@/models";
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
async function userAggregate(args) {
    const match = args.where ? prismaWhereToMongo(args.where) : {};
    const group = { _id: null };
    if (args._sum) {
        for (const [k, v] of Object.entries(args._sum)) {
            if (v)
                group[k] = { $sum: `$${k}` };
        }
    }
    if (args._count?._all) {
        group.__cnt = { $sum: 1 };
    }
    const pipeline = [{ $match: match }, { $group: group }];
    const [row] = await User.aggregate(pipeline);
    const _sum = {};
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
async function billingAggregate(args) {
    const match = args.where ? prismaWhereToMongo(args.where) : {};
    const group = { _id: null };
    if (args._sum) {
        for (const [k, v] of Object.entries(args._sum)) {
            if (v)
                group[k] = { $sum: `$${k}` };
        }
    }
    if (args._count?._all) {
        group.__cnt = { $sum: 1 };
    }
    const pipeline = [{ $match: match }, { $group: group }];
    const [row] = await BillingPayment.aggregate(pipeline);
    const _sum = {};
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
async function documentAggregate(args) {
    const match = args.where ? prismaWhereToMongo(args.where) : {};
    const group = { _id: null };
    if (args._sum) {
        for (const [k, v] of Object.entries(args._sum)) {
            if (v)
                group[k] = { $sum: `$${k}` };
        }
    }
    if (args._count?._all) {
        group.__cnt = { $sum: 1 };
    }
    const pipeline = [{ $match: match }, { $group: group }];
    const [row] = await Document.aggregate(pipeline);
    const _sum = {};
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
async function documentGroupBy(args) {
    const match = args.where ? prismaWhereToMongo(args.where) : {};
    const idExpr = args.by.length === 1 ? `$${args.by[0]}` : args.by.map((b) => `$${b}`);
    const group = {
        _id: idExpr,
    };
    if (args._count?._all) {
        group.__c = { $sum: 1 };
    }
    if (args._sum) {
        for (const [k, v] of Object.entries(args._sum)) {
            if (v)
                group[`__sum_${k}`] = { $sum: `$${k}` };
        }
    }
    const rows = await Document.aggregate([{ $match: match }, { $group: group }]);
    return rows.map((row) => {
        const field = args.by[0];
        const out = {
            [field]: row._id,
            _count: { _all: Number(row.__c ?? 0) },
            _sum: {},
        };
        if (args._sum) {
            for (const k of Object.keys(args._sum)) {
                const val = row[`__sum_${k}`];
                out._sum[k] =
                    typeof val === "number" ? val : val == null ? null : Number(val);
            }
        }
        return out;
    });
}
async function chatGroupBy(args) {
    const match = args.where ? prismaWhereToMongo(args.where) : {};
    const idExpr = args.by.length === 1 ? `$${args.by[0]}` : args.by.map((b) => `$${b}`);
    const rows = await ChatMessage.aggregate([
        { $match: match },
        {
            $group: {
                _id: idExpr,
                __c: { $sum: 1 },
            },
        },
    ]);
    return rows.map((row) => ({
        [args.by[0]]: row._id,
        _count: { _all: Number(row.__c ?? 0) },
    }));
}
async function userGroupBy(args) {
    const match = args.where ? prismaWhereToMongo(args.where) : {};
    const rows = await User.aggregate([
        { $match: match },
        {
            $group: {
                _id: `$${args.by[0]}`,
                __c: { $sum: 1 },
            },
        },
    ]);
    return rows.map((row) => ({
        [args.by[0]]: row._id,
        _count: { _all: Number(row.__c ?? 0) },
    }));
}
export const prisma = {
    user: {
        ...baseUser,
        aggregate: userAggregate,
        groupBy: userGroupBy,
    },
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
        async upsert(args) {
            const key = args.where.key;
            const doc = await AppSetting.findOneAndUpdate({ _id: key }, {
                $set: {
                    ...args.update,
                    ...args.create,
                },
            }, { upsert: true, new: true }).lean();
            return mapLean(doc);
        },
    },
    billingPayment: {
        ...baseBillingPayment,
        aggregate: billingAggregate,
    },
    verificationToken: baseVerificationToken,
    stripeEventLog: {
        ...baseStripeEventLog,
        async create(args) {
            await StripeEventLog.collection.insertOne({
                _id: args.data.eventId,
                createdAt: new Date(),
            });
            return { eventId: args.data.eventId };
        },
        async deleteMany(args) {
            const filter = prismaWhereToMongo(args.where);
            const res = await StripeEventLog.deleteMany(filter);
            return { count: res.deletedCount };
        },
    },
    paystackEventLog: basePaystackEventLog,
    folder: baseFolder,
    async $transaction(arg) {
        if (Array.isArray(arg)) {
            return Promise.all(arg);
        }
        return arg(prisma);
    },
};
