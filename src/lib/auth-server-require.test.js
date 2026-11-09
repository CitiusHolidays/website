import { beforeEach, describe, expect, mock, test } from "bun:test";

const redirects = [];

mock.module("next/navigation", () => ({
  redirect: (url) => {
    redirects.push(url);
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

const { requireAuth } = await import("./auth-server");

const signedOut = { token: null };

async function redirectFor(callbackUrl, returnPath) {
  await expect(requireAuth(callbackUrl, signedOut, { returnPath })).rejects.toThrow(
    "NEXT_REDIRECT"
  );
  return redirects.at(-1);
}

beforeEach(() => {
  redirects.length = 0;
});

describe("Signed-out deep links", () => {
  test("Carry the requested Staff Workspace page to staff sign-in", async () => {
    expect(await redirectFor("/portal", "/portal/job-cards/abc?tab=tickets")).toBe(
      `/auth/connect?returnTo=${encodeURIComponent("/portal/job-cards/abc?tab=tickets")}`
    );
  });

  test("Carry the requested Account tab to guest sign-in", async () => {
    expect(await redirectFor("/account", "/account?tab=settings")).toBe(
      `/auth/guest?returnTo=${encodeURIComponent("/account?tab=settings")}`
    );
  });

  test("Drop a return path outside the sign-in page's area", async () => {
    expect(await redirectFor("/portal", "/account")).toBe("/auth/connect");
    expect(await redirectFor("/portal", "//evil.example/portal")).toBe("/auth/connect");
    expect(await redirectFor("/account", "/portal")).toBe("/auth/guest");
    expect(await redirectFor("/vendor", undefined)).toBe("/auth/vendor");
  });
});
