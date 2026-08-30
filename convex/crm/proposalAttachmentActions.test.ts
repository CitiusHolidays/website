import { describe, expect, test } from "bun:test";
import { fromAny } from "@total-typescript/shoehorn";
import type { FunctionReference } from "convex/server";
import { getFunctionName } from "convex/server";
import { PERMISSIONS } from "./lib";
import { attachFile, generateUploadUrl } from "./proposalAttachmentActions";

function makeContext(referenced: boolean) {
  const deletes: string[] = [];
  const ctx = {
    runMutation: (
      reference: FunctionReference<"query" | "mutation" | "action", "public" | "internal">,
      args?: { storageId?: string }
    ) => {
      const name = getFunctionName(reference);
      if (name === "crm/proposalAttachments:resolveProposalId") {
        return "proposals_1";
      }
      if (name === "crm/storageReferences:deleteIfUnreferenced") {
        if (referenced) {
          return { deleted: false };
        }
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
          authUserId: "auth_contracting",
          email: "contracting@example.test",
          name: "Contracting",
          permissions: [PERMISSIONS.MANAGE_CONTRACTING],
          roles: ["Contracting"],
        };
      }
      if (name === "crm/commercialFiles:canUploadToSource") {
        return true;
      }
      throw new Error(`Unexpected query: ${name}`);
    },
    storage: {
      delete: (storageId: string) => {
        deletes.push(storageId);
      },
      get: () => new Blob(["proposal attachment"], { type: "application/pdf" }),
    },
  };
  return { ctx, deletes };
}

describe("Proposal attachment quarantine cleanup", () => {
  test("Out-of-scope proposal is denied before a storage upload URL is issued", async () => {
    let uploadUrls = 0;
    const ctx = {
      runMutation: () => "proposals_out_of_scope",
      runQuery: (
        reference: FunctionReference<"query" | "mutation" | "action", "public" | "internal">
      ) => {
        const name = getFunctionName(reference);
        if (name === "crm/staff:getMyPortalAccess") {
          return {
            allowed: true,
            permissions: [PERMISSIONS.MANAGE_CONTRACTING],
            roles: ["Contracting"],
          };
        }
        if (name === "crm/commercialFiles:canUploadToSource") {
          return false;
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
      fromAny<any, unknown>(generateUploadUrl)._handler(ctx, {
        proposalId: "proposals_out_of_scope",
      })
    ).rejects.toThrow("FORBIDDEN");
    expect(uploadUrls).toBe(0);
  });

  test("Cleans an unreferenced upload when metadata commit fails", async () => {
    const { ctx, deletes } = makeContext(false);
    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<any, unknown>(attachFile)._handler(ctx, {
        fileName: "proposal.pdf",
        fileSize: 19,
        mimeType: "application/pdf",
        proposalId: "proposals_1",
        storageId: "storage_quarantine",
      })
    ).rejects.toThrow("metadata write failed");
    expect(deletes).toEqual(["storage_quarantine"]);
  });

  test("Leaves referenced storage untouched if a retry fails", async () => {
    const { ctx, deletes } = makeContext(true);
    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<any, unknown>(attachFile)._handler(ctx, {
        fileName: "proposal.pdf",
        fileSize: 19,
        mimeType: "application/pdf",
        proposalId: "proposals_1",
        storageId: "storage_referenced",
      })
    ).rejects.toThrow("metadata write failed");
    expect(deletes).toEqual([]);
  });
});
