import { execFileSync } from "node:child_process";

const EXACT_REVISION_PATTERN = /^[a-f0-9]{40}$/;

export function resolveBuildRevision(env = process.env) {
  const configured = env.CITIUS_BUILD_REVISION?.trim() || env.VERCEL_GIT_COMMIT_SHA?.trim();
  const revision =
    configured || execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  if (!EXACT_REVISION_PATTERN.test(revision)) {
    throw new Error("Next build requires an exact 40-character Git revision");
  }
  return revision;
}

/** @type {import('next').NextConfig} */
// biome-ignore assist/source/useSortedKeys: Cache Components and Partial Prefetching stay adjacent for adoption review.
const nextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  env: {
    NEXT_PUBLIC_CONVEX_SITE_URL: process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
    NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  generateBuildId: async () => resolveBuildRevision(),

  // Security headers
  async headers() {
    return [
      // Authenticated and session-aware routes must never be stored by a CDN
      // or replayed across users. Keep this explicit even when Cache Components
      // is enabled; request-time rendering and response caching are separate
      // controls at the hosting edge.
      {
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, max-age=0, must-revalidate",
          },
          {
            key: "Vary",
            value: "Cookie",
          },
        ],
        source: "/portal/:path*",
      },
      {
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, max-age=0, must-revalidate",
          },
          {
            key: "Vary",
            value: "Cookie",
          },
        ],
        source: "/account/:path*",
      },
      {
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, max-age=0, must-revalidate",
          },
          {
            key: "Vary",
            value: "Cookie",
          },
        ],
        source: "/auth/:path*",
      },
      {
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, max-age=0, must-revalidate",
          },
          {
            key: "Vary",
            value: "Cookie",
          },
        ],
        source: "/api/auth/:path*",
      },
      {
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
        source: "/gallery/:path*",
      },
      {
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
        source: "/noise.svg",
      },
      {
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
        source: "/hero.mp4",
      },
      {
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
        source: "/hero-sm.mp4",
      },
      {
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
        source: "/(.*)",
      },
      {
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
        ],
        source: "/api/(.*)",
      },
    ];
  },
  images: {
    // Omitted `quality` is handled as 75 internally, then snapped to the nearest
    // value below — excluding 75 makes the effective default ~85 site-wide.
    qualities: [85, 90, 95, 100],
    remotePatterns: [
      {
        hostname: "cdn.sanity.io",
        protocol: "https",
      },
      {
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
        protocol: "https",
      },
    ],
  },
  reactCompiler: true,
};

export default nextConfig;
