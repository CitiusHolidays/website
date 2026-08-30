import { isRuntimeString } from "./runtimeValues";

export const AUTH_LOGIN_VARIANTS = {
  employee: {
    allowSignup: false,
    authPath: "/auth/connect",
    copy: {
      signInSubtitle: "Use your staff account to open the Citius Connect Staff Workspace.",
      signInTitle: "Citius Connect",
      signUpSubtitle: "Staff accounts are provisioned by your administrator.",
      signUpTitle: "Citius Connect",
      submitSignIn: "Sign in",
      submitSignUp: "Create Account",
    },
    href: "/portal",
    id: "employee",
    label: "Citius Connect",
    metadata: {
      description: "Staff sign in for the Citius Holidays CRM portal.",
      title: "Citius Connect",
    },
    visible: true,
  },
  guest: {
    allowSignup: true,
    authPath: "/auth/guest",
    copy: {
      signInSubtitle:
        "View the journeys linked to your Customer Travel Account and manage your profile.",
      signInTitle: "Welcome back",
      signUpSubtitle: "Create a Customer Travel Account for your journeys and profile.",
      signUpTitle: "Create account",
      submitSignIn: "Sign in",
      submitSignUp: "Create account",
    },
    href: "/account",
    id: "guest",
    label: "Customer Travel Account",
    metadata: {
      description: "Sign in to manage your bookings and travel profile.",
      title: "Customer Travel Account",
    },
    visible: true,
  },
};

const UNAVAILABLE_SIGN_IN_PREFIXES = new Map([["/vendor", "/contact"]]);

export const SIGN_IN_TARGET_LIST = Object.values(AUTH_LOGIN_VARIANTS);

export const VISIBLE_SIGN_IN_TARGETS = SIGN_IN_TARGET_LIST.filter((target) => target.visible);

export function getAuthVariant(variantId = "guest") {
  const variant = AUTH_LOGIN_VARIANTS[variantId];
  if (!variant) {
    throw new Error(`Unknown auth variant: ${variantId}`);
  }
  return variant;
}

const AUTH_RETURN_BASE = "https://auth-return.invalid";
const AUTH_RETURN_MAX_LENGTH = 2048;

function hasControlCharacters(value) {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

function parseRelativeReturnTarget(candidate) {
  if (
    !isRuntimeString(candidate) ||
    candidate.length > AUTH_RETURN_MAX_LENGTH ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    candidate.includes("#") ||
    hasControlCharacters(candidate)
  ) {
    return null;
  }

  try {
    const url = new URL(candidate, AUTH_RETURN_BASE);
    if (url.origin !== AUTH_RETURN_BASE || url.hash) {
      return null;
    }

    // Auth routes use ASCII pathnames. Reject encoded path bytes rather than
    // risking a second decode turning a reviewed product path into traversal.
    if (decodeURIComponent(url.pathname) !== url.pathname) {
      return null;
    }

    return { href: `${url.pathname}${url.search}`, pathname: url.pathname };
  } catch {
    return null;
  }
}

function variantOwnsPath(variant, pathname) {
  if (!variant.visible) {
    return pathname === variant.href;
  }
  return pathname === variant.href || pathname.startsWith(`${variant.href}/`);
}

export function getAuthVariantFromCallbackUrl(callbackUrl = "/account") {
  if (!callbackUrl || callbackUrl === "/") {
    return AUTH_LOGIN_VARIANTS.guest;
  }
  const parsed = parseRelativeReturnTarget(callbackUrl);
  const match = parsed
    ? SIGN_IN_TARGET_LIST.find((target) => variantOwnsPath(target, parsed.pathname))
    : null;
  return match ?? AUTH_LOGIN_VARIANTS.guest;
}

/** A return intent is navigation context only; the destination must authorize every read. */
export function resolveAuthReturnTarget(variantId, candidate) {
  const variant = getAuthVariant(variantId);
  const parsed = parseRelativeReturnTarget(candidate);
  return parsed && variantOwnsPath(variant, parsed.pathname) ? parsed.href : variant.href;
}

export function getSignInAuthUrl(variantId, callbackUrl) {
  const variant = getAuthVariant(variantId);
  if (callbackUrl === undefined) {
    return variant.authPath;
  }
  const returnTo = resolveAuthReturnTarget(variant.id, callbackUrl);
  return `${variant.authPath}?${new URLSearchParams({ callbackUrl: returnTo })}`;
}

export function getAuthRecoveryUrl(path, variantId, callbackUrl) {
  const returnTo = resolveAuthReturnTarget(variantId, callbackUrl);
  return `${path}?${new URLSearchParams({ callbackUrl: returnTo })}`;
}

export function getLoginUrlForCallback(callbackUrl) {
  for (const [prefix, unavailableRedirect] of UNAVAILABLE_SIGN_IN_PREFIXES) {
    if (
      callbackUrl === prefix ||
      callbackUrl?.startsWith(`${prefix}/`) ||
      callbackUrl?.startsWith(`${prefix}?`)
    ) {
      return unavailableRedirect;
    }
  }
  const variant = getAuthVariantFromCallbackUrl(callbackUrl);
  const returnTo = resolveAuthReturnTarget(variant.id, callbackUrl);
  return returnTo === variant.href
    ? variant.authPath
    : `${variant.authPath}?${new URLSearchParams({ callbackUrl: returnTo })}`;
}
