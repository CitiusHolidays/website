import type { ApprovedE2eTarget } from "../../config/e2e/target-identity";

const TRAILING_SLASH_RE = /\/$/;

export interface E2eSeedResult {
  customerFixture: {
    destination: string;
    email: string;
    name: string;
    queryCode: string;
  };
  run: {
    runId: string;
    target: "development" | "preview";
    targetId: string;
  };
  workflowFixtures: {
    cementClientName: string;
    clientName: string;
    nonCementClientName: string;
    proposalId: string;
    queryCode: string;
    queryId: string;
  };
}

function e2eSiteUrl(approved: ApprovedE2eTarget) {
  const siteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL?.replace(TRAILING_SLASH_RE, "");
  if (!siteUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_SITE_URL is required for E2E provisioning.");
  }
  if (new URL(siteUrl).origin !== approved.convexSiteOrigin) {
    throw new Error("NEXT_PUBLIC_CONVEX_SITE_URL does not match the verified E2E target");
  }
  return approved.convexSiteOrigin;
}

export async function seedE2eStaffProfiles(
  runId: string,
  approved: ApprovedE2eTarget
): Promise<E2eSeedResult> {
  if (!process.env.E2E_SEED_SECRET) {
    throw new Error("E2E_SEED_SECRET is required before E2E staff provisioning can run.");
  }

  try {
    const siteUrl = e2eSiteUrl(approved);
    const response = await fetch(`${siteUrl}/e2e/seed`, {
      body: JSON.stringify({ runId, targetId: approved.id }),
      headers: { "x-e2e-seed-secret": process.env.E2E_SEED_SECRET },
      method: "POST",
    });
    if (!response.ok) {
      throw new Error(`Convex E2E seed returned HTTP ${response.status}.`);
    }
    // SAFETY: the authenticated E2E provisioning endpoint owns and returns E2eSeedResult.
    return (await response.json()) as E2eSeedResult;
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

export interface E2eCleanupResult {
  complete: boolean;
  deleted: number;
  residualCount: number;
  runId: string;
}

export async function cleanupE2eRun(
  runId: string,
  approved: ApprovedE2eTarget,
  fetchCleanup: typeof fetch = fetch
): Promise<E2eCleanupResult> {
  const seedSecret = process.env.E2E_SEED_SECRET;
  if (!seedSecret) {
    throw new Error("E2E_SEED_SECRET is required before E2E cleanup can run.");
  }
  const requestCleanup = async (attempt: number): Promise<E2eCleanupResult> => {
    const response = await fetchCleanup(`${e2eSiteUrl(approved)}/e2e/cleanup`, {
      body: JSON.stringify({ runId, targetId: approved.id }),
      headers: { "x-e2e-seed-secret": seedSecret },
      method: "POST",
    });
    if (response.status === 503 && attempt < 3) {
      return requestCleanup(attempt + 1);
    }
    if (!response.ok) {
      throw new Error(`Convex E2E cleanup returned HTTP ${response.status}.`);
    }
    // SAFETY: the authenticated E2E cleanup endpoint owns and returns E2eCleanupResult.
    return (await response.json()) as E2eCleanupResult;
  };
  return await requestCleanup(1);
}
