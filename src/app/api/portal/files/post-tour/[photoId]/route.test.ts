import { afterAll, beforeAll, expect, mock, test } from "bun:test";
import { getFunctionName } from "convex/server";

let GET: typeof import("./route").GET;
let travelerGET: typeof import("../../traveler-feedback/[photoId]/route").GET;
const calls: string[] = [];
let signedIn = true;
beforeAll(async () => {
  mock.module("@/lib/auth-server", () => ({
    fetchAuthAction: (ref: Parameters<typeof getFunctionName>[0]) => {
      calls.push(getFunctionName(ref));
      if (!signedIn) {
        return Promise.reject({ data: "FORBIDDEN" });
      }
      return Promise.resolve({
        bytes: new Uint8Array([1, 2, 3]).buffer,
        fileName: "hotel.jpg",
        mimeType: "image/jpeg",
      });
    },
    getServerUser: () => Promise.resolve({ id: "synthetic-photo-reader" }),
    getToken: () => Promise.resolve(signedIn ? "synthetic-token" : null),
  }));
  ({ GET } = await import("./route"));
  ({ GET: travelerGET } = await import("../../traveler-feedback/[photoId]/route"));
});
afterAll(() => mock.restore());

test("over thirty thumbnails do not spend the manual download allowance", async () => {
  const results = await Promise.all(
    Array.from({ length: 35 }, (_, index) =>
      GET(new Request(`https://citius.test/api/portal/files/post-tour/p${index}?inline=1`), {
        params: Promise.resolve({ photoId: `p${index}` }),
      })
    )
  );
  expect(results.every((result) => result.status === 200)).toBe(true);
  expect(results[0].headers.get("Content-Disposition")).toStartWith("inline;");
  expect(results[0].headers.get("Cache-Control")).toContain("no-store");
  const manual = await GET(new Request("https://citius.test/api/portal/files/post-tour/p1"), {
    params: Promise.resolve({ photoId: "p1" }),
  });
  expect(manual.status).toBe(200);
  expect(
    calls.filter((call) => call === "crm/postTourFeedbackActions:getPhotoThumbnail")
  ).toHaveLength(35);
  expect(calls.filter((call) => call === "crm/postTourFeedbackActions:getPhotoFile")).toHaveLength(
    1
  );
});

test("traveler thumbnails retain authenticated private delivery", async () => {
  signedIn = true;
  const response = await travelerGET(
    new Request("https://citius.test/api/portal/files/traveler-feedback/p1?inline=1"),
    { params: Promise.resolve({ photoId: "p1" }) }
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Disposition")).toStartWith("inline;");
  expect(response.headers.get("Cache-Control")).toContain("no-store");
  expect(calls.at(-1)).toBe("crm/travelerFeedbackActions:getPhotoThumbnail");
});

test("inline photo errors preserve the private authentication boundary", async () => {
  signedIn = false;
  const response = await GET(
    new Request("https://citius.test/api/portal/files/post-tour/p1?inline=1"),
    { params: Promise.resolve({ photoId: "p1" }) }
  );
  expect(response.status).toBe(403);
  expect(response.headers.get("Cache-Control")).toContain("no-store");
});

test.each(["manager", "traveler"])(
  "%s thumbnails reject an anonymous malformed ID before backend dispatch",
  async (kind) => {
    signedIn = false;
    const before = calls.length;
    const handler = kind === "manager" ? GET : travelerGET;
    const folder = kind === "manager" ? "post-tour" : "traveler-feedback";
    const response = await handler(
      new Request(`https://citius.test/api/portal/files/${folder}/not-a-photo-id?inline=1`),
      { params: Promise.resolve({ photoId: "not-a-photo-id" }) }
    );
    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(calls).toHaveLength(before);
  }
);
