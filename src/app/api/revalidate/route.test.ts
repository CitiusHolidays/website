import { afterEach, describe, expect, test } from "bun:test";
import { handleSanityRevalidation } from "./route";

const originalSecret = process.env.SANITY_REVALIDATE_SECRET;

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.SANITY_REVALIDATE_SECRET;
  } else {
    process.env.SANITY_REVALIDATE_SECRET = originalSecret;
  }
});

function request(secret?: string, body: unknown = { tag: "gallery" }) {
  const headers = new Headers();
  if (secret !== undefined) {
    headers.set("x-sanity-revalidate-secret", secret);
  }
  return new Request("http://localhost/api/revalidate", {
    body: JSON.stringify(body),
    headers,
    method: "POST",
  });
}

describe("Sanity revalidation secret boundary", () => {
  test.each([
    ["absent", undefined],
    ["wrong length", "short"],
    ["wrong value", "0123456789abcdef"],
  ])("rejects an %s credential with the same non-leaking response", async (_label, secret) => {
    process.env.SANITY_REVALIDATE_SECRET = "fedcba9876543210";
    const revalidated: string[] = [];

    const response = await handleSanityRevalidation(request(secret), (tag) => {
      revalidated.push(tag);
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ message: "Unauthorized" });
    expect(revalidated).toEqual([]);
  });

  test("fails closed when the server secret is not configured", async () => {
    delete process.env.SANITY_REVALIDATE_SECRET;

    const response = await handleSanityRevalidation(request("anything"), () => {
      throw new Error("must not revalidate");
    });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ message: "Revalidation unavailable" });
  });

  test("revalidates an allowed tag for a valid secret", async () => {
    process.env.SANITY_REVALIDATE_SECRET = "fedcba9876543210";
    const revalidated: string[] = [];

    const response = await handleSanityRevalidation(
      request("fedcba9876543210", { tag: "spiritual" }),
      (tag) => {
        revalidated.push(tag);
      }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ revalidated: true, tag: "spiritual" });
    expect(revalidated).toEqual(["spiritual"]);
  });
});
