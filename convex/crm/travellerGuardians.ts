import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { propertiesWhen } from "../lib/runtimeValues";
import { getVisibleJob } from "./jobCardVisibility";
import type { PortalAccess } from "./lib";
import { patchWithE2eOwnership } from "./lib/e2eOwnership";
import { type TravellerGroupScope, travellerInGroupScope } from "./tourManagerGroupScope";
import {
  type GuardianCandidate,
  guardianSetProblem,
  nameVariants,
  normalizePersonName,
  resolveGuardianReferences,
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

/** The minor's guardians in slot order (first, then second). */
export function guardianIdsOf(traveller: Doc<"travellers">): Id<"travellers">[] {
  return [traveller.firstGuardianTravellerId, traveller.secondGuardianTravellerId].filter(
    (id): id is Id<"travellers"> => id !== undefined
  );
}

/** Stores up to two guardians in the indexed slots, compacted so the first slot fills first. */
export function guardianSlotsPatch(guardianIds: readonly Id<"travellers">[]) {
  return {
    firstGuardianTravellerId: guardianIds[0],
    secondGuardianTravellerId: guardianIds[1],
  };
}

function warningFor(traveller: Doc<"travellers">, message: string) {
  return {
    fullName: traveller.fullName,
    message,
    ...propertiesWhen(traveller.sourceRowNumber !== undefined, () => ({
      sourceRowNumber: traveller.sourceRowNumber,
    })),
    ...propertiesWhen(traveller.sourceSheet, () => ({ sourceSheet: traveller.sourceSheet })),
    travellerId: traveller._id,
  };
}

/**
 * Resolves every pending spreadsheet Parent/Guardian reference on one Job Card. Runs once,
 * after the final import batch, so a guardian may appear on any row or batch of the sheet or
 * already be on the Job Card. Each named guardian is matched on its own; when at least one
 * matches exactly one eligible adult, the matches become the minor's guardians and the other
 * names stay pending and are reported. Nothing is linked by guesswork.
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
  // Only same-name travellers can match, so the roster is indexed by name once.
  const candidatesByName = new Map<string, GuardianCandidate[]>();
  for (const candidate of roster.map(toGuardianCandidate)) {
    for (const name of nameVariants(candidate)) {
      candidatesByName.set(name, [...(candidatesByName.get(name) ?? []), candidate]);
    }
  }
  const byId = new Map(roster.map((traveller) => [String(traveller._id), traveller]));
  const now = Date.now();
  let linked = 0;
  const warnings: ReturnType<typeof warningFor>[] = [];
  const patches: Promise<void>[] = [];
  for (const traveller of roster) {
    const references = traveller.guardianImportReferences ?? [];
    if (references.length === 0) {
      continue;
    }
    const { guardianIds, unresolved } = resolveGuardianReferences(
      toGuardianCandidate(traveller),
      references,
      (reference) => candidatesByName.get(normalizePersonName(reference.name)) ?? []
    );
    const guardians = guardianIds.flatMap((id) => {
      const guardian = byId.get(id);
      return guardian ? [guardian._id] : [];
    });
    for (const { message } of unresolved) {
      warnings.push(warningFor(traveller, message));
    }
    if (guardians.length > 0) {
      // Each patch writes a different traveller; e2e ownership records are queued per transaction.
      patches.push(
        patchWithE2eOwnership(
          ctx,
          "travellers",
          traveller._id,
          {
            ...guardianSlotsPatch(guardians),
            guardianImportReferences:
              unresolved.length > 0 ? unresolved.map(({ reference }) => reference) : undefined,
            updatedAt: now,
          },
          { authUserId: args.access.authUserId }
        )
      );
      linked += guardians.length;
    }
  }
  await Promise.all(patches);
  return { linked, warnings };
}

/** Throws the reason a manual set of guardians is invalid. */
export function assertGuardianSet(
  minor: Doc<"travellers">,
  nextIsMinor: boolean | undefined,
  guardians: readonly (Doc<"travellers"> | null)[]
) {
  const found = guardians.filter((guardian): guardian is Doc<"travellers"> => guardian !== null);
  if (found.length !== guardians.length) {
    throw new ConvexError("Guardian not found");
  }
  const problem = guardianSetProblem(
    { ...toGuardianCandidate(minor), isMinor: nextIsMinor },
    found.map(toGuardianCandidate)
  );
  if (problem) {
    throw new ConvexError(problem);
  }
}

/** Minors that name this traveller in either guardian slot (two index reads). */
export async function minorsCoveredBy(ctx: QueryCtx, guardianId: Id<"travellers">) {
  const [first, second] = await Promise.all([
    ctx.db
      .query("travellers")
      .withIndex("by_firstGuardianTravellerId", (q) => q.eq("firstGuardianTravellerId", guardianId))
      .take(GUARDIAN_MINORS_LIMIT),
    ctx.db
      .query("travellers")
      .withIndex("by_secondGuardianTravellerId", (q) =>
        q.eq("secondGuardianTravellerId", guardianId)
      )
      .take(GUARDIAN_MINORS_LIMIT),
  ]);
  const byId = new Map([...first, ...second].map((minor) => [String(minor._id), minor]));
  return [...byId.values()];
}

/** A deleted guardian leaves its minors' other guardian in place and no missing link behind. */
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
        {
          ...guardianSlotsPatch(guardianIdsOf(minor).filter((id) => id !== guardianId)),
          updatedAt: now,
        },
        actor
      )
    )
  );
}

/**
 * Guardian facts for the Staff Workspace traveller row. Each linked person is named only when
 * the reader may already see them under the same Job Card group scope, so a link never
 * discloses a minor (or a guardian) outside the reader's existing traveller access.
 */
export async function travellerGuardianFacts(
  ctx: QueryCtx,
  traveller: Doc<"travellers">,
  scope: TravellerGroupScope
) {
  const visible = (other: Doc<"travellers"> | null): other is Doc<"travellers"> =>
    other !== null &&
    String(other.jobCardId) === String(traveller.jobCardId) &&
    travellerInGroupScope(scope, other);
  const guardianDocs = await Promise.all(
    guardianIdsOf(traveller).map((id) => ctx.db.get("travellers", id))
  );
  const minors = traveller.isMinor === true ? [] : await minorsCoveredBy(ctx, traveller._id);
  return {
    guardianOf: minors
      .filter(visible)
      .map((minor) => ({ fullName: minor.fullName, id: minor._id })),
    guardianSheetReferences: (traveller.guardianImportReferences ?? []).map(
      (reference) => reference.name
    ),
    guardians: guardianDocs
      .filter(visible)
      .map((guardian) => ({ fullName: guardian.fullName, id: guardian._id })),
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
