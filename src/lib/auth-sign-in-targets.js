export const AUTH_LOGIN_VARIANTS = {
  employee: {
    allowSignup: false,
    authPath: "/auth/connect",
    copy: {
      brandLabel: "Citius Connect",
      heroLines: ["Your Team", { highlight: "Workspace", rest: " Starts" }, "Here."],
      highlights: [
        {
          description: "Manage enquiries, proposals, and job cards from one connected workspace.",
          title: "Sales CRM",
        },
        {
          description:
            "Coordinate ticketing, visas, hotels, and contracting with the teams that need them.",
          title: "Operations Hub",
        },
        {
          description:
            "Use the email provisioned by HR or IT. Need access? Contact your administrator.",
          title: "Staff Access",
        },
      ],
      mobileTitle: "Citius Connect",
      signInSubtitle: "Sign in with your staff credentials to access the internal CRM portal.",
      signInTitle: "Welcome to Citius Connect",
      signUpSubtitle: "Staff accounts are provisioned by your administrator.",
      signUpTitle: "Citius Connect",
      submitSignIn: "Sign In to Connect",
      submitSignUp: "Create Account",
    },
    href: "/portal",
    id: "employee",
    label: "Citius Connect",
    metadata: {
      description: "Staff sign in for the Citius Holidays CRM portal.",
      title: "Citius Connect | Citius Holidays",
    },
    visible: true,
  },
  guest: {
    allowSignup: true,
    authPath: "/auth/guest",
    copy: {
      brandLabel: "Citius Holidays",
      heroLines: ["The Journey", { highlight: "Within", rest: " Begins" }, "Here."],
      highlights: [
        {
          description:
            "Discover destinations that speak to your soul, from the peaks of Kailash to the temples of Kyoto.",
          title: "Curated Pilgrimages",
        },
        {
          description:
            "Let us handle the details while you focus on the experience. Expert guides, luxury stays, peace of mind.",
          title: "Seamless Exploration",
        },
        {
          description:
            "Track bookings, update your profile, and stay connected to every step of your travel experience.",
          title: "Your Journeys",
        },
      ],
      mobileTitle: "Welcome",
      signInSubtitle: "Enter your details to access your bookings and travel profile.",
      signInTitle: "Welcome Back",
      signUpSubtitle: "Create an account to book journeys and manage your travel profile.",
      signUpTitle: "Join the Circle",
      submitSignIn: "Sign In",
      submitSignUp: "Create Account",
    },
    href: "/account",
    id: "guest",
    label: "Guest Connect",
    metadata: {
      description: "Sign in to manage your bookings and travel profile.",
      title: "Guest Connect | Citius Holidays",
    },
    visible: true,
  },
  vendor: {
    allowSignup: false,
    authPath: "/auth/vendor",
    copy: {
      brandLabel: "Vendor Portal",
      heroLines: [{ highlight: "Partner", rest: " Services" }, "Managed Here."],
      highlights: [
        {
          description: "Keep compliance documents and contact details up to date in one place.",
          title: "Supplier Profile",
        },
        {
          description:
            "Review availability updates and respond to coordination requests from Citius teams.",
          title: "Service Requests",
        },
        {
          description: "Track invoice status and payment updates as the vendor portal expands.",
          title: "Invoices & Payments",
        },
      ],
      mobileTitle: "Vendor Portal",
      signInSubtitle: "Sign in to manage supplier services, documents, and coordination.",
      signInTitle: "Vendor Sign In",
      signUpSubtitle: "Vendor accounts are provisioned by Citius Holidays.",
      signUpTitle: "Vendor Portal",
      submitSignIn: "Sign In",
      submitSignUp: "Create Account",
    },
    href: "/vendor",
    id: "vendor",
    label: "Vendor Sign In",
    metadata: {
      description: "Partner and supplier sign in for the Citius Holidays vendor portal.",
      title: "Vendor Sign In | Citius Holidays",
    },
    visible: false,
  },
};

export const SIGN_IN_TARGETS = AUTH_LOGIN_VARIANTS;

export const SIGN_IN_TARGET_LIST = Object.values(AUTH_LOGIN_VARIANTS);

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

export function getLoginUrlForCallback(callbackUrl) {
  return getAuthVariantFromCallbackUrl(callbackUrl).authPath;
}
