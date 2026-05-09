import mongoose from "mongoose";

/** Ensure Mongoose is connected (safe to call multiple times). */
export async function ensureMongoConnected(): Promise<void> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) return;
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(uri);
}
