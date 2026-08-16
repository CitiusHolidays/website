import { describe, expect, test } from "bun:test";
import type { FunctionReference } from "convex/server";
import { getFunctionName } from "convex/server";
import { generateUploadUrl, uploadFile } from "./commercialFileActions";
import { PERMISSIONS } from "./lib";

describe("commercial file upload quarantine", () => {
  test("denies an out-of-scope upload before issuing a storage URL", async () => {
    let uploadUrls = 0;
    const ctx = {
      runMutation: () => {
        throw new Error("must not create a session");
      },
      runQuery: (
        reference: FunctionReference<"query" | "mutation" | "action", "public" | "internal">
      ) => {
        const name = getFunctionName(reference);
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
      // SAFETY: This test controls the asserted value at the framework boundary below.
      (generateUploadUrl as any)._handler(ctx, {
        category: "workingFile",
        sourceId: "queries_out_of_scope",
        sourceType: "query",
        teamArea: "sales",
      })
    ).rejects.toThrow("FORBIDDEN");
    expect(uploadUrls).toBe(0);
  });

  test("cleans an unreferenced blob when the metadata commit fails", async () => {
    const deletes: string[] = [];
    const ctx = {
      runMutation: (
        reference: FunctionReference<"query" | "mutation" | "action", "public" | "internal">,
        args?: { storageId?: string }
      ) => {
        const name = getFunctionName(reference);
        if (name === "crm/commercialFiles:claimUploadSession") {
          return { success: true };
        }
        if (name === "crm/storageReferences:deleteIfUnreferenced") {
          deletes.push(args?.storageId ?? "");
          return { deleted: true };
        }
        if (name === "crm/commercialFiles:createFile") {
          throw new Error("metadata write failed");
        }
        throw new Error(`Unexpected mutation: ${name}`);
      },
      runQuery: (
        reference: FunctionReference<"query" | "mutation" | "action", "public" | "internal">
      ) => {
        const name = getFunctionName(reference);
        if (name === "crm/staff:getMyPortalAccess") {
          return {
            allowed: true,
            authUserId: "auth_sales",
            email: "sales@example.test",
            name: "Sales",
            permissions: [PERMISSIONS.MANAGE_QUERIES],
            roles: ["Sales"],
          };
        }
        if (name === "crm/commercialFiles:listForEntryPoint") {
          return {
            writableSources: [{ id: "queries_1", sourceType: "query", teamAreas: ["sales"] }],
          };
        }
        if (name === "crm/storageReferences:isStorageReferenced") {
          return false;
        }
        throw new Error(`Unexpected query: ${name}`);
      },
      storage: {
        delete: (storageId: string) => {
          deletes.push(storageId);
        },
        get: () => new Blob(["commercial attachment"], { type: "application/pdf" }),
      },
    };

    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      (uploadFile as any)._handler(ctx, {
        category: "workingFile",
        fileName: "quote.pdf",
        fileSize: 21,
        mimeType: "application/pdf",
        sourceId: "queries_1",
        sourceType: "query",
        storageId: "storage_quarantine",
        teamArea: "sales",
        uploadToken: "upload-token",
      })
    ).rejects.toThrow("metadata write failed");
    expect(deletes).toEqual(["storage_quarantine"]);
  });
});
