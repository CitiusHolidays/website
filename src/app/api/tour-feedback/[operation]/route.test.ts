import { afterAll, beforeAll, beforeEach, expect, mock, test } from "bun:test";

const originalFetch = globalThis.fetch;
const originalSite = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
const token = "a".repeat(43);
let POST: typeof import("./route").POST;
let calls: Array<{ url: string; init?: RequestInit }> = [];
beforeAll(async () => {
  mock.module("@/lib/auth-server", () => ({
    resolveTrustedAppOrigin: () => "https://citius.test",
  }));
  ({ POST } = await import("./route"));
});
beforeEach(() => {
  calls = [];
  process.env.NEXT_PUBLIC_CONVEX_SITE_URL = "https://upload.citius.test";
  globalThis.fetch = Object.assign(
    mock((url: string | URL | Request, init?: RequestInit) => {
      calls.push({ init, url: String(url) });
      return Promise.resolve(Response.json({ success: true }));
    }),
    { preconnect: originalFetch.preconnect }
  );
});
afterAll(() => {
  globalThis.fetch = originalFetch;
  if (originalSite === undefined) {
    delete process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  } else {
    process.env.NEXT_PUBLIC_CONVEX_SITE_URL = originalSite;
  }
  mock.restore();
});
function request(body: BodyInit = "{}", headers: Record<string, string> = {}) {
  return new Request("http://localhost:3010/api/tour-feedback/submit", {
    body,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Cookie: "private-cookie=never-forward",
      Origin: "https://citius.test",
      ...headers,
    },
    method: "POST",
  });
}
const params = (operation: string) => ({ params: Promise.resolve({ operation }) });
test("forwards a scoped bearer only to the configured feedback endpoint, with private responses", async () => {
  const response = await POST(request(), params("submit"));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(calls).toHaveLength(1);
  expect(calls[0].url).toBe("https://upload.citius.test/traveler-feedback/submit");
  const headers = new Headers(calls[0].init?.headers);
  expect(headers.get("authorization")).toBe(`Bearer ${token}`);
  expect(headers.get("cookie")).toBeNull();
  expect(calls[0].url).not.toContain(token);
});
test("rejects invalid links, cross-origin calls, unknown operations and oversized bodies before forwarding", async () => {
  expect((await POST(request("{}", { Authorization: "" }), params("form"))).status).toBe(410);
  expect(
    (await POST(request("{}", { Origin: "https://other.test" }), params("submit"))).status
  ).toBe(403);
  expect((await POST(request(), params("other"))).status).toBe(404);
  expect((await POST(request(new Uint8Array(64 * 1024 + 1)), params("submit"))).status).toBe(413);
  expect(calls).toHaveLength(0);
});
test("passes photo receipt and category without forwarding unrelated headers", async () => {
  const response = await POST(
    request("image", {
      "Content-Type": "image/jpeg",
      "X-Feedback-Category": "hotel",
      "X-Feedback-Response": "b".repeat(43),
      "X-File-Name": "hotel.jpg",
    }),
    params("photo")
  );
  expect(response.status).toBe(200);
  const headers = new Headers(calls[0].init?.headers);
  expect(headers.get("x-feedback-response")).toBe("b".repeat(43));
  expect(headers.get("x-feedback-category")).toBe("hotel");
  expect(headers.get("x-file-name")).toBe("hotel.jpg");
  expect(headers.get("origin")).toBeNull();
});

test("preserves valid multilingual answers across all six sections", async () => {
  const answer = "旅程很精彩".repeat(400);
  const body = JSON.stringify({
    comments: {
      food: answer,
      hotel: answer,
      improvements: answer,
      itinerary: answer,
      overall: answer,
      whatWentWell: answer,
    },
  });
  expect(new Blob([body]).size).toBeGreaterThan(32 * 1024);
  expect((await POST(request(body), params("submit"))).status).toBe(200);
  const forwarded = calls[0].init?.body;
  expect(forwarded instanceof Blob).toBe(true);
  if (forwarded instanceof Blob) {
    expect(await forwarded.text()).toBe(body);
  }
});
