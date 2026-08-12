const TRAILING_SLASH_RE = /\/$/;

export interface E2eSeedResult {
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

function e2eSiteUrl() {
  const siteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL?.replace(TRAILING_SLASH_RE, "");
  if (!siteUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_SITE_URL is required for E2E provisioning.");
  }
  return siteUrl;
}

export async function seedE2eStaffProfiles(
  runId: string,
  targetId: string
): Promise<E2eSeedResult> {
  if (!process.env.E2E_SEED_SECRET) {
    throw new Error("E2E_SEED_SECRET is required before E2E staff provisioning can run.");
  }

  try {
    const siteUrl = e2eSiteUrl();
    const response = await fetch(`${siteUrl}/e2e/seed`, {
      body: JSON.stringify({ runId, targetId }),
      headers: { "x-e2e-seed-secret": process.env.E2E_SEED_SECRET },
      method: "POST",
    });
    if (!response.ok) {
      throw new Error(`Convex E2E seed returned HTTP ${response.status}.`);
    }
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

export async function cleanupE2eRun(runId: string, targetId: string): Promise<E2eCleanupResult> {
  if (!process.env.E2E_SEED_SECRET) {
    throw new Error("E2E_SEED_SECRET is required before E2E cleanup can run.");
  }
  const response = await fetch(`${e2eSiteUrl()}/e2e/cleanup`, {
    body: JSON.stringify({ runId, targetId }),
    headers: { "x-e2e-seed-secret": process.env.E2E_SEED_SECRET },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`Convex E2E cleanup returned HTTP ${response.status}.`);
  }
  return (await response.json()) as E2eCleanupResult;
}
