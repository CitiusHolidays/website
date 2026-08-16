import { ConvexError } from "convex/values";
import type { RuntimeObject } from "../lib/runtimeValues";
import { queryRequiresTicketingWork } from "./jobCardNotifications";
import type {
  ContractingProgress,
  ContractingStatus,
  LeadStage,
  LostReason,
  QueryStatusArgs,
  SalesDecision,
  SalesStatus,
} from "./queryValidators";

type QueryStatusPatch = RuntimeObject;

export type SalesDecisionCommand = {
  approxMargin?: number;
  commandId?: string;
  confirmedPax?: number;
  destination?: string;
  lostReason?: LostReason;
  lostReasonOther?: string;
  proposalId?: string;
  proposalRevision?: number;
  queryId: string;
  salesStatus: SalesDecision;
  travelEndDate?: string;
  travelStartDate?: string;
};

export type ContractingProgressCommand = {
  contractingAirlinesCost?: number;
  contractingLandCost?: number;
  contractingStatus: ContractingProgress;
  contractingVisaCost?: number;
  queryId: string;
};

const SALES_DECISION_FIELDS = new Set([
  "approxMargin",
  "commandId",
  "confirmedPax",
  "destination",
  "lostReason",
  "lostReasonOther",
  "proposalId",
  "proposalRevision",
  "queryId",
  "salesStatus",
  "travelEndDate",
  "travelStartDate",
]);

function supplied(args: RuntimeObject, field: string) {
  return field in args && args[field] !== undefined;
}

export function assertSalesDecisionFieldsAllowed(args: SalesDecisionCommand) {
  for (const field of Object.keys(args)) {
    if (!SALES_DECISION_FIELDS.has(field)) {
      throw new ConvexError(`Sales Decision does not accept ${field}.`);
    }
  }
  const decisionFields = {
    "Date/Destination Change Required": new Set([
      "destination",
      "travelEndDate",
      "travelStartDate",
    ]),
    "Order Confirmed": new Set([
      "approxMargin",
      "commandId",
      "confirmedPax",
      "destination",
      "proposalId",
      "proposalRevision",
      "travelEndDate",
      "travelStartDate",
    ]),
    "Order Lost": new Set(["lostReason", "lostReasonOther"]),
    "Proposal in discussion": new Set(),
  } satisfies Record<SalesDecision, Set<string>>;
  const always = new Set(["queryId", "salesStatus"]);
  for (const field of SALES_DECISION_FIELDS) {
    if (
      always.has(field) ||
      decisionFields[args.salesStatus].has(field) ||
      !supplied(args, field)
    ) {
      continue;
    }
    throw new ConvexError(`${args.salesStatus} does not accept ${field}.`);
  }
  if (args.salesStatus === "Order Lost") {
    if (!args.lostReason) {
      throw new ConvexError("Select a lost reason.");
    }
    if (args.lostReason === "Other" && !args.lostReasonOther?.trim()) {
      throw new ConvexError("Enter the other lost reason.");
    }
  }
  if (args.salesStatus === "Order Confirmed") {
    if (!args.commandId?.trim()) {
      throw new ConvexError("Command ID is required to confirm an order");
    }
    if (!args.proposalId?.trim()) {
      throw new ConvexError("Select the handed-off proposal before confirming the order.");
    }
    if (!(Number.isSafeInteger(args.proposalRevision) && Number(args.proposalRevision) > 0)) {
      throw new ConvexError("Select an exact handed-off proposal revision before confirming.");
    }
  }
}

export function buildSalesDecisionPatch({
  args,
  now,
}: {
  args: SalesDecisionCommand;
  now: number;
}): QueryStatusPatch {
  assertSalesDecisionFieldsAllowed(args);
  const patch: QueryStatusPatch = { salesStatus: args.salesStatus, updatedAt: now };
  if (args.salesStatus === "Order Confirmed") {
    Object.assign(patch, {
      approxMargin: args.approxMargin === undefined ? undefined : Math.max(args.approxMargin, 0),
      confirmedAt: now,
      contractingStatus: "Order Confirmed",
      leadStage: "Confirmation",
      lostReason: undefined,
      lostReasonOther: undefined,
      reassignToTeams: false,
    });
    if (args.confirmedPax !== undefined) {
      patch.paxCount = Math.max(args.confirmedPax, 1);
    }
  } else if (args.salesStatus === "Order Lost") {
    Object.assign(patch, {
      contractingStatus: "Order Lost",
      leadStage: "Lost",
      lostReason: args.lostReason,
      lostReasonOther: args.lostReasonOther?.trim() || "",
      reassignToTeams: false,
    });
  } else if (args.salesStatus === "Date/Destination Change Required") {
    Object.assign(patch, {
      contractingStatus: "Proposal in progress",
      leadStage: "Negotiation",
      lostReason: undefined,
      lostReasonOther: undefined,
      reassignToTeams: true,
    });
  } else {
    Object.assign(patch, {
      leadStage: "Proposal",
      lostReason: undefined,
      lostReasonOther: undefined,
      reassignToTeams: false,
    });
  }
  if (args.destination !== undefined) {
    patch.destination = args.destination.trim();
  }
  if (args.travelStartDate !== undefined) {
    patch.travelStartDate = args.travelStartDate;
  }
  if (args.travelEndDate !== undefined) {
    patch.travelEndDate = args.travelEndDate;
  }
  return patch;
}

export function buildContractingProgressPatch({
  args,
  now,
}: {
  args: ContractingProgressCommand;
  now: number;
}): QueryStatusPatch {
  const patch: QueryStatusPatch = {
    contractingStatus: args.contractingStatus,
    updatedAt: now,
  };
  if (args.contractingLandCost !== undefined) {
    patch.contractingLandCost = Math.max(args.contractingLandCost, 0);
  }
  if (args.contractingAirlinesCost !== undefined) {
    patch.contractingAirlinesCost = Math.max(args.contractingAirlinesCost, 0);
  }
  if (args.contractingVisaCost !== undefined) {
    patch.contractingVisaCost = Math.max(args.contractingVisaCost, 0);
  }
  return patch;
}

function formatRevisionDate(value?: string) {
  if (!value?.trim()) {
    return "Not set";
  }
  const [year, month, day] = value.split("-");
  if (!(year && month && day)) {
    return value;
  }
  return `${day}/${month}/${year}`;
}

function formatRevisionWindow(start?: string, end?: string) {
  const startLabel = formatRevisionDate(start);
  const endLabel = formatRevisionDate(end);
  if (startLabel === "Not set" && endLabel === "Not set") {
    return "Not set";
  }
  if (endLabel === "Not set" || startLabel === endLabel) {
    return startLabel;
  }
  return `${startLabel} – ${endLabel}`;
}

export function assertRevisionHasActualChange(
  current: {
    destination?: string;
    travelEndDate?: string;
    travelStartDate?: string;
  },
  args: QueryStatusArgs
) {
  if (args.salesStatus !== "Date/Destination Change Required") {
    return;
  }
  const nextDestination = args.destination?.trim() ?? current.destination?.trim() ?? "";
  const nextStart = args.travelStartDate ?? current.travelStartDate ?? "";
  const nextEnd = args.travelEndDate ?? current.travelEndDate ?? "";
  const destinationChanged = nextDestination !== (current.destination?.trim() ?? "");
  const startChanged = nextStart !== (current.travelStartDate ?? "");
  const endChanged = nextEnd !== (current.travelEndDate ?? "");
  if (!(destinationChanged || startChanged || endChanged)) {
    throw new ConvexError(
      "Change at least one destination or travel date before submitting revision."
    );
  }
}

export function assertConfirmedQueryIsTerminal(
  current: { contractingStatus: string; salesStatus: string },
  args: QueryStatusArgs
) {
  const terminalStatus = [current.salesStatus, current.contractingStatus].find((status) =>
    ["Order Confirmed", "Order Lost"].includes(status)
  );
  if (terminalStatus) {
    throw new ConvexError(
      `${terminalStatus} is final. Use the linked workflow rather than changing the Sales Decision.`
    );
  }
}

export function buildQueryStatusPatch({
  args,
  now,
}: {
  args: QueryStatusArgs;
  now: number;
}): QueryStatusPatch {
  if (args.salesStatus && !args.contractingStatus && !args.leadStage) {
    // SAFETY: the branch requires only salesStatus and excludes every conflicting command field.
    return buildSalesDecisionPatch({ args: args as SalesDecisionCommand, now });
  }
  if (args.contractingStatus && !args.salesStatus && !args.leadStage) {
    if (["Order Confirmed", "Order Lost"].includes(args.contractingStatus)) {
      throw new ConvexError("Contracting Progress cannot set a terminal Sales Decision.");
    }
    // SAFETY: the branch requires only contractingStatus and excludes every conflicting command field.
    return buildContractingProgressPatch({ args: args as ContractingProgressCommand, now });
  }
  throw new ConvexError(
    "Use one Sales Decision or one Contracting Progress command; mixed status updates are rejected."
  );
}

type CurrentQueryStatus = {
  destination?: string;
  queryCode: string;
  salesStatus: SalesStatus;
  leadStage?: LeadStage | "Closed";
  contractingStatus: ContractingStatus;
  contractingOwnerId?: string;
  ticketingOwnerId?: string;
  ticketingScope?: string;
  travelEndDate?: string;
  travelStartDate?: string;
};

type PlannedRoleNotification = {
  roles: string[];
  title: string;
  body: string;
  emailRoles?: string[];
};

type PlannedOwnerNotification = {
  ownerId: string;
  title: string;
  body: string;
};

export function buildRevisionNotificationBody(current: CurrentQueryStatus, args: QueryStatusArgs) {
  const oldDestination = current.destination?.trim() || "Not set";
  const newDestination = (args.destination ?? current.destination)?.trim() || "Not set";
  const oldDates = formatRevisionWindow(current.travelStartDate, current.travelEndDate);
  const newDates = formatRevisionWindow(
    args.travelStartDate ?? current.travelStartDate,
    args.travelEndDate ?? current.travelEndDate
  );
  return `${current.queryCode} needs a revised proposal. Destination: ${oldDestination} → ${newDestination}. Travel dates: ${oldDates} → ${newDates}.`;
}

export function buildQueryStatusNotificationPlan({
  current,
  args,
  isNewlyConfirmed,
}: {
  current: CurrentQueryStatus;
  args: QueryStatusArgs;
  wasConfirmed: boolean;
  isNewlyConfirmed: boolean;
}) {
  const roleNotifications: PlannedRoleNotification[] = [];
  const ownerNotifications: PlannedOwnerNotification[] = [];
  const addOwnerNotification = (
    ownerId: string | undefined,
    notification: Omit<PlannedOwnerNotification, "ownerId">
  ) => {
    if (!ownerId || ownerNotifications.some((entry) => entry.ownerId === ownerId)) {
      return;
    }
    ownerNotifications.push({ ownerId, ...notification });
  };

  if (args.salesStatus === "Date/Destination Change Required") {
    const revisionBody = buildRevisionNotificationBody(current, args);
    addOwnerNotification(current.contractingOwnerId, {
      body: revisionBody,
      title: "Revise proposal",
    });
    if (queryRequiresTicketingWork(current)) {
      addOwnerNotification(current.ticketingOwnerId, {
        body: revisionBody,
        title: "Revise proposal costing",
      });
      roleNotifications.push({
        body: revisionBody,
        roles: ["Head of Ticketing"],
        title: "Sales revision — ticketing oversight",
      });
    }
    roleNotifications.push(
      {
        body: revisionBody,
        roles: ["Contracting Head"],
        title: "Sales revision — contracting oversight",
      },
      {
        body: revisionBody,
        roles: ["Operations Head"],
        title: "Sales revision — operations oversight",
      }
    );
  }

  if (args.salesStatus === "Order Lost") {
    roleNotifications.push({
      body: `${current.queryCode} was marked lost by Sales.`,
      roles: ["Contracting", "Contracting Head"],
      title: "Order lost",
    });
    addOwnerNotification(current.contractingOwnerId, {
      body: `${current.queryCode} was marked lost by Sales.`,
      title: "Order lost on your query",
    });
    addOwnerNotification(current.ticketingOwnerId, {
      body: `${current.queryCode} was marked lost by Sales.`,
      title: "Order lost on your query",
    });
  }

  if (isNewlyConfirmed) {
    roleNotifications.push({
      body: `${current.queryCode} has been confirmed by Sales.`,
      roles: ["Finance"],
      title: "Order confirmed",
    });
  }

  return {
    notifyJobCardCreators: isNewlyConfirmed,
    notifyOrderConfirmedWorkflow: isNewlyConfirmed,
    ownerNotifications,
    roleNotifications,
  };
}
