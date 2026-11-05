import { expect, test } from "bun:test";
import { pipeViewRows } from "./pipeViewRows";

test("Queries keeps a focused archived row out of active results while preserving the other list views", () => {
  const rows = [
    { clientName: "Acme", id: "active", leadStage: "Lost", salesStatus: "Proposal in discussion" },
    {
      clientName: "Acme",
      contractingStatus: "Proposal sent",
      id: "lost",
      leadStage: "Lost",
      salesStatus: "Order Lost",
    },
  ];
  const filters = {
    dateRange: {},
    filterConfig: [],
    jobCardFilter: "",
    listFilters: {},
    search: "",
    searchKeys: [],
  };
  const ids = (result: typeof rows) => result.map((row) => row.id);
  expect(ids(pipeViewRows(rows, { ...filters, view: "queries" }))).toEqual(["active"]);
  expect(
    ids(
      pipeViewRows(rows, {
        ...filters,
        listFilters: { salesStatus: "Order Lost" },
        view: "queries",
      })
    )
  ).toEqual(["lost"]);
  expect(ids(pipeViewRows(rows, { ...filters, view: "contracting" }))).toEqual(["active"]);
  expect(
    ids(
      pipeViewRows(rows, {
        ...filters,
        filterConfig: [{ field: "contractingStatus" }],
        listFilters: { contractingStatus: "Order Lost" },
        view: "contracting",
      })
    )
  ).toEqual(["lost"]);
  expect(ids(pipeViewRows(rows, { ...filters, view: "pipeline" }))).toEqual(["active", "lost"]);
});
