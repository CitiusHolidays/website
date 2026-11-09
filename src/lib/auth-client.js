import { resolveAuthOrigin } from "@convex/lib/authOriginPolicy";
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const baseURL = resolveAuthOrigin({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NODE_ENV: process.env.NODE_ENV,
});

export const authClient = createAuthClient({
  baseURL,
  fetchOptions: {
    credentials: "include",
  },
  plugins: [convexClient()],
});

const { signIn, signUp, signOut } = authClient;
export const { useSession } = authClient;

export async function signUpWithEmail({ email, password, name, phoneNumber, callbackURL }) {
  return await signUp.email({
    callbackURL,
    email,
    name,
    password,
    phoneNumber,
  });
}

export async function signInWithEmail({ email, password, callbackURL }) {
  return await signIn.email({
    callbackURL,
    email,
    password,
  });
}

export async function signInWithGoogle(callbackURL = "/") {
  return await signIn.social({
    callbackURL,
    provider: "google",
  });
}

export async function logout() {
  return await signOut();
}
