import { describe, expect, test } from "bun:test";
import type { FunctionReference } from "convex/server";
import { getFunctionName } from "convex/server";
import { handlePassportUpload } from "./route";

function uploadRequest(contents = "%PDF-1.7\n%%EOF") {
  const form = new FormData();
  form.set("file", new File([contents], "passport.pdf", { type: "application/pdf" }));
  form.set("expiryDate", "2030-01-01");
  return new Request("http://citius.test/api/portal/files/passport-upload/traveller-1", {
    body: form,
    method: "POST",
  });
}

function smallChunkUploadRequest(contents: string, chunkSize: number) {
  const boundary = "passport-upload-test-boundary";
  const bytes = new TextEncoder().encode(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="passport.pdf"\r\nContent-Type: application/pdf\r\n\r\n${contents}\r\n--${boundary}\r\nContent-Disposition: form-data; name="expiryDate"\r\n\r\n2030-01-01\r\n--${boundary}--\r\n`
  );
  return new Request("http://citius.test/api/portal/files/passport-upload/traveller-1", {
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
          controller.enqueue(bytes.slice(offset, offset + chunkSize));
        }
        controller.close();
      },
    }),
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
    method: "POST",
  });
}

function oversizedStreamRequest(declaredLength?: string) {
  let cancelled = false;
  let chunkIndex = 0;
  const chunks = [new Uint8Array(4 * 1024 * 1024 + 128 * 1024), new Uint8Array(1)];
  const body = new ReadableStream<Uint8Array>({
    cancel() {
      cancelled = true;
    },
    pull(controller) {
      const chunk = chunks[chunkIndex];
      if (!chunk) {
        return;
      }
      chunkIndex += 1;
      controller.enqueue(chunk);
    },
  });
  const headers = new Headers({ "Content-Type": "multipart/form-data; boundary=test" });
  if (declaredLength !== undefined) {
    headers.set("Content-Length", declaredLength);
  }
  const request = new Request("http://citius.test/upload", { body, headers, method: "POST" });
  return { body, request, wasCancelled: () => cancelled };
}

interface CapturedPassportUploadArgs {
  contentDigest?: string;
  fileSize?: number;
  mimeType?: string;
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
    const providerContentTypes: string[] = [];
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
            storageContentType: "application/octet-stream; citius-passport-ticket=server-bound",
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
      uploadFetchImpl: (_input, init) => {
        providerContentTypes.push(new Headers(init?.headers).get("content-type") ?? "");
        return Promise.resolve(Response.json({ storageId: "storage-private-quarantine" }));
      },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({
      args: {
        contentDigest: "1dtw+8zdjMxqVTYEt5oJzTMIO0ATQNVG76CKUhQsly4=",
        fileSize: 14,
        mimeType: "application/pdf",
        serverSecret: "server-upload-secret",
        travellerId: "traveller-1",
      },
      name: "crm/passportActions:generateUploadUrl",
    });
    expect(providerContentTypes[0]).toBe(
      "application/octet-stream; citius-passport-ticket=server-bound"
    );
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
            storageContentType: "application/octet-stream; citius-passport-ticket=cleanup-bound",
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

  test("reads a multipart upload delivered in many small chunks", async () => {
    const request = smallChunkUploadRequest(`%PDF-1.7\n${"0".repeat(4096)}\n%%EOF`, 1);
    const response = await handlePassportUpload(request, "traveller-1", {
      fetchAuthActionImpl: (reference: FunctionReference<"action">) => {
        const name = getFunctionName(reference);
        if (name === "crm/passportActions:generateUploadUrl") {
          return Promise.resolve({
            expiresAt: Date.now() + 60_000,
            storageContentType: "application/octet-stream; citius-passport-ticket=chunked",
            uploadToken: "chunked-upload-ticket",
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
      uploadFetchImpl: () => Promise.resolve(Response.json({ storageId: "storage-chunked" })),
    });

    expect({ body: await response.json(), status: response.status }).toEqual({
      body: { success: true },
      status: 200,
    });
    expect(request.body?.locked).toBe(false);
  });

  test("cancels an oversized stream with no Content-Length", async () => {
    const streamed = oversizedStreamRequest();
    const response = await handlePassportUpload(streamed.request, "traveller-1", {
      getTokenImpl: () => Promise.resolve("staff-token"),
      serverSecret: "server-upload-secret",
    });

    expect(response.status).toBe(413);
    expect(streamed.wasCancelled()).toBe(true);
    expect(streamed.body.locked).toBe(false);
  });

  test("cancels an oversized stream with an underreported Content-Length", async () => {
    const streamed = oversizedStreamRequest("1");
    const response = await handlePassportUpload(streamed.request, "traveller-1", {
      getTokenImpl: () => Promise.resolve("staff-token"),
      serverSecret: "server-upload-secret",
    });

    expect(response.status).toBe(413);
    expect(streamed.wasCancelled()).toBe(true);
    expect(streamed.body.locked).toBe(false);
  });

  test("rejects oversized and unauthenticated requests before issuing a ticket", async () => {
    const oversized = new Request("http://citius.test/upload", {
      body: "x",
      headers: {
        "Content-Length": String(4 * 1024 * 1024 + 128 * 1024 + 1),
        "Content-Type": "multipart/form-data; boundary=test",
      },
      method: "POST",
    });
    const oversizedResponse = await handlePassportUpload(oversized, "traveller-1", {
      getTokenImpl: () => Promise.resolve("staff-token"),
      serverSecret: "server-upload-secret",
    });
    expect(oversizedResponse.status).toBe(413);
    expect(await oversizedResponse.json()).toEqual({
      error: "Passport scans must be 4 MB or smaller",
    });

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
