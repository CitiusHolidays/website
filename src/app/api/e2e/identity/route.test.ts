import { afterEach, describe, expect, test } from "bun:test";
import { GET } from "./route";

const original = {
  E2E_PROVISIONING_TARGET: process.env.E2E_PROVISIONING_TARGET,
  E2E_TARGET_ID: process.env.E2E_TARGET_ID,
  NEXT_PUBLIC_CONVEX_SITE_URL: process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
  VERCEL_ENV: process.env.VERCEL_ENV,
  VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA,
};

afterEach(() => {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("frontend E2E target identity", () => {
  test("returns only the non-secret approved runtime identity", async () => {
    process.env.E2E_PROVISIONING_TARGET = "preview";
    process.env.E2E_TARGET_ID = "preview-branch-123";
    process.env.NEXT_PUBLIC_CONVEX_SITE_URL = "https://fixture-preview.convex.site/path";
    process.env.VERCEL_GIT_COMMIT_SHA = "a8052f3a0f1a211c110a69decdaf5fc34358a957";
    delete process.env.VERCEL_ENV;
    const response = await GET(new Request("https://preview.example.test/api/e2e/identity"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({
      convexSiteOrigin: "https://fixture-preview.convex.site",
      id: "preview-branch-123",
      revision: "a8052f3a0f1a211c110a69decdaf5fc34358a957",
      target: "preview",
    });
  });

  test("is undiscoverable in Production or without exact classification", async () => {
    process.env.E2E_PROVISIONING_TARGET = "preview";
    process.env.E2E_TARGET_ID = "preview-branch-123";
    process.env.NEXT_PUBLIC_CONVEX_SITE_URL = "https://fixture-preview.convex.site";
    process.env.VERCEL_GIT_COMMIT_SHA = "a8052f3a0f1a211c110a69decdaf5fc34358a957";
    process.env.VERCEL_ENV = "production";
    expect((await GET(new Request("https://preview.example.test/api/e2e/identity"))).status).toBe(
      404
    );
    delete process.env.VERCEL_ENV;
    process.env.E2E_TARGET_ID = "production-live";
    expect((await GET(new Request("https://preview.example.test/api/e2e/identity"))).status).toBe(
      404
    );
    process.env.E2E_TARGET_ID = "preview-branch-123";
    process.env.VERCEL_GIT_COMMIT_SHA = "not-a-revision";
    expect((await GET(new Request("https://preview.example.test/api/e2e/identity"))).status).toBe(
      404
    );
  });
});
