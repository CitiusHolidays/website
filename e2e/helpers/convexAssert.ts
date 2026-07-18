import { execFileSync } from "node:child_process";

function e2eSeedSecret() {
  const secret = process.env.E2E_SEED_SECRET;
  if (!secret) {
    throw new Error("E2E_SEED_SECRET is required for Convex backend assertions.");
  }
  return secret;
}

export function convexTravellerExists(args: { fullName: string; jobCardId?: string }) {
  const payload = JSON.stringify({
    fullName: args.fullName,
    jobCardId: args.jobCardId,
    secret: e2eSeedSecret(),
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
