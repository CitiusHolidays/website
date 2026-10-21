import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { authorizedCustomerIdentityIds } from "../lib/customerIdentityAccess";
import { hasOwnKey } from "../lib/runtimeValues";
import { canSeeJobCardRecord, canSeeProposalRecord, canSeeQueryRecord } from "./lib/recordScope";
import { PERMISSIONS as P } from "./lib/rolePolicy";
import type { PortalAccess } from "./lib/staffAccess";
import { requiresTicketingSpocAssignment } from "./ticketingIntakePolicy";

// A bounded lower bound of existing workflow queues, independent of inbox reads.
const READ_LIMIT = 120;
export const NAVIGATION_EVENT_LIMIT = 24;
const TICKET_WORK = [
  "Pending Issue",
  "Name Change Required",
  "Reissue Required",
  "Refund Pending",
] as const;
const DESTINATIONS = {
  "/portal/contracting": P.VIEW_CONTRACTING,
  "/portal/job-cards": P.VIEW_JOB_CARDS,
  "/portal/proposals": P.VIEW_PROPOSALS,
  "/portal/queries": P.VIEW_QUERIES,
  "/portal/ticketing": P.VIEW_TICKETING,
  "/portal/tickets": P.VIEW_TICKETING,
};
export interface NavigationWorkState {
  complete: boolean;
  count: number;
  eventIds: Id<"notifications">[];
  newActivity: boolean;
}
type WorkCount = Pick<NavigationWorkState, "complete" | "count">;
interface Job {
  linked: Doc<"queries"> | null;
  row: Doc<"jobCards">;
}
interface Reader {
  access: PortalAccess;
  authIds: string[];
  ctx: QueryCtx;
  job: (id: Id<"jobCards">) => Promise<Job | null>;
  proposalQueries: (
    row: Doc<"proposals">
  ) => Promise<{ complete: boolean; linked: Doc<"queries">[] }>;
  query: (id?: Id<"queries">) => Promise<Doc<"queries"> | null>;
}
const hasRole = (access: PortalAccess, roles: string[]) =>
  roles.some((role) => access.roles.includes(role));
const owns = (access: PortalAccess, staffId?: string) =>
  Boolean(staffId && access.staffId === staffId);
const openQuery = (row: Doc<"queries">) =>
  !["Order Confirmed", "Order Lost"].includes(row.salesStatus);
const salesHead = (access: PortalAccess) => hasRole(access, ["Sales Head", "Admin", "Directors"]);
const contractingHead = (access: PortalAccess) =>
  hasRole(access, ["Contracting Head", "Admin", "Directors"]);
const operationsHead = (access: PortalAccess) =>
  hasRole(access, ["Operations Head", "Admin", "Directors"]);
const ticketingHead = (access: PortalAccess) =>
  hasRole(access, ["Head of Ticketing", "Admin", "Directors"]);
const ticketRelated = (access: PortalAccess, row: Doc<"jobCards">) =>
  owns(access, row.operationsOwnerId) ||
  owns(access, row.ticketingOwnerId) ||
  hasRole(access, ["Operations Head", "Head of Ticketing"]);
function uniqueRows<Row extends { _id: string }>(batches: Row[][]) {
  return [...new Map(batches.flat().map((row) => [row._id, row])).values()];
}
function summary(batches: { _id: string }[][], matches: boolean[]): WorkCount {
  return {
    complete: batches.every((batch) => batch.length <= READ_LIMIT),
    count: matches.filter(Boolean).length,
  };
}
function visibleQuery(reader: Reader, row: Doc<"queries">) {
  return reader.authIds.some((authUserId) =>
    canSeeQueryRecord({ ...reader.access, authUserId }, row)
  );
}
function salesWork(reader: Reader, row: Doc<"queries">) {
  return (
    openQuery(row) &&
    visibleQuery(reader, row) &&
    (Boolean(row.salesOwnerId && reader.authIds.includes(row.salesOwnerId)) ||
      (!row.salesOwnerId && salesHead(reader.access)))
  );
}
function contractingWork(reader: Reader, row: Doc<"queries">) {
  return (
    openQuery(row) &&
    visibleQuery(reader, row) &&
    Boolean(row.submittedToContractingAt) &&
    (owns(reader.access, row.contractingOwnerId) ||
      (!row.contractingOwnerId && contractingHead(reader.access)))
  );
}
function ownJob(access: PortalAccess, row: Doc<"jobCards">) {
  return (
    owns(access, row.contractingOwnerId) ||
    owns(access, row.operationsOwnerId) ||
    owns(access, row.ticketingOwnerId)
  );
}
function jobWork(reader: Reader, work: Job | null) {
  if (!work || work.row.status === "Closed") {
    return false;
  }
  const { access } = reader;
  const { row, linked } = work;
  return (
    ownJob(access, row) ||
    (!row.operationsOwnerId && operationsHead(access)) ||
    (!row.contractingOwnerId && contractingHead(access)) ||
    (!row.ticketingOwnerId &&
      ticketingHead(access) &&
      requiresTicketingSpocAssignment(linked?.ticketingScope))
  );
}
function proposalWork(reader: Reader, row: Doc<"proposals">, linked: Doc<"queries">[]) {
  const { access } = reader;
  const visible = reader.authIds.some((authUserId) =>
    canSeeProposalRecord({ ...access, authUserId }, row, linked)
  );
  return (
    visible &&
    (row.collaboratorStaffIds?.some((id) => owns(access, id)) ||
      linked.some(
        (item) =>
          item.salesStatus !== "Order Lost" &&
          (owns(access, item.contractingOwnerId) ||
            (!item.contractingOwnerId && contractingHead(access)))
      ) ||
      (!linked.length && reader.authIds.includes(row.createdBy)))
  );
}

async function createReader(
  ctx: QueryCtx,
  access: PortalAccess,
  identityIds?: string[]
): Promise<Reader> {
  let authIds = identityIds;
  if (!authIds) {
    const identity = await ctx.auth.getUserIdentity();
    authIds = identity ? await authorizedCustomerIdentityIds(ctx, identity) : [];
  }
  const queries = new Map<string, Promise<Doc<"queries"> | null>>();
  const jobs = new Map<string, Promise<Job | null>>();
  const proposals = new Map<string, ReturnType<Reader["proposalQueries"]>>();
  const query: Reader["query"] = (id) => {
    if (!id) {
      return Promise.resolve(null);
    }
    const pending = queries.get(id) ?? ctx.db.get("queries", id);
    queries.set(id, pending);
    return pending;
  };
  const loadJob = async (id: Id<"jobCards">): Promise<Job | null> => {
    const row = await ctx.db.get("jobCards", id);
    if (!row) {
      return null;
    }
    const linked = await query(row.queryId);
    return authIds.some((authUserId) => canSeeJobCardRecord({ ...access, authUserId }, row, linked))
      ? { linked, row }
      : null;
  };
  const loadProposalQueries: Reader["proposalQueries"] = async (row) => {
    const links = await ctx.db
      .query("proposalQueryLinks")
      .withIndex("by_proposalId", (q) => q.eq("proposalId", row._id))
      .take(65);
    const ids = new Set(links.map((link) => link.queryId));
    if (row.queryId) {
      ids.add(row.queryId);
    }
    const linked = (await Promise.all([...ids].map(query))).filter(
      (entry): entry is Doc<"queries"> => entry !== null
    );
    return { complete: links.length < 65, linked };
  };
  return {
    access,
    authIds,
    ctx,
    job: (id) => {
      const pending = jobs.get(id) ?? loadJob(id);
      jobs.set(id, pending);
      return pending;
    },
    proposalQueries: (row) => {
      const pending = proposals.get(row._id) ?? loadProposalQueries(row);
      proposals.set(row._id, pending);
      return pending;
    },
    query,
  };
}
async function salesCount(reader: Reader) {
  const owners: (string | undefined)[] = [...reader.authIds];
  if (salesHead(reader.access)) {
    owners.push(undefined);
  }
  const batches = await Promise.all(
    owners.map((id) =>
      reader.ctx.db
        .query("queries")
        .withIndex("by_salesOwnerId", (q) => q.eq("salesOwnerId", id))
        .take(READ_LIMIT + 1)
    )
  );
  return summary(
    batches,
    uniqueRows(batches).map((row) => salesWork(reader, row))
  );
}
async function contractingCount(reader: Reader) {
  const owners = reader.access.staffId ? [reader.access.staffId] : [];
  const batches = owners.map((id) =>
    reader.ctx.db
      .query("queries")
      .withIndex("by_contractingOwnerId", (q) => q.eq("contractingOwnerId", id))
      .take(READ_LIMIT + 1)
  );
  if (contractingHead(reader.access)) {
    batches.push(
      reader.ctx.db
        .query("queries")
        .withIndex("by_contractingOwnerId", (q) => q.eq("contractingOwnerId", undefined))
        .take(READ_LIMIT + 1)
    );
  }
  const rows = await Promise.all(batches);
  return summary(
    rows,
    uniqueRows(rows).map((row) => contractingWork(reader, row))
  );
}
async function jobCount(reader: Reader) {
  const { ctx, access } = reader;
  const owners = access.staffId ? [access.staffId] : [];
  const batches = owners.flatMap((id) => [
    ctx.db
      .query("jobCards")
      .withIndex("by_contractingOwnerId", (q) => q.eq("contractingOwnerId", id))
      .take(READ_LIMIT + 1),
    ctx.db
      .query("jobCards")
      .withIndex("by_operationsOwnerId", (q) => q.eq("operationsOwnerId", id))
      .take(READ_LIMIT + 1),
    ctx.db
      .query("jobCards")
      .withIndex("by_ticketingOwnerId", (q) => q.eq("ticketingOwnerId", id))
      .take(READ_LIMIT + 1),
  ]);
  if (contractingHead(access)) {
    batches.push(
      ctx.db
        .query("jobCards")
        .withIndex("by_contractingOwnerId", (q) => q.eq("contractingOwnerId", undefined))
        .take(READ_LIMIT + 1)
    );
  }
  if (operationsHead(access)) {
    batches.push(
      ctx.db
        .query("jobCards")
        .withIndex("by_operationsOwnerId", (q) => q.eq("operationsOwnerId", undefined))
        .take(READ_LIMIT + 1)
    );
  }
  if (ticketingHead(access)) {
    batches.push(
      ctx.db
        .query("jobCards")
        .withIndex("by_ticketingOwnerId", (q) => q.eq("ticketingOwnerId", undefined))
        .take(READ_LIMIT + 1)
    );
  }
  const rows = await Promise.all(batches);
  const matches = await Promise.all(
    uniqueRows(rows).map(async (row) => jobWork(reader, await reader.job(row._id)))
  );
  return summary(rows, matches);
}
async function proposalCount(reader: Reader) {
  const rows = await reader.ctx.db
    .query("proposals")
    .withIndex("by_status", (q) => q.eq("status", "Draft"))
    .take(READ_LIMIT + 1);
  const links = await Promise.all(rows.map(reader.proposalQueries));
  return {
    complete: rows.length <= READ_LIMIT && links.every((entry) => entry.complete),
    count: rows.filter((row, index) => proposalWork(reader, row, links[index].linked)).length,
  };
}
async function ticketCount(reader: Reader) {
  const batches = await Promise.all(
    TICKET_WORK.map((status) =>
      reader.ctx.db
        .query("tickets")
        .withIndex("by_ticketStatus", (q) => q.eq("ticketStatus", status))
        .take(READ_LIMIT + 1)
    )
  );
  const matches = await Promise.all(
    uniqueRows(batches).map(async (row) => {
      const work = await reader.job(row.jobCardId);
      return Boolean(
        work && work.row.status !== "Closed" && ticketRelated(reader.access, work.row)
      );
    })
  );
  return summary(batches, matches);
}
async function queryDestinations(reader: Reader, entityId: string) {
  const id = reader.ctx.db.normalizeId("queries", entityId);
  const row = id ? await reader.query(id) : null;
  if (!(row && openQuery(row) && visibleQuery(reader, row))) {
    return [];
  }
  const hrefs: string[] = [];
  if (
    salesWork(reader, row) ||
    hasRole(reader.access, [
      "Sales Head",
      "Contracting Head",
      "Head of Ticketing",
      "Operations Head",
      "Admin",
      "Directors",
    ])
  ) {
    hrefs.push("/portal/queries");
  }
  if (contractingWork(reader, row)) {
    hrefs.push("/portal/contracting");
  }
  return hrefs;
}
async function proposalDestinations(reader: Reader, entityId: string) {
  const id = reader.ctx.db.normalizeId("proposals", entityId);
  const row = id ? await reader.ctx.db.get("proposals", id) : null;
  if (!row || row.status === "Rejected") {
    return [];
  }
  const { linked } = await reader.proposalQueries(row);
  const visible = reader.authIds.some((authUserId) =>
    canSeeProposalRecord({ ...reader.access, authUserId }, row, linked)
  );
  const salesOwner = linked.some((query) =>
    Boolean(query.salesOwnerId && reader.authIds.includes(query.salesOwnerId))
  );
  return visible &&
    (proposalWork(reader, row, linked) ||
      salesOwner ||
      hasRole(reader.access, ["Sales Head", "Contracting Head", "Admin", "Directors"]))
    ? ["/portal/proposals"]
    : [];
}
async function jobDestinations(reader: Reader, entityId: string) {
  const id = reader.ctx.db.normalizeId("jobCards", entityId);
  const work = id ? await reader.job(id) : null;
  if (!work || work.row.status === "Closed") {
    return [];
  }
  const oversight = hasRole(reader.access, [
    "Contracting Head",
    "Operations Head",
    "Head of Ticketing",
    "Admin",
    "Directors",
  ]);
  const salesOwner = Boolean(
    work.linked?.salesOwnerId && reader.authIds.includes(work.linked.salesOwnerId)
  );
  return ownJob(reader.access, work.row) || oversight || salesOwner ? ["/portal/job-cards"] : [];
}
async function ticketDestinations(reader: Reader, entityId: string) {
  const id = reader.ctx.db.normalizeId("tickets", entityId);
  const row = id ? await reader.ctx.db.get("tickets", id) : null;
  if (!(row && TICKET_WORK.some((status) => status === row.ticketStatus))) {
    return [];
  }
  const work = await reader.job(row.jobCardId);
  return work && work.row.status !== "Closed" && ticketRelated(reader.access, work.row)
    ? ["/portal/tickets", "/portal/ticketing"]
    : [];
}
const DESTINATION_READERS = {
  jobCard: jobDestinations,
  proposal: proposalDestinations,
  query: queryDestinations,
  ticket: ticketDestinations,
};
export function canViewDestination(access: PortalAccess, href: string) {
  return hasOwnKey(DESTINATIONS, href) && access.permissions.includes(DESTINATIONS[href]);
}

export async function createNavigationWorkReader(
  ctx: QueryCtx,
  access: PortalAccess,
  identityIds?: string[]
) {
  const reader = await createReader(ctx, access, identityIds);
  const countReaders = {
    "/portal/contracting": contractingCount,
    "/portal/job-cards": jobCount,
    "/portal/proposals": proposalCount,
    "/portal/queries": salesCount,
    "/portal/ticketing": ticketCount,
    "/portal/tickets": ticketCount,
  };
  let tickets: Promise<WorkCount> | undefined;
  return {
    counts: async (): Promise<Record<string, NavigationWorkState>> =>
      Object.fromEntries(
        await Promise.all(
          Object.entries(countReaders)
            .filter(([href]) => canViewDestination(access, href))
            .map(async ([href, read]) => {
              if (read === ticketCount) {
                tickets ??= ticketCount(reader);
              }
              const count = await (tickets && read === ticketCount ? tickets : read(reader));
              return [
                href,
                { ...count, eventIds: [], newActivity: false } satisfies NavigationWorkState,
              ];
            })
        )
      ),
    destinations: async (notice: Pick<Doc<"notifications">, "entityId" | "entityType">) => {
      const type = notice.entityType ?? "";
      if (!(notice.entityId && hasOwnKey(DESTINATION_READERS, type))) {
        return [];
      }
      return (await DESTINATION_READERS[type](reader, notice.entityId)).filter((href) =>
        canViewDestination(access, href)
      );
    },
  };
}
export async function navigationStateForAccess(ctx: QueryCtx, access: PortalAccess) {
  const reader = await createNavigationWorkReader(ctx, access);
  const byHref = await reader.counts();
  const { staffId } = access;
  if (!staffId) {
    return { byHref, viewerKey: "" };
  }
  await Promise.all(
    Object.entries(byHref).map(async ([href, state]) => {
      const activity = await ctx.db
        .query("portalNavigationActivity")
        .withIndex("by_staffId_and_href", (q) => q.eq("staffId", staffId).eq("href", href))
        .unique();
      if (activity) {
        state.eventIds = [activity.notificationId];
        state.newActivity = activity.seenAt === undefined;
      }
    })
  );
  return { byHref, viewerKey: String(staffId) };
}
