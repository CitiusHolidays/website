import { beforeAll, describe, expect, mock, test } from "bun:test";
import { createElement, isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";

let QueriesView;
let PortalToastProvider;
let rowActions = [];

beforeAll(async () => {
  mock.module("@/components/portal/QueryRowActions", () => ({
    QueryRowActions: (props) => {
      rowActions.push(props);
      return null;
    },
  }));
  // Only the action column matters here; the real table also renders a mobile card per row.
  mock.module("@/components/portal/SelectableDataTable", () => ({
    SelectableDataTable: ({ columns, rows }) =>
      rows.map((row) =>
        createElement(
          "div",
          { key: row.id },
          columns.find((column) => column.id === "action").render(row)
        )
      ),
  }));
  ({ PortalToastProvider } = await import("@/components/portal/PortalToast"));
  ({ QueriesView } = await import("./QueriesView"));
});

function describeAction(action) {
  if (!isValidElement(action)) {
    return null;
  }
  return { className: action.props.className, text: renderToStaticMarkup(action) };
}

function actionText(action) {
  const described = describeAction(action);
  return described ? described.text.replace(/<[^>]+>/g, "") : null;
}

function renderActions({ permissions, roles, row }) {
  rowActions = [];
  const opened = [];
  const submitted = [];
  renderToStaticMarkup(
    createElement(
      PortalToastProvider,
      null,
      createElement(QueriesView, {
        access: { permissions, roles },
        deleteItem: () => undefined,
        getFinalizedPdfUrl: () => "",
        getQueryAttachmentUrl: () => "",
        has: (permission) => permissions.includes(permission),
        loading: true,
        openModal: (...args) => opened.push(args),
        removeQuery: () => undefined,
        rows: [{ clientName: "Acme", id: "query-1", queryCode: "Q-1", ...row }],
        submitToContracting: (args) => submitted.push(args),
      })
    )
  );
  const [props] = rowActions;
  return { opened, props, submitted };
}

describe("Query row actions", () => {
  test("Puts Submit to Contracting first before handoff, with the decision in the overflow", () => {
    const { props, submitted } = renderActions({
      permissions: [P.MANAGE_QUERIES],
      roles: ["Sales"],
      row: { salesStatus: "Proposal in discussion" },
    });
    expect(actionText(props.primaryAction)).toBe("Submit to Contracting");
    expect(props.overflowActions.map(actionText)).toEqual([
      "Files",
      "Edit query",
      "Reference Itinerary",
      "Sales Decision",
      "Assign contracting",
      null,
    ]);
    expect(describeAction(props.overflowActions[3]).className).toBe("portal-small-btn");
    props.primaryAction.props.onClick();
    expect(submitted).toEqual([{ queryId: "query-1" }]);
  });

  test("Makes the decision primary after handoff and lets Admin delete", () => {
    const { opened, props } = renderActions({
      permissions: [P.MANAGE_QUERIES],
      roles: ["Admin"],
      row: { salesStatus: "Proposal in discussion", submittedToContractingAt: 5 },
    });
    expect(describeAction(props.primaryAction)?.className).toBe("portal-primary-btn");
    expect(actionText(props.primaryAction)).toBe("Sales Decision");
    expect(props.overflowActions.map((action) => (action ? (action.key ?? "") : null))).toEqual([
      "commercial-files",
      "edit",
      "reference-itinerary",
      null,
      "assign",
      "delete",
    ]);
    props.primaryAction.props.onClick();
    expect(opened.map(([modal]) => modal)).toEqual(["salesDecision"]);
  });

  test("Gives a head without query management only Assign teams, plus Files", () => {
    const { opened, props } = renderActions({
      permissions: [],
      roles: ["Contracting Head"],
      row: { submittedToContractingAt: 5 },
    });
    expect(describeAction(props.primaryAction)?.className).toBe("portal-primary-btn");
    expect(actionText(props.primaryAction)).toBe("Assign teams");
    expect(props.overflowActions.map(actionText)).toEqual(["Files"]);
    props.primaryAction.props.onClick();
    expect(opened).toEqual([["assignQueryTeams", { queryId: "query-1" }]]);
  });

  test("Offers only Files when no workflow step is available", () => {
    const { opened, props } = renderActions({ permissions: [], roles: ["Sales"], row: {} });
    expect("primaryAction" in props).toBe(false);
    expect(props.label).toBe("Q-1");
    expect(props.overflowActions.map(actionText)).toEqual(["Files"]);
    props.overflowActions[0].props.onClick();
    expect(opened).toEqual([["commercialFiles", { entityId: "query-1", entryPoint: "query" }]]);
  });
});
