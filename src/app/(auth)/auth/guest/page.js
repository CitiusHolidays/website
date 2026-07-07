import { createAuthLoginPage } from "@/lib/auth-login-pages";
import { getAuthVariant } from "@/lib/auth-sign-in-targets";

const variant = getAuthVariant("guest");

export const metadata = {
  description: variant.metadata.description,
  title: variant.metadata.title,
};

// TODO: Cache Components adoption. This login form uses Convex client mutations during prerender;
// keep it blocking until the auth provider/login shell can be adopted without losing context.
export const instant = false;

export default function GuestAuthPage({ searchParams }) {
  return createAuthLoginPage({ searchParams, variantId: "guest" });
}
