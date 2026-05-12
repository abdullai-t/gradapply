import { School } from "@gradapply/db";

/**
 * `@gradapply/db` re-exports Mongoose models; in this monorepo TypeScript can see
 * incompatible `mongoose` declaration merges and treat `findOne`/`updateOne` as an
 * uncalled union. Runtime behavior is correct — narrow at the boundary.
 */
export const schoolDb = School as import("mongoose").Model<
  Record<string, unknown>
>;
