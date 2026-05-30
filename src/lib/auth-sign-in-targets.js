export const AUTH_LOGIN_VARIANTS = {
  guest: {
    id: "guest",
    authPath: "/auth/guest",
    href: "/account",
    visible: true,
    allowSignup: true,
    label: "Guest Connect",
    metadata: {
      title: "Guest Connect | Citius Holidays",
      description: "Sign in to manage your bookings and travel profile.",
    },
    copy: {
      brandLabel: "Citius Holidays",
      mobileTitle: "Welcome",
      signInTitle: "Welcome Back",
      signInSubtitle: "Enter your details to access your bookings and travel profile.",
      signUpTitle: "Join the Circle",
      signUpSubtitle: "Create an account to book journeys and manage your travel profile.",
      submitSignIn: "Sign In",
      submitSignUp: "Create Account",
      heroLines: ["The Journey", { highlight: "Within", rest: " Begins" }, "Here."],
      highlights: [
        {
          title: "Curated Pilgrimages",
          description:
            "Discover destinations that speak to your soul, from the peaks of Kailash to the temples of Kyoto.",
        },
        {
          title: "Seamless Exploration",
          description:
            "Let us handle the details while you focus on the experience. Expert guides, luxury stays, peace of mind.",
        },
        {
          title: "Your Journeys",
          description:
            "Track bookings, update your profile, and stay connected to every step of your travel experience.",
        },
      ],
    },
  },
  employee: {
    id: "employee",
    authPath: "/auth/connect",
    href: "/portal",
    visible: true,
    allowSignup: false,
    label: "Citius Connect",
    metadata: {
      title: "Citius Connect | Citius Holidays",
      description: "Staff sign in for the Citius Holidays CRM portal.",
    },
    copy: {
      brandLabel: "Citius Connect",
      mobileTitle: "Citius Connect",
      signInTitle: "Welcome to Citius Connect",
      signInSubtitle: "Sign in with your staff credentials to access the internal CRM portal.",
      signUpTitle: "Citius Connect",
      signUpSubtitle: "Staff accounts are provisioned by your administrator.",
      submitSignIn: "Sign In to Connect",
      submitSignUp: "Create Account",
      heroLines: ["Your Team", { highlight: "Workspace", rest: " Starts" }, "Here."],
      highlights: [
        {
          title: "Sales CRM",
          description: "Manage enquiries, proposals, and job cards from one connected workspace.",
        },
        {
          title: "Operations Hub",
          description:
            "Coordinate ticketing, visas, hotels, and contracting with the teams that need them.",
        },
        {
          title: "Staff Access",
          description:
            "Use the email provisioned by HR or IT. Need access? Contact your administrator.",
        },
      ],
    },
  },
  vendor: {
    id: "vendor",
    authPath: "/auth/vendor",
    href: "/vendor",
    visible: false,
    allowSignup: false,
    label: "Vendor Sign In",
    metadata: {
      title: "Vendor Sign In | Citius Holidays",
      description: "Partner and supplier sign in for the Citius Holidays vendor portal.",
    },
    copy: {
      brandLabel: "Vendor Portal",
      mobileTitle: "Vendor Portal",
      signInTitle: "Vendor Sign In",
      signInSubtitle: "Sign in to manage supplier services, documents, and coordination.",
      signUpTitle: "Vendor Portal",
      signUpSubtitle: "Vendor accounts are provisioned by Citius Holidays.",
      submitSignIn: "Sign In",
      submitSignUp: "Create Account",
      heroLines: [{ highlight: "Partner", rest: " Services" }, "Managed Here."],
      highlights: [
        {
          title: "Supplier Profile",
          description: "Keep compliance documents and contact details up to date in one place.",
        },
        {
          title: "Service Requests",
          description:
            "Review availability updates and respond to coordination requests from Citius teams.",
        },
        {
          title: "Invoices & Payments",
          description: "Track invoice status and payment updates as the vendor portal expands.",
        },
      ],
    },
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
