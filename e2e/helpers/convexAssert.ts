import { execFileSync } from "node:child_process";

const CONVEX_PREVIEW_SITE_SUFFIX = ".convex.site";
const SAFE_DEPLOYMENT_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*-\d+$/;

export function e2eConvexDeployment(env: Record<string, string | undefined> = process.env) {
  const target = env.E2E_PROVISIONING_TARGET?.trim();
  if (target === "preview") {
    const siteUrl = env.NEXT_PUBLIC_CONVEX_SITE_URL;
    if (!siteUrl) {
      throw new Error("NEXT_PUBLIC_CONVEX_SITE_URL is required for Preview Convex assertions.");
    }
    const { hostname } = new URL(siteUrl);
    if (!hostname.endsWith(CONVEX_PREVIEW_SITE_SUFFIX)) {
      throw new Error("Preview Convex assertions require an approved .convex.site origin.");
    }
    const deployment = hostname.slice(0, -CONVEX_PREVIEW_SITE_SUFFIX.length);
    if (!SAFE_DEPLOYMENT_NAME.test(deployment)) {
      throw new Error("Unable to derive a safe Convex Preview deployment name.");
    }
    return deployment;
  }

  if (target === "development") {
    const deployment = env.E2E_CONVEX_DEPLOYMENT?.trim();
    if (
      !(
        deployment === "local" ||
        deployment === "dev" ||
        SAFE_DEPLOYMENT_NAME.test(deployment ?? "")
      )
    ) {
      throw new Error("E2E_CONVEX_DEPLOYMENT must identify an explicit development deployment.");
    }
    return deployment;
  }

  throw new Error("Convex assertions require an explicit development or preview E2E target.");
}

function inlineTravellerQuery(args: { fullName: string; jobCardId?: string }) {
  const fullName = JSON.stringify(args.fullName);
  if (args.jobCardId) {
    const jobCardId = JSON.stringify(args.jobCardId);
    return `const rows = await ctx.db.query("travellers").withIndex("by_jobCardId", (q) => q.eq("jobCardId", ${jobCardId})).collect(); return rows.some((row) => row.fullName === ${fullName});`;
  }
  return `const rows = await ctx.db.query("travellers").withSearchIndex("search_list", (q) => q.search("listSearchText", ${fullName})).take(20); return rows.some((row) => row.fullName === ${fullName});`;
}

export function convexTravellerExists(args: { fullName: string; jobCardId?: string }) {
  const deployment = e2eConvexDeployment();
  const output = execFileSync(
    "bunx",
    ["convex", "run", "--deployment", deployment, "--inline-query", inlineTravellerQuery(args)],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  return JSON.parse(output.trim()) as boolean;
}
