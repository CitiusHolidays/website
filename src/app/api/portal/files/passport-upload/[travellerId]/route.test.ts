import { describe, expect, test } from "bun:test";
import type { FunctionReference } from "convex/server";
import { getFunctionName } from "convex/server";
import { handlePassportUpload } from "./route";

function uploadRequest() {
  const form = new FormData();
  form.set("file", new File(["%PDF-1.7\n%%EOF"], "passport.pdf", { type: "application/pdf" }));
  form.set("expiryDate", "2030-01-01");
  return new Request("http://citius.test/api/portal/files/passport-upload/traveller-1", {
    body: form,
    method: "POST",
  });
}

interface CapturedPassportUploadArgs {
  serverSecret?: string;
  tempStorageId?: string;
  travellerId?: string;
  uploadToken?: string;
}

interface CapturedPassportUploadCall {
  args: CapturedPassportUploadArgs;
  name: string;
}

describe("passport upload same-origin edge", () => {
  test("keeps the provider storage identity server-side", async () => {
    const calls: CapturedPassportUploadCall[] = [];
    const response = await handlePassportUpload(uploadRequest(), "traveller-1", {
      fetchAuthActionImpl: (
        reference: FunctionReference<"action">,
        args: CapturedPassportUploadArgs
      ) => {
        const name = getFunctionName(reference);
        calls.push({ args, name });
        if (name === "crm/passportActions:generateUploadUrl") {
          return Promise.resolve({
            expiresAt: Date.now() + 60_000,
            uploadToken: "opaque-upload-ticket",
            uploadUrl: "https://storage.example/upload",
          });
        }
        if (name === "crm/passportActions:encryptAndStorePassport") {
          return Promise.resolve({ success: true });
        }
        return Promise.reject(new Error(`Unexpected action: ${name}`));
      },
      getTokenImpl: () => Promise.resolve("staff-token"),
      serverSecret: "server-upload-secret",
      uploadFetchImpl: () =>
        Promise.resolve(Response.json({ storageId: "storage-private-quarantine" })),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(calls).toHaveLength(2);
    expect(calls[1]).toMatchObject({
      args: {
        serverSecret: "server-upload-secret",
        tempStorageId: "storage-private-quarantine",
        travellerId: "traveller-1",
        uploadToken: "opaque-upload-ticket",
      },
      name: "crm/passportActions:encryptAndStorePassport",
    });
  });

  test("hands an uploaded quarantine blob to durable cleanup when processing fails", async () => {
    const calls: string[] = [];
    const response = await handlePassportUpload(uploadRequest(), "traveller-1", {
      fetchAuthActionImpl: (reference: FunctionReference<"action">) => {
        const name = getFunctionName(reference);
        calls.push(name);
        if (name === "crm/passportActions:generateUploadUrl") {
          return Promise.resolve({
            expiresAt: Date.now() + 60_000,
            uploadToken: "cleanup-ticket",
            uploadUrl: "https://storage.example/upload",
          });
        }
        if (name === "crm/passportActions:encryptAndStorePassport") {
          return Promise.reject(new Error("processing failed"));
        }
        if (name === "crm/passportActions:discardPassportUpload") {
          return Promise.resolve({ success: true });
        }
        return Promise.reject(new Error(`Unexpected action: ${name}`));
      },
      getTokenImpl: () => Promise.resolve("staff-token"),
      serverSecret: "server-upload-secret",
      uploadFetchImpl: () => Promise.resolve(Response.json({ storageId: "storage-cleanup" })),
    });

    expect(response.status).toBe(400);
    expect(calls).toEqual([
      "crm/passportActions:generateUploadUrl",
      "crm/passportActions:encryptAndStorePassport",
      "crm/passportActions:discardPassportUpload",
    ]);
  });

  test("rejects oversized and unauthenticated requests before issuing a ticket", async () => {
    const oversized = new Request("http://citius.test/upload", {
      body: "x",
      headers: {
        "Content-Length": String(16 * 1024 * 1024),
        "Content-Type": "multipart/form-data; boundary=test",
      },
      method: "POST",
    });
    await expect(
      handlePassportUpload(oversized, "traveller-1", {
        getTokenImpl: () => Promise.resolve("staff-token"),
        serverSecret: "server-upload-secret",
      }).then((response) => response.status)
    ).resolves.toBe(413);

    await expect(
      handlePassportUpload(uploadRequest(), "traveller-1", {
        getTokenImpl: () => Promise.resolve(null),
        serverSecret: "server-upload-secret",
      }).then((response) => response.status)
    ).resolves.toBe(403);

    const crossSiteRequest = uploadRequest();
    crossSiteRequest.headers.set("Origin", "https://hostile.example");
    crossSiteRequest.headers.set("Sec-Fetch-Site", "cross-site");
    await expect(
      handlePassportUpload(crossSiteRequest, "traveller-1", {
        getTokenImpl: () => Promise.resolve("staff-token"),
        serverSecret: "server-upload-secret",
      }).then((response) => response.status)
    ).resolves.toBe(403);
  });
});
