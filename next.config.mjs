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
