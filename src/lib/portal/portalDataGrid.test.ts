import { describe, expect, test } from "bun:test";
import {
  nextSortState,
  type PortalGridColumn,
  preparePortalColumns,
  reconcilePortalSort,
  sortPortalRows,
  visiblePortalColumns,
} from "./portalDataGrid";

interface Row {
  client: string;
  createdAt: number;
  id: string;
  status: string;
}

const columns: PortalGridColumn<Row>[] = [
  {
    id: "client",
    kind: "identity",
    label: "Client",
    render: (row) => row.client,
    sortValue: (row) => row.client,
  },
  {
    hideable: true,
    id: "created",
    label: "Created",
    render: (row) => row.createdAt,
    sortValue: (row) => row.createdAt,
  },
  {
    id: "status",
    kind: "status",
    label: "Status",
    render: (row) => row.status,
  },
];

const rows: Row[] = [
  { client: "Zulu", createdAt: 10, id: "second", status: "Open" },
  { client: "Alpha", createdAt: 10, id: "first", status: "Open" },
  { client: "Bravo", createdAt: 5, id: "third", status: "Open" },
];

describe("portal data grid contract", () => {
  test("cycles a sortable column through ascending, descending, and cleared state", () => {
    expect(nextSortState(null, "client")).toEqual({ columnId: "client", direction: "asc" });
    expect(nextSortState({ columnId: "client", direction: "asc" }, "client")).toEqual({
      columnId: "client",
      direction: "desc",
    });
    expect(nextSortState({ columnId: "client", direction: "desc" }, "client")).toBeNull();
  });

  test("sorts from a domain value and keeps equal values stable", () => {
    expect(
      sortPortalRows(rows, columns, { columnId: "created", direction: "asc" }).map((row) => row.id)
    ).toEqual(["third", "second", "first"]);
  });

  test("keeps null, undefined, and empty values last in both directions", () => {
    const nullableRows = [
      { client: "Zulu", createdAt: 10, id: "z", status: "Open" },
      { client: "", createdAt: 0, id: "empty", status: "Open" },
      { client: null as unknown as string, createdAt: 0, id: "null", status: "Open" },
      { client: "Alpha", createdAt: 5, id: "a", status: "Open" },
    ];
    expect(
      sortPortalRows(nullableRows, columns, { columnId: "client", direction: "asc" }).map(
        (row) => row.id
      )
    ).toEqual(["a", "z", "empty", "null"]);
    expect(
      sortPortalRows(nullableRows, columns, { columnId: "client", direction: "desc" }).map(
        (row) => row.id
      )
    ).toEqual(["z", "a", "empty", "null"]);
  });

  test("hides only columns explicitly marked hideable", () => {
    expect(
      visiblePortalColumns(columns, new Set(["client", "created", "status"])).map(
        (column) => column.id
      )
    ).toEqual(["client", "status"]);
  });

  test("preserves stable ids and fills presentation defaults for typed columns", () => {
    const prepared = preparePortalColumns([
      { id: "client", kind: "identity", label: "Client", render: (row: Row) => row.client },
      { id: "status", kind: "status", label: "Status", render: (row: Row) => row.status },
      { id: "action", kind: "action", label: "Action", render: () => "Open" },
    ]);

    expect(prepared.map((column) => column.id)).toEqual(["client", "status", "action"]);
    expect(prepared.map((column) => column.mobile)).toEqual(["primary", "status", "action"]);
    expect(prepared.map((column) => column.sticky)).toEqual(["left", "none", "right"]);
    expect(prepared[0]?.render(rows[0])).toBe("Zulu");
  });

  test("normalizes explicit desktop and mobile presentation metadata", () => {
    const [column] = preparePortalColumns([
      {
        id: "owner",
        kind: "data" as const,
        label: "Owner",
        mobile: "primary" as const,
        priority: 4,
        render: () => "Nina",
        sticky: "left" as const,
        width: 220,
      },
    ]);

    expect(column).toMatchObject({
      id: "owner",
      mobile: "primary",
      priority: 4,
      sticky: "left",
      width: 220,
    });
  });

  test("rejects duplicate identities and hideable critical columns", () => {
    expect(() =>
      preparePortalColumns([
        { id: "client", label: "Client", render: () => "A" },
        { id: "client", label: "Duplicate", render: () => "B" },
      ])
    ).toThrow("Duplicate portal grid column id: client");
    expect(() =>
      preparePortalColumns([
        { hideable: true, id: "action", kind: "action", label: "Action", render: () => "Open" },
      ])
    ).toThrow("Critical portal grid column cannot be hidden: action");
  });

  test("clears an active sort when its column becomes hidden", () => {
    const visible = visiblePortalColumns(columns, new Set(["created"]));
    expect(reconcilePortalSort({ columnId: "created", direction: "desc" }, visible)).toBeNull();
    expect(reconcilePortalSort({ columnId: "client", direction: "asc" }, visible)).toEqual({
      columnId: "client",
      direction: "asc",
    });
  });
});
