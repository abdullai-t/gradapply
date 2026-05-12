import { withSentryConfig } from "@sentry/nextjs";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/tracker", destination: "/schools", permanent: false },
      {
        source: "/tracker/:path*",
        destination: "/schools/:path*",
        permanent: false,
      },
      { source: "/ai-coach", destination: "/assistant", permanent: false },
      {
        source: "/ai-coach/:path*",
        destination: "/assistant/:path*",
        permanent: false,
      },
    ];
  },
  /**
   * When `BACKEND_PROXY_URL` is set (e.g. `http://localhost:8080`), proxy these
   * `/api/*` paths to the Express server so LLM calls run there with keys in
   * `backend/.env` only. Same-origin for the browser → session cookies still work.
   * Add more entries if you add LLM routes under other prefixes.
   */
  async rewrites() {
    const backend = process.env.BACKEND_PROXY_URL?.trim().replace(/\/$/, "");
    if (!backend) return [];
    return [
      { source: "/api/chat", destination: `${backend}/api/chat` },
      { source: "/api/chat/:path*", destination: `${backend}/api/chat/:path*` },
      { source: "/api/ai/:path*", destination: `${backend}/api/ai/:path*` },
      { source: "/api/sop/:path*", destination: `${backend}/api/sop/:path*` },
      {
        source: "/api/prof-emails/:path*",
        destination: `${backend}/api/prof-emails/:path*`,
      },
      {
        source: "/api/content-versions/:path*",
        destination: `${backend}/api/content-versions/:path*`,
      },
      {
        source: "/api/schools/:path*",
        destination: `${backend}/api/schools/:path*`,
      },
      {
        source: "/api/documents/:path*",
        destination: `${backend}/api/documents/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
    ],
  },
};

/** Init is gated in `sentry.*.config.ts`; wrap stays enabled so client/server instrumentation matches Sentry’s Next.js docs. */
export default withSentryConfig(withBundleAnalyzer(nextConfig), {
  silent: true,
  sourcemaps: {
    disable: true,
  },
});
