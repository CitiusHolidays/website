/**
 * Server-side Auth Utilities
 * 
 * Use these functions in Server Components and API routes
 * to check authentication status and get user data.
 */

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from './auth';

/**
 * Get the current session on the server side
 * 
 * @returns {Promise<{user: Object, session: Object} | null>}
 */
export async function getServerSession() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    return session;
  } catch (error) {
    console.error('Error getting server session:', error);
    return null;
  }
}

/**
 * Get the current user from the session
 * 
 * @returns {Promise<Object | null>} The user object or null if not authenticated
 */
export async function getServerUser() {
  const session = await getServerSession();
  return session?.user || null;
}

/**
 * Check if the user is authenticated
 * 
 * @returns {Promise<boolean>}
 */
export async function isAuthenticated() {
  const session = await getServerSession();
  return !!session?.user;
}

/**
 * Require authentication for a page/route
 * Redirects to login page if not authenticated
 * 
 * @param {string} callbackUrl - URL to redirect back to after login (optional)
 * @returns {Promise<{user: Object, session: Object}>} The session data
 */
export async function requireAuth(callbackUrl) {
  const session = await getServerSession();
  
  if (!session?.user) {
    const loginUrl = callbackUrl 
      ? `/auth?callbackUrl=${encodeURIComponent(callbackUrl)}`
      : '/auth';
    redirect(loginUrl);
  }
  
  return session;
}

/**
 * Require that the user is NOT authenticated
 * Useful for login/signup pages that should redirect logged-in users
 * 
 * @param {string} redirectTo - URL to redirect to if authenticated (default: '/')
 */
export async function requireGuest(redirectTo = '/') {
  const session = await getServerSession();
  
  if (session?.user) {
    redirect(redirectTo);
  }
}

/**
 * Get user data for use in layouts/headers
 * Returns null if not authenticated (doesn't throw or redirect)
 * 
 * @returns {Promise<{id: string, email: string, name: string, image?: string} | null>}
 */
export async function getUserForLayout() {
  try {
    const session = await getServerSession();
    if (!session?.user) return null;
    
    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      image: session.user.image,
    };
  } catch {
    return null;
  }
}




