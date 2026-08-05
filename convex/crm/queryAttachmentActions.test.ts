import { describe, expect, test } from "bun:test";
import { getFunctionName } from "convex/server";
import { PERMISSIONS } from "./lib";
import {
  attachFile,
  generateUploadUrl,
  getDownloadFile,
  getDownloadUrl,
} from "./queryAttachmentActions";

function operationDownloadContext(permission: string) {
  let calls = 0;
  return {
    runQuery: () => {
      calls += 1;
      return calls === 1 ? { allowed: true, permissions: [permission] } : null;
    },
  };
}

describe("query attachment action access", () => {
  test("Job Card viewers pass both download action guards before record authorization", async () => {
    await Promise.all(
      [getDownloadUrl, getDownloadFile].map((action) =>
        expect(
          (action as any)._handler(operationDownloadContext(PERMISSIONS.VIEW_JOB_CARDS), {
            attachmentId: "attachment_1",
          })
        ).rejects.toThrow("Attachment not found")
      )
    );
  });

  test("unrelated roles remain forbidden", async () => {
    await expect(
      (getDownloadFile as any)._handler(operationDownloadContext(PERMISSIONS.VIEW_FINANCE), {
        attachmentId: "attachment_1",
      })
    ).rejects.toThrow("FORBIDDEN");
  });

  test("out-of-scope query is denied before a storage upload URL is issued", async () => {
    let uploadUrls = 0;
    const ctx = {
      runMutation: () => "queries_out_of_scope",
      runQuery: (reference: unknown) => {
        const name = getFunctionName(reference as never);
        if (name === "crm/staff:getMyPortalAccess") {
          return {
            allowed: true,
            permissions: [PERMISSIONS.MANAGE_QUERIES],
            roles: ["Sales"],
          };
        }
        if (name === "crm/commercialFiles:listForEntryPoint") {
          return { writableSources: [] };
        }
        throw new Error(`Unexpected query: ${name}`);
      },
      storage: {
        generateUploadUrl: () => {
          uploadUrls += 1;
          return "https://storage.example/upload";
        },
      },
    };

    await expect(
      (generateUploadUrl as any)._handler(ctx, { queryId: "queries_out_of_scope" })
    ).rejects.toThrow("FORBIDDEN");
    expect(uploadUrls).toBe(0);
  });

  test("failed validation cleans only an unreferenced quarantine blob", async () => {
    const deletes: string[] = [];
    const ctx = {
      runMutation: (reference: unknown, args?: { storageId?: string }) => {
        const name = getFunctionName(reference as never);
        if (name === "crm/queryAttachments:resolveQueryId") {
          return "queries_1";
        }
        if (name === "crm/storageReferences:deleteIfUnreferenced") {
          deletes.push(args?.storageId ?? "");
          return { deleted: true };
        }
        if (name === "crm/queryAttachments:saveAttachment") {
          throw new Error("metadata write failed");
        }
        throw new Error(`Unexpected mutation: ${name}`);
      },
      runQuery: (reference: unknown) => {
        const name = getFunctionName(reference as never);
        if (name === "crm/staff:getMyPortalAccess") {
          return {
            allowed: true,
            authUserId: "auth_sales",
            permissions: [PERMISSIONS.MANAGE_QUERIES],
            roles: ["Sales"],
          };
        }
        if (name === "crm/commercialFiles:listForEntryPoint") {
          return {
            writableSources: [{ id: "queries_1", sourceType: "query", teamAreas: ["sales"] }],
          };
        }
        throw new Error(`Unexpected query: ${name}`);
      },
      storage: {
        delete: (storageId: string) => {
          deletes.push(storageId);
        },
        get: () => new Blob(["query attachment"], { type: "application/pdf" }),
      },
    };

    await expect(
      (attachFile as any)._handler(ctx, {
        fileName: "quote.pdf",
        fileSize: 16,
        mimeType: "application/pdf",
        queryId: "queries_1",
        storageId: "storage_quarantine",
      })
    ).rejects.toThrow("metadata write failed");
    expect(deletes).toEqual(["storage_quarantine"]);
  });

  test("never deletes a blob that became referenced while the write failed", async () => {
    const deletes: string[] = [];
    const ctx = {
      runMutation: (reference: unknown, _args?: { storageId?: string }) => {
        const name = getFunctionName(reference as never);
        if (name === "crm/queryAttachments:resolveQueryId") {
          return "queries_1";
        }
        if (name === "crm/storageReferences:deleteIfUnreferenced") {
          return { deleted: false };
        }
        if (name === "crm/queryAttachments:saveAttachment") {
          throw new Error("metadata write failed");
        }
        throw new Error(`Unexpected mutation: ${name}`);
      },
      runQuery: (reference: unknown) => {
        const name = getFunctionName(reference as never);
        if (name === "crm/staff:getMyPortalAccess") {
          return {
            allowed: true,
            authUserId: "auth_sales",
            permissions: [PERMISSIONS.MANAGE_QUERIES],
            roles: ["Sales"],
          };
        }
        if (name === "crm/commercialFiles:listForEntryPoint") {
          return {
            writableSources: [{ id: "queries_1", sourceType: "query", teamAreas: ["sales"] }],
          };
        }
        throw new Error(`Unexpected query: ${name}`);
      },
      storage: {
        delete: (storageId: string) => {
          deletes.push(storageId);
        },
        get: () => new Blob(["query attachment"], { type: "application/pdf" }),
      },
    };

    await expect(
      (attachFile as any)._handler(ctx, {
        fileName: "quote.pdf",
        fileSize: 16,
        mimeType: "application/pdf",
        queryId: "queries_1",
        storageId: "storage_already_used",
      })
    ).rejects.toThrow("metadata write failed");
    expect(deletes).toEqual([]);
  });
});
