import { Folder } from "@/models";
import { mapLean, mapLeanMany } from "./map-doc";
import { prismaWhereToMongo } from "./where";
function selectToString(select) {
    if (!select)
        return "";
    const keys = Object.keys(select).filter((k) => select[k]);
    if (!keys.length)
        return "";
    const mongoKeys = keys.map((k) => (k === "id" ? "_id" : k));
    if (!mongoKeys.includes("_id"))
        mongoKeys.unshift("_id");
    return mongoKeys.join(" ");
}
function sortFromOrderBy(orderBy) {
    if (!orderBy)
        return {};
    const list = Array.isArray(orderBy) ? orderBy : [orderBy];
    const out = {};
    for (const o of list) {
        for (const [k, dir] of Object.entries(o)) {
            const key = k === "id" ? "_id" : k;
            out[key] = dir === "desc" ? -1 : 1;
        }
    }
    return out;
}
function splitUpdateData(data) {
    const $set = {};
    const $inc = {};
    for (const [k, raw] of Object.entries(data)) {
        if (raw != null && typeof raw === "object" && !Array.isArray(raw)) {
            const v = raw;
            if ("increment" in v && typeof v.increment === "number") {
                $inc[k] = v.increment;
                continue;
            }
            if ("decrement" in v && typeof v.decrement === "number") {
                $inc[k] = -v.decrement;
                continue;
            }
        }
        $set[k] = raw;
    }
    return { $set, $inc };
}
export function createDelegate(Model) {
    return {
        async findUnique(args) {
            const filter = prismaWhereToMongo(args.where);
            let q = Model.findOne(filter);
            const s = selectToString(args.select);
            if (s)
                q = q.select(s);
            const doc = await q.lean();
            return mapLean(doc);
        },
        async findFirst(args) {
            const filter = prismaWhereToMongo(args.where);
            let q = Model.findOne(filter).sort(sortFromOrderBy(args.orderBy));
            const s = selectToString(args.select);
            if (s)
                q = q.select(s);
            const doc = await q.lean();
            return mapLean(doc);
        },
        async findMany(args) {
            const filter = args.where ? prismaWhereToMongo(args.where) : {};
            let q = Model.find(filter).sort(sortFromOrderBy(args.orderBy));
            if (typeof args.skip === "number")
                q = q.skip(args.skip);
            const s = selectToString(args.select);
            if (s)
                q = q.select(s);
            if (typeof args.take === "number")
                q = q.limit(args.take);
            let docs = await q.lean();
            docs = mapLeanMany(docs);
            const inc = args.include;
            if (Model.modelName === "Document" &&
                inc?.folder &&
                Array.isArray(docs)) {
                const folderIds = [
                    ...new Set(docs
                        .map((d) => d.folderId)
                        .filter(Boolean)),
                ];
                const folders = await Folder.find({
                    _id: { $in: folderIds },
                })
                    .select("_id name")
                    .lean();
                const byId = new Map(folders.map((f) => [String(f._id), f]));
                for (const d of docs) {
                    const fid = d.folderId;
                    if (fid && byId.has(fid)) {
                        const f = byId.get(fid);
                        d.folder = {
                            id: String(f._id),
                            name: f.name,
                        };
                    }
                }
            }
            return docs;
        },
        async create(args) {
            const doc = await Model.create(args.data);
            const lean = await Model.findById(doc._id).lean();
            return mapLean(lean);
        },
        async update(args) {
            const filter = prismaWhereToMongo(args.where);
            const { $set, $inc } = splitUpdateData(args.data);
            const update = {};
            if (Object.keys($set).length)
                update.$set = $set;
            if (Object.keys($inc).length)
                update.$inc = $inc;
            const doc = await Model.findOneAndUpdate(filter, update, {
                new: true,
            }).lean();
            return mapLean(doc);
        },
        async updateMany(args) {
            const filter = prismaWhereToMongo(args.where);
            const { $set, $inc } = splitUpdateData(args.data);
            const update = {};
            if (Object.keys($set).length)
                update.$set = $set;
            if (Object.keys($inc).length)
                update.$inc = $inc;
            const res = await Model.updateMany(filter, update);
            return { count: res.modifiedCount };
        },
        async delete(args) {
            const filter = prismaWhereToMongo(args.where);
            await Model.deleteOne(filter);
        },
        async deleteMany(args) {
            const filter = prismaWhereToMongo(args.where);
            const res = await Model.deleteMany(filter);
            return { count: res.deletedCount };
        },
        async count(args) {
            const filter = args?.where ? prismaWhereToMongo(args.where) : {};
            return Model.countDocuments(filter);
        },
        async upsert(args) {
            const filter = prismaWhereToMongo(args.where);
            const existing = await Model.findOne(filter).lean();
            if (existing) {
                const { $set, $inc } = splitUpdateData(args.update);
                const update = {};
                if (Object.keys($set).length)
                    update.$set = $set;
                if (Object.keys($inc).length)
                    update.$inc = $inc;
                const doc = await Model.findOneAndUpdate(filter, update, {
                    new: true,
                }).lean();
                return mapLean(doc);
            }
            await Model.create(args.create);
            const created = await Model.findOne(filter).lean();
            return mapLean(created);
        },
    };
}
