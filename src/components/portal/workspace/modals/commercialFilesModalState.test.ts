import { describe, expect, test } from "bun:test";
import {
  type CommercialFileSourceOption,
  commercialFileFilterSignature,
  commercialFilePagerReducer,
  commercialFileRowsForPage,
  createCommercialFilePagerState,
  INITIAL_COMMERCIAL_FILE_FILTERS,
  resolveCommercialFileUploadSelection,
} from "./commercialFilesModalState";

const querySource: CommercialFileSourceOption = {
  code: "Q-0043",
  id: "query-1",
  label: "Q-0043",
  sourceType: "query",
  teamAreas: ["sales"],
};
const proposalSource: CommercialFileSourceOption = {
  code: "P-0043",
  id: "proposal-1",
  label: "P-0043",
  sourceType: "proposal",
  teamAreas: ["contracting", "ticketing"],
};

describe("Commercial Files modal state owners", () => {
  test("deduplicates pages and ignores a stale continuation action", () => {
    const signature = commercialFileFilterSignature(
      INITIAL_COMMERCIAL_FILE_FILTERS,
      "query",
      "query-1"
    );
    const initial = createCommercialFilePagerState<{ id: string; label: string }>(signature);
    const loaded = commercialFilePagerReducer(initial, {
      cursor: "page-2",
      rows: [
        { id: "file-1", label: "first" },
        { id: "file-2", label: "second" },
      ],
      signature,
      type: "loadMore",
    });
    const stale = commercialFilePagerReducer(loaded, {
      cursor: "stale-page",
      rows: [{ id: "file-stale", label: "stale" }],
      signature: "old-filter-signature",
      type: "loadMore",
    });

    expect(stale).toEqual(loaded);
    expect(
      commercialFileRowsForPage(stale, signature, [
        { id: "file-2", label: "second-updated" },
        { id: "file-3", label: "third" },
      ])
    ).toEqual([
      { id: "file-1", label: "first" },
      { id: "file-2", label: "second-updated" },
      { id: "file-3", label: "third" },
    ]);
  });

  test("hides a locally deleted row until the query catches up", () => {
    const state = commercialFilePagerReducer(createCommercialFilePagerState("current"), {
      id: "file-1",
      type: "hideRow",
    });
    expect(
      commercialFileRowsForPage(state, "current", [{ id: "file-1" }, { id: "file-2" }])
    ).toEqual([{ id: "file-2" }]);
  });

  test("derives valid source and team fallbacks without synchronization effects", () => {
    expect(
      resolveCommercialFileUploadSelection({
        entityId: "query-1",
        entryPoint: "query",
        requestedSourceKey: "proposal:missing",
        requestedTeamArea: "ticketing",
        sourceOptions: [proposalSource, querySource],
      })
    ).toMatchObject({
      proposalDocAllowed: false,
      source: querySource,
      sourceKey: "query:query-1",
      teamArea: "sales",
    });
  });

  test("allows Proposal Docs only for a writable Contracting proposal area", () => {
    expect(
      resolveCommercialFileUploadSelection({
        entityId: "query-1",
        entryPoint: "query",
        requestedSourceKey: "proposal:proposal-1",
        requestedTeamArea: "ticketing",
        sourceOptions: [querySource, proposalSource],
      })
    ).toMatchObject({
      proposalDocAllowed: true,
      source: proposalSource,
      teamArea: "ticketing",
    });
  });
});
