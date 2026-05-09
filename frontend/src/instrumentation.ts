export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureMongoConnected } = await import("@gradapply/db");
    await ensureMongoConnected().catch(() => {});
  }

  const dsn =
    process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN ?? "";
  if (!dsn) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}
