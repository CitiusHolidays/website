import { execFileSync } from "node:child_process";

export function seedE2eStaffProfiles() {
  if (!process.env.E2E_SEED_SECRET) {
    console.warn(
      "E2E_SEED_SECRET unset — skipping Convex E2E staff seed (run e2eSeedActions manually)."
    );
    return;
  }

  try {
    execFileSync("bunx", ["convex", "run", "crm/e2eSeedActions:run", "{}"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `Convex E2E staff seed failed — continuing with existing deployment data. ${message}`
    );
  }
}
