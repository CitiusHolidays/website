import { execFileSync } from "node:child_process";

function requireE2eSeedConfiguration() {
  if (!process.env.E2E_SEED_SECRET) {
    throw new Error("E2E_SEED_SECRET is required for Convex backend assertions.");
  }
}

export function convexTravellerExists(args: { fullName: string; jobCardId?: string }) {
  requireE2eSeedConfiguration();
  const payload = JSON.stringify({
    fullName: args.fullName,
    jobCardId: args.jobCardId,
  });
  const output = execFileSync(
    "bunx",
    ["convex", "run", "crm/e2eAssertions:travellerExists", payload],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  return JSON.parse(output.trim()) as boolean;
}
