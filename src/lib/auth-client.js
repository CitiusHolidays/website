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

export const { signIn, signUp, signOut, useSession } = authClient;

export async function signUpWithEmail({ email, password, name, phoneNumber }) {
  return await signUp.email({
    email,
    name,
    password,
    phoneNumber,
  });
}

export async function signInWithEmail({ email, password }) {
  return await signIn.email({
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
