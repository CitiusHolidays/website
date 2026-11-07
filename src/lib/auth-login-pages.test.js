import { beforeEach, describe, expect, mock, test } from "bun:test";

let signedInUser = null;
const redirects = [];
mock.module("next/navigation", () => ({
  redirect: (href) => {
    redirects.push(href);
    throw new Error("NEXT_REDIRECT");
  },
}));
mock.module("next/server", () => ({ connection: () => undefined }));
mock.module("@/lib/auth-server", () => ({ getServerUser: () => signedInUser }));
mock.module("@/components/auth/AuthLoginPageClient", () => ({ default: () => null }));
mock.module("@/components/auth/AuthLoginLoadingShell", () => ({ default: () => null }));

const { createAuthLoginPage } = await import("./auth-login-pages");

async function renderBoundary(query) {
  const suspense = createAuthLoginPage({
    searchParams: Promise.resolve(query),
    variantId: "guest",
  });
  const boundary = suspense.props.children;
  return await boundary.type(boundary.props);
}

beforeEach(() => {
  signedInUser = null;
  redirects.length = 0;
});

describe("Guest sign-in return path", () => {
  test("Passes an allowed Account path to the sign-in form", async () => {
    const element = await renderBoundary({ returnTo: "/account?tab=settings#delete-account" });

    expect(element.props.returnTo).toBe("/account?tab=settings#delete-account");
  });

  test("Drops a return path that leaves the site or the Account", async () => {
    for (const returnTo of ["https://evil.example", "//evil.example", "/portal"]) {
      // biome-ignore lint/performance/noAwaitInLoops: each case renders the same boundary in turn.
      const element = await renderBoundary({ returnTo });
      expect(element.props.returnTo).toBeNull();
    }
  });

  test("Sends an already signed-in customer to the allowed path, otherwise to the Account", async () => {
    signedInUser = { id: "account_1" };

    await expect(
      renderBoundary({ returnTo: "/account?tab=settings#delete-account" })
    ).rejects.toThrow("NEXT_REDIRECT");
    await expect(renderBoundary({ returnTo: "//evil.example" })).rejects.toThrow("NEXT_REDIRECT");

    expect(redirects).toEqual(["/account?tab=settings#delete-account", "/account"]);
  });
});
