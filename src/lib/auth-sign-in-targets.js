const AUTH_LOGIN_VARIANTS = {
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
    label: "Guest Connect",
    metadata: {
      description: "Sign in to manage your bookings and travel profile.",
      title: "Guest Connect",
    },
    visible: true,
  },
  vendor: {
    allowSignup: false,
    authPath: "/auth/vendor",
    copy: {
      signInSubtitle: "Use your supplier account to manage documents and coordination.",
      signInTitle: "Vendor sign in",
      signUpSubtitle: "Vendor accounts are provisioned by Citius Holidays.",
      signUpTitle: "Vendor Portal",
      submitSignIn: "Sign in",
      submitSignUp: "Create Account",
    },
    href: "/vendor",
    id: "vendor",
    label: "Vendor Sign In",
    metadata: {
      description: "Partner and supplier sign in for the Citius Holidays vendor portal.",
      title: "Vendor Sign In",
    },
    visible: false,
  },
};

const SIGN_IN_TARGET_LIST = Object.values(AUTH_LOGIN_VARIANTS);

export const VISIBLE_SIGN_IN_TARGETS = SIGN_IN_TARGET_LIST.filter((target) => target.visible);

export function getAuthVariant(variantId = "guest") {
  return AUTH_LOGIN_VARIANTS[variantId] ?? AUTH_LOGIN_VARIANTS.guest;
}

export function getAuthVariantFromCallbackUrl(callbackUrl = "/account") {
  if (!callbackUrl || callbackUrl === "/") {
    return AUTH_LOGIN_VARIANTS.guest;
  }
  const match = SIGN_IN_TARGET_LIST.find((target) => target.href === callbackUrl);
  return match ?? AUTH_LOGIN_VARIANTS.guest;
}

export function getSignInAuthUrl(variantId = "guest") {
  const variant = getAuthVariant(variantId);
  return variant.authPath;
}

/**
 * Recovery pages (`/auth/forgot-password`, `/auth/reset-password`, `/auth/email-verified`) carry
 * `?from=connect|guest|vendor`, the sign-in page the person started from. Unknown or missing values
 * fall back to `fallbackId`.
 */
export function getAuthVariantFromArea(area, fallbackId = "guest") {
  return (
    SIGN_IN_TARGET_LIST.find((target) => target.authPath === `/auth/${area}`) ??
    getAuthVariant(fallbackId)
  );
}

/** `path` with the variant's `?from=` area, so the recovery page returns to the same sign-in. */
export function authRecoveryHref(path, variant) {
  const area = variant?.authPath?.split("/").at(-1);
  return area ? `${path}?${new URLSearchParams({ from: area })}` : path;
}
