import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

interface ChildRelationIds {
  pnrId?: Id<"pnrs"> | null;
  travellerId?: Id<"travellers"> | null;
}

export function normalizeOptionalChildId<Table extends "pnrs" | "travellers">(
  ctx: MutationCtx | QueryCtx,
  table: Table,
  value?: string
): Id<Table> | null | undefined {
  if (value === undefined) {
    return;
  }
  if (value === "") {
    return null;
  }
  return ctx.db.normalizeId(table, value);
}

/** Enforce that linked ticketing records stay inside the authorized job card. */
export async function assertJobCardChildRelations(
  ctx: MutationCtx | QueryCtx,
  jobCardId: Id<"jobCards">,
  { travellerId, pnrId }: ChildRelationIds
) {
  const [traveller, pnr] = await Promise.all([
    travellerId ? ctx.db.get("travellers", travellerId) : null,
    pnrId ? ctx.db.get("pnrs", pnrId) : null,
  ]);

  if (travellerId && (!traveller || traveller.jobCardId !== jobCardId)) {
    throw new ConvexError("Traveller does not belong to this Job Card");
  }
  if (pnrId && (!pnr || pnr.jobCardId !== jobCardId)) {
    throw new ConvexError("PNR does not belong to this Job Card");
  }
}
