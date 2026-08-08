import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { normalizeEmail } from "../crm/lib/staffAccess";
import { getBootstrapAuthority } from "./bootstrapAuthority";

type AuthRepairEnv = Record<string, string | undefined>;
type AuthRepairMode = "inventory" | "repair";
type AuthRepairStatus = "ambiguous" | "linked" | "missing" | "repairable" | "skipped";

interface StaffAuthAssessment {
  candidateAuthUserId?: string;
  reason: string;
  staff: Doc<"staffUsers">;
  status: AuthRepairStatus;
}

export function assertAuthRepairEnvironment(
  secret: string,
  env: AuthRepairEnv = process.env,
  at = Date.now()
) {
  const expected = env.MIGRATION_SECRET?.trim();
  if (!(expected && secret === expected)) {
    throw new ConvexError("Invalid migration secret");
  }
  const bootstrap = getBootstrapAuthority(env, at);
  if (bootstrap.configured && !bootstrap.active) {
    throw new ConvexError("Bootstrap admin configuration requires a valid future expiry");
  }
}

async function assessStaffAuthLink(
  ctx: MutationCtx,
  staff: Doc<"staffUsers">
): Promise<StaffAuthAssessment> {
  if (!staff.active) {
    return { reason: "inactive staff records are not repaired", staff, status: "skipped" };
  }

  const existingAuthUserId = staff.authUserId?.trim();
  if (existingAuthUserId) {
    const linkedStaff = await ctx.db
      .query("staffUsers")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", existingAuthUserId))
      .take(2);
    if (linkedStaff.length === 1 && linkedStaff[0]?._id === staff._id) {
      return { reason: "staff record already has a unique explicit link", staff, status: "linked" };
    }
    return {
      reason: "auth identity is linked to multiple staff records",
      staff,
      status: "ambiguous",
    };
  }

  const emailNormalized = normalizeEmail(staff.emailNormalized || staff.email);
  if (!emailNormalized.includes("@")) {
    return { reason: "staff record has no valid normalized email", staff, status: "skipped" };
  }

  const [staffWithEmail, profilesWithEmail] = await Promise.all([
    ctx.db
      .query("staffUsers")
      .withIndex("by_emailNormalized", (q) => q.eq("emailNormalized", emailNormalized))
      .take(2),
    ctx.db
      .query("userProfiles")
      .withIndex("by_emailNormalized", (q) => q.eq("emailNormalized", emailNormalized))
      .take(2),
  ]);
  if (staffWithEmail.length !== 1 || staffWithEmail[0]?._id !== staff._id) {
    return {
      reason: "multiple staff records share the normalized email",
      staff,
      status: "ambiguous",
    };
  }
  if (profilesWithEmail.length === 0) {
    return { reason: "no matching user profile", staff, status: "missing" };
  }
  if (profilesWithEmail.length > 1) {
    return {
      reason: "multiple profiles share the normalized email",
      staff,
      status: "ambiguous",
    };
  }

  const [profile] = profilesWithEmail;
  const candidateAuthUserId = profile?.authUserId?.trim();
  if (!candidateAuthUserId) {
    return { reason: "matching profile has no auth identity", staff, status: "missing" };
  }
  const [profilesWithAuth, staffWithAuth] = await Promise.all([
    ctx.db
      .query("userProfiles")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", candidateAuthUserId))
      .take(2),
    ctx.db
      .query("staffUsers")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", candidateAuthUserId))
      .take(2),
  ]);
  if (profilesWithAuth.length !== 1 || profilesWithAuth[0]?._id !== profile?._id) {
    return {
      reason: "auth identity is linked to multiple profiles",
      staff,
      status: "ambiguous",
    };
  }
  if (staffWithAuth.length > 0) {
    return {
      reason: "auth identity is already linked to another staff record",
      staff,
      status: "ambiguous",
    };
  }

  return {
    candidateAuthUserId,
    reason: "one staff record and one profile provide unique evidence",
    staff,
    status: "repairable",
  };
}

export async function processStaffAuthLinkBatch(
  ctx: MutationCtx,
  args: {
    mode: AuthRepairMode;
    paginationOpts: { cursor: string | null; numItems: number };
    secret: string;
  }
) {
  assertAuthRepairEnvironment(args.secret);
  const page = await ctx.db
    .query("staffUsers")
    .withIndex("by_name")
    .order("asc")
    .paginate({
      cursor: args.paginationOpts.cursor,
      numItems: Math.min(Math.max(args.paginationOpts.numItems, 1), 100),
    });
  const assessments = await Promise.all(page.page.map((staff) => assessStaffAuthLink(ctx, staff)));
  const repairable = assessments.filter(
    (assessment) => assessment.status === "repairable" && assessment.candidateAuthUserId
  );
  if (args.mode === "repair") {
    const now = Date.now();
    await Promise.all(
      repairable.map((assessment) =>
        ctx.db.patch(assessment.staff._id, {
          authUserId: assessment.candidateAuthUserId,
          updatedAt: now,
        })
      )
    );
  }

  const count = (status: AuthRepairStatus) =>
    assessments.filter((assessment) => assessment.status === status).length;
  return {
    continueCursor: page.continueCursor,
    counts: {
      ambiguous: count("ambiguous"),
      inspected: assessments.length,
      linked: count("linked"),
      missing: count("missing"),
      repairable: repairable.length,
      repaired: args.mode === "repair" ? repairable.length : 0,
      skipped: count("skipped"),
    },
    isDone: page.isDone,
    mode: args.mode,
    review: assessments.flatMap((assessment) =>
      assessment.status === "linked" || assessment.status === "repairable"
        ? []
        : [
            {
              email: assessment.staff.email,
              reason: assessment.reason,
              staffId: assessment.staff._id,
              status: assessment.status,
            },
          ]
    ),
  };
}
