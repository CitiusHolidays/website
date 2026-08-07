import { describe, expect, test } from "bun:test";
import { preparePortalColumns } from "./portalDataGrid";

interface Row {
  client: string;
  createdAt: number;
  id: string;
  status: string;
}

const rows: Row[] = [
  { client: "Zulu", createdAt: 10, id: "second", status: "Open" },
  { client: "Alpha", createdAt: 10, id: "first", status: "Open" },
  { client: "Bravo", createdAt: 5, id: "third", status: "Open" },
];

describe("portal data grid presentation contract", () => {
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
});
