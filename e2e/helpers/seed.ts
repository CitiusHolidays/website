const TRAILING_SLASH_RE = /\/$/;

export async function seedE2eStaffProfiles() {
  if (!process.env.E2E_SEED_SECRET) {
    throw new Error("E2E_SEED_SECRET is required before E2E staff provisioning can run.");
  }

  try {
    const siteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL?.replace(TRAILING_SLASH_RE, "");
    if (!siteUrl) {
      throw new Error("NEXT_PUBLIC_CONVEX_SITE_URL is required for the E2E staff seed.");
    }
    const response = await fetch(`${siteUrl}/e2e/seed`, {
      headers: { "x-e2e-seed-secret": process.env.E2E_SEED_SECRET },
      method: "POST",
    });
    if (!response.ok) {
      throw new Error(`Convex E2E seed returned HTTP ${response.status}.`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Convex E2E staff seed failed; refusing to use existing deployment data. ${message}`,
      {
        cause: error,
      }
    );
  }
}
