import { ConvexError } from "convex/values";
import { queryRequiresTicketingWork } from "./jobCardNotifications";
import type { ContractingStatus, LeadStage, QueryStatusArgs, SalesStatus } from "./queryValidators";

type QueryStatusPatch = Record<string, unknown>;

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
  const isConfirmed =
    current.salesStatus === "Order Confirmed" || current.contractingStatus === "Order Confirmed";
  const changesConfirmedState =
    (args.salesStatus !== undefined && args.salesStatus !== "Order Confirmed") ||
    (args.contractingStatus !== undefined && args.contractingStatus !== "Order Confirmed");
  if (isConfirmed && changesConfirmedState) {
    throw new ConvexError(
      "Order Confirmed is final. Edit trip details without changing the decision."
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
  if (args.contractingStatus === "Order Lost") {
    throw new ConvexError("Only Sales can mark an order as lost");
  }
  if (args.salesStatus === "Order Lost" && !args.lostReason) {
    throw new ConvexError("Select a lost reason.");
  }

  const patch: QueryStatusPatch = {
    updatedAt: now,
  };
  if (args.salesStatus) {
    patch.salesStatus = args.salesStatus;
    if (args.salesStatus === "Order Confirmed") {
      patch.contractingStatus = "Order Confirmed";
      patch.leadStage = "Confirmation";
      patch.confirmedAt = now;
      patch.reassignToTeams = false;
    }
    if (args.salesStatus === "Order Lost") {
      patch.contractingStatus = "Order Lost";
      patch.leadStage = "Lost";
      patch.reassignToTeams = false;
    }
    if (args.salesStatus === "Date/Destination Change Required") {
      patch.contractingStatus = "Proposal in progress";
      patch.leadStage = "Negotiation";
      patch.reassignToTeams = true;
    }
    if (args.salesStatus === "Proposal in discussion") {
      patch.leadStage = "Proposal";
      patch.reassignToTeams = false;
    }
  }
  if (args.leadStage) {
    patch.leadStage = args.leadStage;
  }
  if (args.contractingStatus) {
    patch.contractingStatus = args.contractingStatus;
    if (args.contractingStatus === "Order Confirmed") {
      patch.salesStatus = "Order Confirmed";
      patch.leadStage = "Confirmation";
      patch.confirmedAt = now;
    }
  }
  if (args.lostReason) {
    patch.lostReason = args.lostReason;
    patch.lostReasonOther = args.lostReasonOther?.trim() || "";
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
  if (args.confirmedPax !== undefined) {
    patch.paxCount = Math.max(args.confirmedPax, 1);
  }
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

type CurrentQueryStatus = {
  destination?: string;
  queryCode: string;
  salesStatus: SalesStatus;
  leadStage?: LeadStage;
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
