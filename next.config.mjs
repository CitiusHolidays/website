const turbopackEnabled = Boolean(process.env.TURBOPACK);

/** @type {import('next').NextConfig} */
const nextConfig = {
  cacheComponents: true,
  // Next 16.3's app-shell prefetching avoids downloading request-time data
  // for every visible link while keeping cached route content reusable.
  partialPrefetching: true,
  env: {
    NEXT_PUBLIC_CONVEX_SITE_URL: process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
    NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
    ...(turbopackEnabled
      ? {
          // Let Turbopack evict persisted compiler data when memory pressure
          // makes it worthwhile, while retaining the warm filesystem cache.
          turbopackMemoryEviction: "auto",
          // Next 16.3's native compiler avoids the Babel transform on
          // Turbopack's default dev/build path while keeping React Compiler
          // enabled. Keep the webpack fallback path supported.
          turbopackRustReactCompiler: true,
        }
      : {}),
  },

  // Security headers
  async headers() {
    return [
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
