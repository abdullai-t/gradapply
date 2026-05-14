import { withSentryConfig } from "@sentry/nextjs";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  outputFileTracingIncludes: {
    "**/*": [
      "./node_modules/pg-cloudflare/dist/**",
      "./node_modules/pg-cloudflare/esm/**",
    ],
  },
  experimental: {
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
    // OpenNext on Cloudflare cannot run the default image optimizer (`/_next/image`).
    unoptimized: process.env.CF_BUILD === "1",
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

const analyzedConfig = withBundleAnalyzer(nextConfig);

/** Sentry’s webpack/turbopack hooks add significant server bundle weight; skip on CF builds. */
export default process.env.CF_BUILD
  ? analyzedConfig
  : withSentryConfig(analyzedConfig, {
      silent: true,
      sourcemaps: {
        disable: true,
      },
    });
