// @ts-nocheck
/** Map `_id` → `id` for JSON shaped like Prisma documents. */
export function mapLean(doc) {
    if (doc == null)
        return null;
    const o = { ...doc };
    if (o._id != null && o.id === undefined)
        o.id = o._id;
    delete o.__v;
    return o;
}
export function mapLeanMany(docs) {
    return docs.map((d) => mapLean(d));
}
