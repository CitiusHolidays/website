import { afterEach, describe, expect, mock, test } from "bun:test";
import { uploadExpenseProofFiles, uploadQueryFiles } from "./fileUploads";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function fileFixture(name) {
  return {
    name,
    size: 7,
    type: "application/pdf",
  };
}

describe("portal file upload adapters", () => {
  test("forwards the canonical one-use upload token for Query files", async () => {
    const requests = [];
    const attachments = [];
    globalThis.fetch = mock((url, init) => {
      requests.push({ init, url });
      return Response.json({ storageId: "storage-query" });
    });

    await uploadQueryFiles({
      attachQueryFile: async (args) => attachments.push(args),
      files: [fileFixture("query.pdf")],
      generateUploadUrl: async () => ({
        uploadToken: "query-upload-token",
        uploadUrl: "https://storage.example/query",
      }),
      queryId: "query-1",
    });

    expect(requests).toMatchObject([
      { init: { method: "POST" }, url: "https://storage.example/query" },
    ]);
    expect(attachments).toEqual([
      {
        fileName: "query.pdf",
        fileSize: 7,
        mimeType: "application/pdf",
        queryId: "query-1",
        storageId: "storage-query",
        uploadToken: "query-upload-token",
      },
    ]);
  });

  test("preserves the independent raw upload URL contract for expense proofs", async () => {
    const attachments = [];
    globalThis.fetch = mock((url) => {
      expect(url).toBe("https://storage.example/expense");
      return Response.json({ storageId: "storage-expense" });
    });

    await uploadExpenseProofFiles({
      attachExpenseProof: async (args) => attachments.push(args),
      expenseId: "expense-1",
      files: [fileFixture("receipt.pdf")],
      generateUploadUrl: async () => "https://storage.example/expense",
    });

    expect(attachments).toEqual([
      {
        expenseId: "expense-1",
        fileName: "receipt.pdf",
        fileSize: 7,
        mimeType: "application/pdf",
        storageId: "storage-expense",
      },
    ]);
  });
});
