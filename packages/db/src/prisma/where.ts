// @ts-nocheck
/** Best-effort Prisma `where` → MongoDB filter (covers GradApply query shapes). */

export function prismaWhereToMongo(where: unknown): Record<string, unknown> {
  if (where == null || typeof where !== "object") return {};
  const w = where as Record<string, unknown>;
  if ("AND" in w && Array.isArray(w.AND)) {
    return { $and: w.AND.map((x) => prismaWhereToMongo(x)) };
  }
  if ("OR" in w && Array.isArray(w.OR)) {
    return { $or: w.OR.map((x) => prismaWhereToMongo(x)) };
  }
  if ("NOT" in w && w.NOT != null) {
    return { $nor: [prismaWhereToMongo(w.NOT)] };
  }

  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(w)) {
    if (key === "id") {
      out._id = mapFieldValue(raw);
      continue;
    }
    if (key === "userId_provider") {
      const c = raw as Record<string, unknown> | undefined;
      if (c?.userId != null && c?.provider != null) {
        out.userId = c.userId;
        out.provider = c.provider;
      }
      continue;
    }
    /** Auth.js / Prisma compound unique on Account */
    if (key === "provider_providerAccountId") {
      const c = raw as Record<string, unknown> | undefined;
      if (c?.provider != null && c?.providerAccountId != null) {
        out.provider = c.provider;
        out.providerAccountId = c.providerAccountId;
      }
      continue;
    }
    /** Auth.js / Prisma compound unique on VerificationToken */
    if (key === "identifier_token") {
      const c = raw as Record<string, unknown> | undefined;
      if (c?.identifier != null && c?.token != null) {
        out.identifier = c.identifier;
        out.token = c.token;
      }
      continue;
    }
    out[key] = mapFieldValue(raw);
  }
  return out;
}

function mapFieldValue(raw: unknown): unknown {
  if (raw == null) return raw;
  if (typeof raw !== "object" || Array.isArray(raw) || raw instanceof Date) {
    return raw;
  }
  const v = raw as Record<string, unknown>;
  if ("equals" in v) return v.equals;
  if ("not" in v) {
    const n = v.not;
    if (n === null) return { $ne: null };
    if (typeof n === "object" && n !== null && "equals" in (n as object)) {
      return { $ne: (n as { equals: unknown }).equals };
    }
    return { $ne: n };
  }
  if ("contains" in v && typeof v.contains === "string") {
    return { $regex: v.contains, $options: "i" };
  }
  if ("in" in v && Array.isArray(v.in)) return { $in: v.in };
  if ("gte" in v || "lte" in v || "gt" in v || "lt" in v) {
    const r: Record<string, unknown> = {};
    if ("gte" in v) r.$gte = v.gte;
    if ("lte" in v) r.$lte = v.lte;
    if ("gt" in v) r.$gt = v.gt;
    if ("lt" in v) r.$lt = v.lt;
    return r;
  }
  return raw;
}
