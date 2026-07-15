import { ConvexError } from "convex/values";
import type { ContractingStatus, LeadStage, QueryStatusArgs, SalesStatus } from "./queryValidators";

type QueryStatusPatch = Record<string, unknown>;

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
  queryCode: string;
  salesStatus: SalesStatus;
  leadStage?: LeadStage;
  contractingStatus: ContractingStatus;
  contractingOwnerId?: string;
  ticketingOwnerId?: string;
};

type PlannedRoleNotification = {
  roles: string[];
  title: string;
  body: string;
};

type PlannedOwnerNotification = {
  ownerId: string;
  title: string;
  body: string;
};

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
    addOwnerNotification(current.contractingOwnerId, {
      body: `${current.queryCode} was sent back by Sales for a date or destination change.`,
      title: "Revise proposal",
    });
    addOwnerNotification(current.ticketingOwnerId, {
      body: `${current.queryCode} needs updated ticketing inputs for the revised proposal.`,
      title: "Revise proposal costing",
    });
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
