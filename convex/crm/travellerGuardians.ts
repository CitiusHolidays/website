import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { propertiesWhen } from "../lib/runtimeValues";
import { getVisibleJob } from "./importProcessor";
import type { PortalAccess } from "./lib";
import { patchWithE2eOwnership } from "./lib/e2eOwnership";
import { type TravellerGroupScope, travellerInGroupScope } from "./tourManagerGroupScope";
import {
  type GuardianCandidate,
  guardianLinkProblem,
  nameVariants,
  normalizePersonName,
  resolveGuardianReference,
} from "./travellerGuardianPolicy";

/** Upper bound on one Job Card's roster read when resolving or offering guardians. */
export const GUARDIAN_ROSTER_LIMIT = 2000;
/** Upper bound on the minors one guardian is shown or cleaned up for in one read. */
const GUARDIAN_MINORS_LIMIT = 50;

export function toGuardianCandidate(traveller: Doc<"travellers">): GuardianCandidate {
  return {
    contactNo: traveller.contactNo,
    email: traveller.email,
    fullName: traveller.fullName,
    givenName: traveller.givenName,
    id: String(traveller._id),
    isMinor: traveller.isMinor,
    jobCardId: String(traveller.jobCardId),
    surname: traveller.surname,
  };
}

async function loadJobRoster(ctx: QueryCtx, jobCardId: Id<"jobCards">) {
  const roster = await ctx.db
    .query("travellers")
    .withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
    .take(GUARDIAN_ROSTER_LIMIT + 1);
  if (roster.length > GUARDIAN_ROSTER_LIMIT) {
    throw new ConvexError(
      `Job Card has more than ${GUARDIAN_ROSTER_LIMIT} travellers; link guardians manually`
    );
  }
  return roster;
}

/**
 * Resolves every pending spreadsheet Parent/Guardian reference on one Job Card. Runs once,
 * after the final import batch, so a guardian may appear on any row or batch of the sheet or
 * already be on the Job Card. A reference that does not resolve to exactly one eligible adult
 * stays on the Traveller and is reported; nothing is linked by guesswork.
 */
export async function resolveImportedGuardianLinksHandler(
  ctx: MutationCtx,
  args: { access: PortalAccess; jobCardId: Id<"jobCards"> }
) {
  const job = await getVisibleJob(ctx, args.access, args.jobCardId);
  if (!job) {
    throw new ConvexError("FORBIDDEN");
  }
  const roster = await loadJobRoster(ctx, job._id);
  const candidatesByName = new Map<string, GuardianCandidate[]>();
  for (const candidate of roster.map(toGuardianCandidate)) {
    for (const name of nameVariants(candidate)) {
      candidatesByName.set(name, [...(candidatesByName.get(name) ?? []), candidate]);
    }
  }
  const byId = new Map(roster.map((traveller) => [String(traveller._id), traveller]));
  const now = Date.now();
  let linked = 0;
  const warnings: Array<{
    fullName: string;
    message: string;
    sourceRowNumber?: number;
    sourceSheet?: string;
    travellerId: Id<"travellers">;
  }> = [];
  for (const traveller of roster) {
    const reference = traveller.guardianImportReference;
    if (!reference) {
      continue;
    }
    // Only same-name travellers can match, so the roster is indexed by name once.
    const resolution = resolveGuardianReference(
      toGuardianCandidate(traveller),
      reference,
      candidatesByName.get(normalizePersonName(reference.name)) ?? []
    );
    if (resolution.kind === "linked") {
      const guardian = byId.get(resolution.guardianId);
      if (guardian) {
        // biome-ignore lint/performance/noAwaitInLoops: one bounded Job Card roster, patched in order.
        await patchWithE2eOwnership(
          ctx,
          "travellers",
          traveller._id,
          { guardianImportReference: undefined, guardianTravellerId: guardian._id, updatedAt: now },
          { authUserId: args.access.authUserId }
        );
        linked += 1;
        continue;
      }
    }
    warnings.push({
      fullName: traveller.fullName,
      message:
        resolution.kind === "linked"
          ? "Guardian not linked: the matched traveller no longer exists."
          : resolution.message,
      ...propertiesWhen(traveller.sourceRowNumber !== undefined, () => ({
        sourceRowNumber: traveller.sourceRowNumber,
      })),
      ...propertiesWhen(traveller.sourceSheet, () => ({ sourceSheet: traveller.sourceSheet })),
      travellerId: traveller._id,
    });
  }
  return { linked, warnings };
}

/** Throws the reason a manual guardian link is invalid. */
export function assertGuardianLink(
  minor: Doc<"travellers">,
  nextIsMinor: boolean | undefined,
  guardian: Doc<"travellers"> | null
) {
  if (!guardian) {
    throw new ConvexError("Guardian not found");
  }
  const problem = guardianLinkProblem(
    { ...toGuardianCandidate(minor), isMinor: nextIsMinor },
    toGuardianCandidate(guardian)
  );
  if (problem) {
    throw new ConvexError(problem);
  }
}

export async function minorsCoveredBy(ctx: QueryCtx, guardianId: Id<"travellers">) {
  return await ctx.db
    .query("travellers")
    .withIndex("by_guardianTravellerId", (q) => q.eq("guardianTravellerId", guardianId))
    .take(GUARDIAN_MINORS_LIMIT);
}

/** A deleted guardian leaves its minors unlinked rather than pointing at a missing row. */
export async function clearGuardianLinksTo(
  ctx: MutationCtx,
  guardianId: Id<"travellers">,
  actor: { authUserId?: string | null }
) {
  const minors = await minorsCoveredBy(ctx, guardianId);
  const now = Date.now();
  await Promise.all(
    minors.map((minor) =>
      patchWithE2eOwnership(
        ctx,
        "travellers",
        minor._id,
        { guardianTravellerId: undefined, updatedAt: now },
        actor
      )
    )
  );
}

/**
 * Guardian facts for the Staff Workspace traveller row. Linked people are named only when the
 * reader may already see them under the same Job Card group scope, so a link never discloses a
 * minor (or a guardian) outside the reader's existing traveller access.
 */
export async function travellerGuardianFacts(
  ctx: QueryCtx,
  traveller: Doc<"travellers">,
  scope: TravellerGroupScope
) {
  const guardianDoc = traveller.guardianTravellerId
    ? await ctx.db.get("travellers", traveller.guardianTravellerId)
    : null;
  const guardian =
    guardianDoc &&
    String(guardianDoc.jobCardId) === String(traveller.jobCardId) &&
    travellerInGroupScope(scope, guardianDoc)
      ? { fullName: guardianDoc.fullName, id: guardianDoc._id }
      : null;
  const minors = traveller.isMinor === true ? [] : await minorsCoveredBy(ctx, traveller._id);
  return {
    guardian,
    guardianOf: minors
      .filter(
        (minor) =>
          String(minor.jobCardId) === String(traveller.jobCardId) &&
          travellerInGroupScope(scope, minor)
      )
      .map((minor) => ({ fullName: minor.fullName, id: minor._id })),
    guardianSheetReference: traveller.guardianImportReference?.name ?? "",
    isMinor: traveller.isMinor ?? null,
  };
}

/** Adults (or travellers of unrecorded age) on the same Job Card, visible to the reader. */
export async function guardianOptionsFor(
  ctx: QueryCtx,
  traveller: Doc<"travellers">,
  scope: TravellerGroupScope
) {
  const roster = await loadJobRoster(ctx, traveller.jobCardId);
  return roster
    .filter(
      (candidate) =>
        candidate._id !== traveller._id &&
        candidate.isMinor !== true &&
        travellerInGroupScope(scope, candidate)
    )
    .map((candidate) => ({ fullName: candidate.fullName, id: candidate._id }))
    .sort((left, right) => left.fullName.localeCompare(right.fullName));
}
