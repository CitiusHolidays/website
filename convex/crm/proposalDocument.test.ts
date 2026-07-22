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
    const notifyStaffMember = spyOn(lib, "notifyStaffMember").mockImplementation(async () => {});
    const notifyRoles = spyOn(lib, "notifyRoles").mockImplementation(async () => {});
    const ctx = {
      db: {
        get: async (id: string) =>
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
      await notifyLinkedQuerySalesOwnersOfProposalDocument(ctx as never, {
        isReplacement: false,
        proposalCode: "P-0001",
        proposalId: "proposals_1" as never,
      });

      expect(notifyStaffMember).toHaveBeenCalledTimes(1);
      expect(notifyRoles).not.toHaveBeenCalled();
    } finally {
      notifyStaffMember.mockRestore();
      notifyRoles.mockRestore();
    }
  });

  test("falls back to Sales roles when the stored auth owner has no active staff record", async () => {
    const notifyStaffMember = spyOn(lib, "notifyStaffMember").mockImplementation(async () => {});
    const notifyRoles = spyOn(lib, "notifyRoles").mockImplementation(async () => {});
    const ctx = {
      db: {
        get: async (id: string) =>
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
      await notifyLinkedQuerySalesOwnersOfProposalDocument(ctx as never, {
        isReplacement: true,
        proposalCode: "P-0001",
        proposalId: "proposals_1" as never,
      });

      expect(notifyStaffMember).not.toHaveBeenCalled();
      expect(notifyRoles).toHaveBeenCalledWith(
        expect.anything(),
        ["Sales", "Sales Head"],
        expect.objectContaining({ title: "Proposal document revised" })
      );
    } finally {
      notifyStaffMember.mockRestore();
      notifyRoles.mockRestore();
    }
  });
});
