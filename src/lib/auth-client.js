import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const baseURL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "http://localhost:3000";

const isProd = process.env.NODE_ENV === "production";

export const authClient = createAuthClient({
  baseURL,
  plugins: [convexClient()],
  fetchOptions: {
    credentials: "include",
  },
});

export const { signIn, signUp, signOut, useSession, getSession } = authClient;

export async function signUpWithEmail({ email, password, name, phoneNumber }) {
  return await signUp.email({
    email,
    password,
    name,
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
    provider: "google",
    callbackURL,
  });
}

export async function logout() {
  return await signOut();
}

export async function getCurrentSession() {
  const session = await getSession();
  return session?.data || null;
}

export async function isAuthenticated() {
  const session = await getCurrentSession();
  return !!session?.user;
}











