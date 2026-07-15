import { describe, expect, test } from "bun:test";
import { getContractingAttention } from "./contractingListPresentation";
import { getJobCardAttention } from "./jobCardListPresentation";
import { CANONICAL_TICKET_STATUSES, getTicketAttention } from "./ticketListPresentation";

const NOW = Date.parse("2026-07-13T12:00:00.000Z");
const ASSIGNED = {
  contractingOwnerId: "contracting-1",
  ticketingOwnerId: "ticketing-1",
  ticketingScope: "International",
};

describe("portal workflow presentation policy", () => {
  test("classifies Contracting unassigned, waiting, blocked, overdue, With Sales, and healthy work", () => {
    expect(getContractingAttention({})).toEqual({
      label: "Contracting SPOC unassigned",
      tone: "warning",
    });
    expect(getContractingAttention({ ...ASSIGNED, submittedToContractingAt: NOW }, NOW)).toEqual({
      label: "Waiting — proposal not started",
      tone: "warning",
    });
    expect(
      getContractingAttention(
        { ...ASSIGNED, submittedToContractingAt: "2026-07-08T12:00:00.000Z" },
        NOW
      )
    ).toEqual({ label: "Proposal overdue — 5 days since received", tone: "warning" });
    expect(
      getContractingAttention({
        ...ASSIGNED,
        contractingStatus: "Date/Destination Change Required",
      })
    ).toEqual({ label: "Blocked — Sales revision required", tone: "danger" });
    expect(getContractingAttention({ ...ASSIGNED, proposal: { status: "Sent" } })).toEqual({
      label: "With Sales — awaiting Sales Decision",
      tone: "info",
    });
    expect(
      getContractingAttention({
        ...ASSIGNED,
        proposal: { sentToClientAt: "2026-07-13T12:00:00.000Z", status: "Sent" },
      })
    ).toEqual({ label: "Client delivery recorded" });
    expect(
      getContractingAttention({
        ...ASSIGNED,
        proposal: { pricingEnteredAt: "2026-07-13", status: "Draft" },
      })
    ).toBeUndefined();
  });

  test("names every missing Job Card owner independently", () => {
    expect(getJobCardAttention({ operationsOwnerName: "Ops" })).toEqual({
      label: "Missing owners: Contracting, Ticketing",
      tone: "warning",
    });
    expect(
      getJobCardAttention({
        contractingOwnerName: "Contracting",
        operationsOwnerName: "Ops",
        ticketingOwnerName: "Ticketing",
      })
    ).toBeUndefined();
    expect(
      getJobCardAttention({
        contractingOwnerName: "Contracting",
        operationsOwnerName: "Ops",
        ticketingRequired: false,
      })
    ).toBeUndefined();
  });

  test("has an explicit attention result for every canonical Ticketing status", () => {
    expect(CANONICAL_TICKET_STATUSES.map((status) => [status, getTicketAttention(status)])).toEqual(
      [
        ["Pending Issue", { label: "Pending issue — ticket not issued", tone: "warning" }],
        ["Issued", { label: "Issued — no open exception" }],
        ["Name Change Required", { label: "Blocked — name change required", tone: "danger" }],
        ["Reissue Required", { label: "Blocked — reissue required", tone: "danger" }],
        ["Cancelled", { label: "Cancelled — review refund requirements", tone: "info" }],
        ["Refund Pending", { label: "Refund pending", tone: "warning" }],
        ["Refunded", { label: "Refunded — no open exception" }],
      ]
    );
  });
});
