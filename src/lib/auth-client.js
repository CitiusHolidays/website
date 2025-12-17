/**
 * BetterAuth Client
 * 
 * Client-side authentication utilities for React components.
 * Use these hooks and functions in your frontend components.
 */

import { createAuthClient } from 'better-auth/react';

// Create the auth client with your app's base URL
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
});

// Export commonly used hooks and functions
export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
} = authClient;

/**
 * Sign up with email and password
 * 
 * @param {Object} params
 * @param {string} params.email - User's email
 * @param {string} params.password - User's password
 * @param {string} params.name - User's full name
 * @param {string} params.phoneNumber - User's phone number (optional)
 */
export async function signUpWithEmail({ email, password, name, phoneNumber }) {
  return await signUp.email({
    email,
    password,
    name,
    phoneNumber,
  });
}

/**
 * Sign in with email and password
 * 
 * @param {Object} params
 * @param {string} params.email - User's email
 * @param {string} params.password - User's password
 */
export async function signInWithEmail({ email, password }) {
  return await signIn.email({
    email,
    password,
  });
}

/**
 * Sign in with Google OAuth
 * Redirects to Google for authentication
 * 
 * @param {string} callbackURL - URL to redirect after authentication
 */
export async function signInWithGoogle(callbackURL = '/') {
  return await signIn.social({
    provider: 'google',
    callbackURL,
  });
}

/**
 * Sign out the current user
 */
export async function logout() {
  return await signOut();
}

/**
 * Get the current user session
 * 
 * @returns {Object|null} Session data or null if not authenticated
 */
export async function getCurrentSession() {
  const session = await getSession();
  return session?.data || null;
}

/**
 * Check if user is authenticated
 * 
 * @returns {boolean} True if user is authenticated
 */
export async function isAuthenticated() {
  const session = await getCurrentSession();
  return !!session?.user;
}











