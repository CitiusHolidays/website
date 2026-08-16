import { describe, expect, spyOn, test } from "bun:test";
import * as lib from "./lib";
import {
  notifyLinkedQuerySalesOwnersOfProposalDocument,
  pickBestProposalDocument,
} from "./proposalDocument";

describe("pickBestProposalDocument", () => {
  test("prefers Accepted over Sent and latest upload within a status", () => {
    const document = pickBestProposalDocument([
      {
        _id: "p_sent_old",
        finalizedPdfFileName: "sent-old.pdf",
        finalizedPdfStorageId: "storage_1",
        finalizedPdfUploadedAt: 100,
        status: "Sent",
        updatedAt: 100,
      },
      {
        _id: "p_accepted",
        finalizedPdfFileName: "accepted.pdf",
        finalizedPdfStorageId: "storage_2",
        finalizedPdfUploadedAt: 50,
        status: "Accepted",
        updatedAt: 50,
      },
      {
        _id: "p_sent_new",
        finalizedPdfFileName: "sent-new.pdf",
        finalizedPdfStorageId: "storage_3",
        finalizedPdfUploadedAt: 200,
        status: "Sent",
        updatedAt: 200,
      },
    ]);

    expect(document).toEqual({
      fileName: "accepted.pdf",
      proposalId: "p_accepted",
      uploadedAt: new Date(50).toISOString(),
    });
  });

  test("returns null when no linked proposal has a proposal document", () => {
    expect(
      pickBestProposalDocument([
        { _id: "p_draft", status: "Draft", updatedAt: 10 },
        { _id: "p_sent", status: "Sent", updatedAt: 20 },
      ])
    ).toBeNull();
  });
});

describe("notifyLinkedQuerySalesOwnersOfProposalDocument", () => {
  test("notifies each unique linked query sales owner and skips role fallback", async () => {
    const publishWorkflowNotification = spyOn(
      lib,
      "publishWorkflowNotification"
    ).mockImplementation(async () => {});
    const ctx = {
      db: {
        get: async (_table: string, id: string) =>
          id === "proposals_1"
            ? {
                _id: "proposals_1",
                proposalCode: "P-0001",
                queryId: "queries_1",
              }
            : id === "queries_1"
              ? {
                  _id: "queries_1",
                  queryCode: "Q-0001",
                  salesOwnerId: "auth_sales",
                }
              : id === "queries_2"
                ? {
                    _id: "queries_2",
                    queryCode: "Q-0002",
                    salesOwnerId: "auth_sales",
                  }
                : null,
        normalizeId: (_table: string, id: string) => (id.startsWith("staff_") ? id : null),
        query: (table: string) => ({
          withIndex: () =>
            table === "staffUsers"
              ? {
                  unique: async () => ({
                    _id: "staff_sales",
                    active: true,
                    authUserId: "auth_sales",
                  }),
                }
              : {
                  collect: async () => [
                    { proposalId: "proposals_1", queryId: "queries_1" },
                    { proposalId: "proposals_1", queryId: "queries_2" },
                  ],
                },
        }),
      },
    };

    try {
      // SAFETY: This test controls the asserted value at the framework boundary below.
      await notifyLinkedQuerySalesOwnersOfProposalDocument(ctx as never, {
        isReplacement: false,
        proposalCode: "P-0001",
        // SAFETY: This test controls the asserted value at the framework boundary below.
        proposalId: "proposals_1" as never,
      });

      expect(publishWorkflowNotification).toHaveBeenCalledTimes(1);
      expect(publishWorkflowNotification).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          bellTargets: { kind: "staff", staffIds: ["staff_sales"] },
          content: expect.objectContaining({ title: "Proposal document uploaded" }),
          emailTargets: { kind: "staff", staffIds: ["staff_sales"] },
        })
      );
    } finally {
      publishWorkflowNotification.mockRestore();
    }
  });

  test("falls back to Sales roles when the stored auth owner has no active staff record", async () => {
    const publishWorkflowNotification = spyOn(
      lib,
      "publishWorkflowNotification"
    ).mockImplementation(async () => {});
    const ctx = {
      db: {
        get: async (_table: string, id: string) =>
          id === "proposals_1"
            ? {
                _id: "proposals_1",
                proposalCode: "P-0001",
                queryId: "queries_1",
              }
            : {
                _id: "queries_1",
                queryCode: "Q-0001",
                salesOwnerId: "auth_missing",
              },
        normalizeId: () => null,
        query: (table: string) => ({
          withIndex: () =>
            table === "staffUsers" ? { unique: async () => null } : { collect: async () => [] },
        }),
      },
    };

    try {
      // SAFETY: This test controls the asserted value at the framework boundary below.
      await notifyLinkedQuerySalesOwnersOfProposalDocument(ctx as never, {
        isReplacement: true,
        proposalCode: "P-0001",
        // SAFETY: This test controls the asserted value at the framework boundary below.
        proposalId: "proposals_1" as never,
      });

      expect(publishWorkflowNotification).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          bellTargets: { kind: "roles", roles: ["Sales", "Sales Head"] },
          content: expect.objectContaining({ title: "Proposal document revised" }),
          emailTargets: { kind: "roles", roles: ["Sales", "Sales Head"] },
        })
      );
    } finally {
      publishWorkflowNotification.mockRestore();
    }
  });
});
