import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";

interface ChildRelationIds {
  pnrId?: Id<"pnrs"> | null;
  travellerId?: Id<"travellers"> | null;
}

export function normalizeOptionalChildId<Table extends "pnrs" | "travellers">(
  ctx: any,
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
  ctx: any,
  jobCardId: Id<"jobCards">,
  { travellerId, pnrId }: ChildRelationIds
) {
  const [traveller, pnr] = await Promise.all([
    travellerId ? ctx.db.get(travellerId) : null,
    pnrId ? ctx.db.get(pnrId) : null,
  ]);

  if (travellerId && (!traveller || traveller.jobCardId !== jobCardId)) {
    throw new ConvexError("Traveller does not belong to this Job Card");
  }
  if (pnrId && (!pnr || pnr.jobCardId !== jobCardId)) {
    throw new ConvexError("PNR does not belong to this Job Card");
  }
}
