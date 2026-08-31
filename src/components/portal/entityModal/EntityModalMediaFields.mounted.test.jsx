import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";

const queryCalls = [];
const previewRequests = [];

mock.module("@convex/_generated/api", () => ({
  api: {
    crm: {
      commercialFiles: { listForEntryPoint: "commercialFiles.listForEntryPoint" },
      queryAttachments: { listForQuery: "queryAttachments.listForQuery" },
    },
  },
}));

mock.module("@/lib/portal/documentPreview", () => ({
  requestDocumentPreview: (request) => previewRequests.push(request),
}));

mock.module("@/components/portal/PortalModalForm", () => ({
  FinalizedProposalPdfPanel: () => null,
  formatDate: (value) => String(value),
  formatFileSize: (value) => `${value} bytes`,
  QueryAttachmentsPanel: () => <div data-testid="source-files" />,
}));

mock.module("@/lib/portal/trackedConvexSubscriptions", () => ({
  useTrackedPaginatedQuery: () => ({
    loadMore: () => undefined,
    results: [],
    status: "Exhausted",
  }),
  useTrackedQuery: (_reference, args) => {
    if (args === "skip") {
      return;
    }
    queryCalls.push(args);
    if (args.cursor === "linked-page-2") {
      return {
        items: [
          {
            createdAt: 1,
            fileKind: "attachment",
            fileName: "linked-contract.pdf",
            fileSize: 128,
            id: "commercial/file 2",
            mimeType: "application/pdf",
            readOnly: false,
            sourceLabel: "Proposal P-2",
          },
        ],
        nextCursor: null,
      };
    }
    return { items: [], nextCursor: "linked-page-2" };
  },
}));

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal/proposals",
});
let createRoot;
let EntityModalMediaFields;

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  ({ createRoot } = await import("react-dom/client"));
  ({ EntityModalMediaFields } = await import("./EntityModalMediaFields"));
});

afterAll(() => {
  mock.restore();
  dom.window.close();
});

const asyncNoop = () => Promise.resolve();
const hasNoPermissions = () => false;

describe("Entity modal linked Commercial Files", () => {
  test("continues through a sparse canonical page and previews the opaque canonical id", async () => {
    queryCalls.length = 0;
    previewRequests.length = 0;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () =>
      root.render(
        <EntityModalMediaFields
          attachFinalizedPdf={asyncNoop}
          attachProposalFile={asyncNoop}
          attachQueryFile={asyncNoop}
          form={{ proposalId: "proposals_1" }}
          generateFinalizedPdfUploadUrl={asyncNoop}
          generateProposalUploadUrl={asyncNoop}
          generateQueryUploadUrl={asyncNoop}
          getFinalizedPdfUrl={asyncNoop}
          getProposalAttachmentUrl={asyncNoop}
          getQueryAttachmentUrl={asyncNoop}
          has={hasNoPermissions}
          modal="proposalAttachments"
          proposals={[{ attachments: [], id: "proposals_1" }]}
          removeFinalizedPdf={asyncNoop}
          removeProposalAttachment={asyncNoop}
          removeQueryAttachment={asyncNoop}
        />
      )
    );

    expect(container.textContent).toContain(
      "No linked files on this loaded page. More records are available."
    );
    const loadMore = [...container.querySelectorAll("button")].find((button) =>
      button.textContent.includes("Load more linked files")
    );
    await act(async () => loadMore.click());

    expect(queryCalls).toContainEqual({
      cursor: "linked-page-2",
      entityId: "proposals_1",
      entryPoint: "proposal",
      includeDeleted: false,
      includeHistory: false,
      limit: 25,
      linkedOnly: true,
    });
    expect(container.textContent).toContain("linked-contract.pdf");
    const view = [...container.querySelectorAll("button")].find(
      (button) => button.textContent.trim() === "View"
    );
    await act(async () => view.click());
    expect(previewRequests).toEqual([
      {
        fileName: "linked-contract.pdf",
        mimeType: "application/pdf",
        sourceUrl: "/api/portal/files/commercial/commercial%2Ffile%202",
      },
    ]);

    const callsBeforeSwitch = queryCalls.length;
    await act(async () =>
      root.render(
        <EntityModalMediaFields
          attachFinalizedPdf={asyncNoop}
          attachProposalFile={asyncNoop}
          attachQueryFile={asyncNoop}
          form={{ proposalId: "proposals_2" }}
          generateFinalizedPdfUploadUrl={asyncNoop}
          generateProposalUploadUrl={asyncNoop}
          generateQueryUploadUrl={asyncNoop}
          getFinalizedPdfUrl={asyncNoop}
          getProposalAttachmentUrl={asyncNoop}
          getQueryAttachmentUrl={asyncNoop}
          has={hasNoPermissions}
          modal="proposalAttachments"
          proposals={[
            { attachments: [], id: "proposals_1" },
            { attachments: [], id: "proposals_2" },
          ]}
          removeFinalizedPdf={asyncNoop}
          removeProposalAttachment={asyncNoop}
          removeQueryAttachment={asyncNoop}
        />
      )
    );
    expect(
      queryCalls.slice(callsBeforeSwitch).find((args) => args.entityId === "proposals_2")
    ).toMatchObject({ cursor: undefined, entityId: "proposals_2" });
    expect(container.textContent).not.toContain("linked-contract.pdf");

    await act(async () => root.unmount());
    container.remove();
  });
});
