import "dotenv/config";
import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import { registerApiRoutes } from "./http/registerRoutes";
const app = express();
const PORT = Number(process.env.PORT ?? 8080);
app.use(cors({
    origin: process.env.CORS_ORIGIN?.split(",").map((s) => s.trim()) ?? true,
    credentials: true,
}));
registerApiRoutes(app);
app.get("/health", async (_req, res) => {
    const uri = process.env.MONGODB_URI?.trim();
    let okDb = false;
    let err;
    if (uri) {
        try {
            await mongoose.connection.db?.admin().command({ ping: 1 });
            okDb = true;
        }
        catch (e) {
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
async function connectDb() {
    const uri = process.env.MONGODB_URI?.trim();
    if (!uri) {
        console.warn("[backend] MONGODB_URI not set — database calls will fail.");
        return;
    }
    await mongoose.connect(uri);
    console.info("[backend] Mongoose connected");
}
async function main() {
    await connectDb().catch((e) => {
        console.error("[backend] MongoDB connection failed:", e);
    });
    app.listen(PORT, () => {
        console.info(`[backend] listening on http://localhost:${PORT}`);
    });
}
void main();
