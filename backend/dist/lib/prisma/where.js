// @ts-nocheck
/** Best-effort Prisma `where` → MongoDB filter (covers GradApply query shapes). */
export function prismaWhereToMongo(where) {
    if (where == null || typeof where !== "object")
        return {};
    const w = where;
    if ("AND" in w && Array.isArray(w.AND)) {
        return { $and: w.AND.map((x) => prismaWhereToMongo(x)) };
    }
    if ("OR" in w && Array.isArray(w.OR)) {
        return { $or: w.OR.map((x) => prismaWhereToMongo(x)) };
    }
    if ("NOT" in w && w.NOT != null) {
        return { $nor: [prismaWhereToMongo(w.NOT)] };
    }
    const out = {};
    for (const [key, raw] of Object.entries(w)) {
        if (key === "id") {
            out._id = mapFieldValue(raw);
            continue;
        }
        if (key === "userId_provider") {
            const c = raw;
            if (c?.userId != null && c?.provider != null) {
                out.userId = c.userId;
                out.provider = c.provider;
            }
            continue;
        }
        out[key] = mapFieldValue(raw);
    }
    return out;
}
function mapFieldValue(raw) {
    if (raw == null)
        return raw;
    if (typeof raw !== "object" || Array.isArray(raw) || raw instanceof Date) {
        return raw;
    }
    const v = raw;
    if ("equals" in v)
        return v.equals;
    if ("not" in v) {
        const n = v.not;
        if (n === null)
            return { $ne: null };
        if (typeof n === "object" && n !== null && "equals" in n) {
            return { $ne: n.equals };
        }
        return { $ne: n };
    }
    if ("contains" in v && typeof v.contains === "string") {
        return { $regex: v.contains, $options: "i" };
    }
    if ("in" in v && Array.isArray(v.in))
        return { $in: v.in };
    if ("gte" in v || "lte" in v || "gt" in v || "lt" in v) {
        const r = {};
        if ("gte" in v)
            r.$gte = v.gte;
        if ("lte" in v)
            r.$lte = v.lte;
        if ("gt" in v)
            r.$gt = v.gt;
        if ("lt" in v)
            r.$lt = v.lt;
        return r;
    }
    return raw;
}
