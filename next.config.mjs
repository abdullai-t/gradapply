import path from "node:path";
import { fileURLToPath } from "node:url";

import { withSentryConfig } from "@sentry/nextjs";
import bundleAnalyzer from "@next/bundle-analyzer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const heavyDocExtractStub = "./src/lib/llm-doc-extract-heavy.stub.ts";
const firebaseAdminStub = "./src/lib/firebase/admin.stub.ts";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

/** Paths omitted from the server bundle on Cloudflare (Workers 10 MiB script limit). */
const cfTracingExcludes = [
  "./node_modules/.prisma/client/libquery_engine-*",
  "./node_modules/@prisma/client/runtime/query_engine_bg.mysql.wasm",
  "./node_modules/@prisma/client/runtime/query_engine_bg.sqlite.wasm",
  "./node_modules/pdf-parse/**",
  "./node_modules/pdfjs-dist/**",
  "./node_modules/mammoth/**",
  "./node_modules/jsdom/**",
  "./node_modules/@napi-rs/canvas/**",
  "./node_modules/next/dist/server/capsize-font-metrics.json",
  "./node_modules/firebase-admin/**",
  "./node_modules/jwks-rsa/**",
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages:
    process.env.CF_BUILD === "1"
      ? ["@prisma/client", ".prisma/client"]
      : [
          "@prisma/client",
          ".prisma/client",
          "pdf-parse",
          "@napi-rs/canvas",
          "mammoth",
        ],
  ...(process.env.CF_BUILD === "1"
    ? {
        output: "standalone",
        outputFileTracingExcludes: {
          "*": cfTracingExcludes,
        },
      }
    : {}),
  outputFileTracingIncludes: {
    "**/*": [
      "./node_modules/pg-cloudflare/dist/**",
      "./node_modules/pg-cloudflare/esm/**",
    ],
  },
  ...(process.env.CF_BUILD === "1"
    ? {
        turbopack: {
          root: __dirname,
          resolveAlias: {
            "@/lib/llm-doc-extract-heavy.server": heavyDocExtractStub,
            "@/lib/firebase/admin": firebaseAdminStub,
          },
        },
        webpack: (config) => {
          config.resolve.alias = {
            ...config.resolve.alias,
            "@/lib/firebase/admin": path.resolve(__dirname, "src/lib/firebase/admin.stub.ts"),
          };
          return config;
        },
      }
    : {}),
  experimental: {},
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
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/array/:path*",
        destination: "https://us-assets.i.posthog.com/array/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  skipTrailingSlashRedirect: true,
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
