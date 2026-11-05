import { afterAll, beforeAll, beforeEach, expect, mock, test } from "bun:test";

let token: string | null = "synthetic-token";
let allowed = true;
let POST: typeof import("./route").POST;
let requests: Array<{ url: string; init?: RequestInit }> = [];
const originalFetch = globalThis.fetch;
const originalSite = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;

beforeAll(async () => {
  mock.module("@/lib/auth-server", () => ({
    fetchAuthQuery: () => Promise.resolve({ allowed }),
    getToken: () => Promise.resolve(token),
    resolveTrustedAppOrigin: () => "https://citius.test",
  }));
  ({ POST } = await import("./route"));
});
beforeEach(() => {
  token = "synthetic-token";
  allowed = true;
  requests = [];
  process.env.NEXT_PUBLIC_CONVEX_SITE_URL = "https://citius-upload.test";
  globalThis.fetch = Object.assign(
    mock((url: string | URL | Request, init?: RequestInit) => {
      requests.push({ init, url: String(url) });
      return Promise.resolve(Response.json({ id: "photo-1" }, { status: 201 }));
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

function request(body: BodyInit = "synthetic image bytes", headers = {}) {
  return new Request(
    "https://citius.test/api/portal/post-tour/photos?feedbackId=f1&fileName=hotel.jpg",
    {
      body,
      headers: { "Content-Type": "image/jpeg", Origin: "https://citius.test", ...headers },
      method: "POST",
    }
  );
}

test("rejects signed-out, nonstaff and cross-origin uploads before forwarding bytes", async () => {
  token = null;
  expect((await POST(request())).status).toBe(401);
  token = "synthetic-token";
  allowed = false;
  expect((await POST(request())).status).toBe(403);
  allowed = true;
  expect((await POST(request("bytes", { Origin: "https://other.test" }))).status).toBe(403);
  expect(requests).toHaveLength(0);
});

test("forwards only to the server-configured Convex origin with the authenticated token", async () => {
  const response = await POST(request());
  expect(response.status).toBe(201);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(requests).toHaveLength(1);
  expect(requests[0].url).toBe(
    "https://citius-upload.test/post-tour-feedback/photo?feedbackId=f1&fileName=hotel.jpg"
  );
  expect(requests[0].init?.headers).toEqual({
    Authorization: "Bearer synthetic-token",
    "Content-Type": "image/jpeg",
  });
  const body = requests[0].init?.body;
  if (!(body instanceof Blob)) {
    throw new Error("Expected photo Blob");
  }
  expect(await body.text()).toBe("synthetic image bytes");
});

test("rejects oversized and unsupported uploads without contacting storage", async () => {
  expect(
    (await POST(request("bytes", { "Content-Length": String(4 * 1024 * 1024 + 1) }))).status
  ).toBe(413);
  expect((await POST(request("bytes", { "Content-Type": "image/svg+xml" }))).status).toBe(400);
  expect(requests).toHaveLength(0);
});

test("accepts the configured browser origin behind an internal Next server URL", async () => {
  const internalRequest = new Request(
    "http://localhost:3010/api/portal/post-tour/photos?feedbackId=f1",
    {
      body: "image bytes",
      headers: { "Content-Type": "image/jpeg", Origin: "https://citius.test" },
      method: "POST",
    }
  );
  expect((await POST(internalRequest)).status).toBe(201);
  expect(requests).toHaveLength(1);
  expect((await POST(request("bytes", { Origin: "http://localhost:3010" }))).status).toBe(403);
  expect(requests).toHaveLength(1);
});
