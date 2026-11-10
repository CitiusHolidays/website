import { spawnSync } from "node:child_process";

// `next build` with public values only, so CI can prove every route compiles and prerenders
// under Cache Components without credentials. The Convex URLs are placeholders that nothing
// reaches during the build; the Sanity project id is public (it is in every image URL).
const LOCAL_ORIGIN = "http://localhost:3000";

export const PRERENDER_CHECK_ENV = {
  BETTER_AUTH_URL: LOCAL_ORIGIN,
  NEXT_PUBLIC_APP_URL: LOCAL_ORIGIN,
  NEXT_PUBLIC_CONVEX_SITE_URL: "https://prerender-check.convex.site",
  NEXT_PUBLIC_CONVEX_URL: "https://prerender-check.convex.cloud",
  NEXT_PUBLIC_SANITY_DATASET: "production",
  NEXT_PUBLIC_SANITY_PROJECT_ID: "469zdu2i",
  NEXT_PUBLIC_SITE_URL: LOCAL_ORIGIN,
  NEXT_TELEMETRY_DISABLED: "1",
  SITE_URL: LOCAL_ORIGIN,
} as const;

if (import.meta.main) {
  const result = spawnSync("bunx", ["next", "build"], {
    env: { ...process.env, ...PRERENDER_CHECK_ENV },
    stdio: "inherit",
  });
  process.exitCode = result.error ? 1 : (result.status ?? 1);
}
