import {
  ACCOUNT_DELETION_CONFIRMATION_PHRASE,
  ACCOUNT_DELETION_ERRORS,
  type AccountDeletionErrorCode,
} from "@convex/lib/accountDeletionContract";
import { anyApi } from "convex/server";
import { fetchAuthMutation, fetchAuthQuery, getToken } from "@/lib/auth-server";
import type { JsonValue } from "@/lib/jsonValue";
import { withApiRequestLogging } from "@/lib/observability/api-log";
import { isRuntimeObject, isRuntimeString } from "@/lib/runtimeValues";

const PRIVATE_HEADERS = { "cache-control": "private, no-store" };
const MAX_CONFIRMATION_LENGTH = 64;

const ACCOUNT_DELETION_FAILURES = {
  confirmation_required: {
    error: `Type ${ACCOUNT_DELETION_CONFIRMATION_PHRASE} to confirm.`,
    status: 400,
  },
  reauthentication_required: {
    error: "For your security, sign in again, then delete your account within 10 minutes.",
    status: 401,
  },
  staff_account: {
    error:
      "Staff logins can't be deleted from the Customer Travel Account. Contact HR to close your staff account.",
    status: 403,
  },
  support_required: {
    error: "We couldn't delete this account automatically. Contact the Citius team and we'll help.",
    status: 409,
  },
  unauthorized: { error: "Authentication required", status: 401 },
  unavailable: {
    error: "We couldn't delete your account just now. Nothing was changed. Please try again.",
    status: 500,
  },
} as const;

type FailureCode = keyof typeof ACCOUNT_DELETION_FAILURES;

const FAILURE_BY_CONVEX_CODE = {
  [ACCOUNT_DELETION_ERRORS.confirmationRequired]: "confirmation_required",
  [ACCOUNT_DELETION_ERRORS.identityConflict]: "support_required",
  [ACCOUNT_DELETION_ERRORS.reauthenticationRequired]: "reauthentication_required",
  [ACCOUNT_DELETION_ERRORS.staffAccount]: "staff_account",
  [ACCOUNT_DELETION_ERRORS.tooLarge]: "support_required",
  [ACCOUNT_DELETION_ERRORS.unauthorized]: "unauthorized",
} satisfies Record<AccountDeletionErrorCode, FailureCode>;

function isAccountDeletionErrorCode(value: string): value is AccountDeletionErrorCode {
  return Object.hasOwn(FAILURE_BY_CONVEX_CODE, value);
}

function failure(code: FailureCode) {
  const { error, status } = ACCOUNT_DELETION_FAILURES[code];
  return Response.json({ code, error }, { headers: PRIVATE_HEADERS, status });
}

function convexFailureCode(cause: unknown): FailureCode {
  const data = cause && isRuntimeObject(cause) && "data" in cause ? cause.data : undefined;
  return isRuntimeString(data) && isAccountDeletionErrorCode(data)
    ? FAILURE_BY_CONVEX_CODE[data]
    : "unavailable";
}

async function readConfirmation(request: Request) {
  try {
    const body: JsonValue = await request.json();
    const confirmation =
      body && isRuntimeObject(body) && !Array.isArray(body) ? body.confirmation : undefined;
    return isRuntimeString(confirmation) && confirmation.length <= MAX_CONFIRMATION_LENGTH
      ? confirmation
      : null;
  } catch {
    return null;
  }
}

async function handleEligibility() {
  const token = await getToken();
  if (!token) {
    return failure("unauthorized");
  }
  try {
    const eligibility = await fetchAuthQuery(
      anyApi.accountDeletion.getMyAccountDeletionEligibility,
      {},
      { token }
    );
    return eligibility
      ? Response.json(eligibility, { headers: PRIVATE_HEADERS })
      : failure("unauthorized");
  } catch {
    return failure("unavailable");
  }
}

async function handleDeletion(request: Request) {
  const token = await getToken();
  if (!token) {
    return failure("unauthorized");
  }
  const confirmation = await readConfirmation(request);
  if (confirmation === null) {
    return failure("confirmation_required");
  }
  try {
    const result = await fetchAuthMutation(
      anyApi.accountDeletion.deleteMyAccount,
      { confirmation },
      { token }
    );
    return Response.json(result, { headers: PRIVATE_HEADERS });
  } catch (cause) {
    return failure(convexFailureCode(cause));
  }
}

export async function GET(request: Request) {
  return await withApiRequestLogging(request, "/api/account/deletion", () => handleEligibility());
}

export async function POST(request: Request) {
  return await withApiRequestLogging(request, "/api/account/deletion", () =>
    handleDeletion(request)
  );
}
