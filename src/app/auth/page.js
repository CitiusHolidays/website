/**
 * Auth Page - Server Component
 * 
 * Handles login/signup for the Spiritual Trails booking platform.
 * Redirects authenticated users away from this page.
 */

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import AuthPageClient from './page.client';

export const metadata = {
  title: 'Sign In',
  description: 'Sign in to your Citius Travel account to manage your bookings and explore spiritual trails.',
};

export default async function AuthPage({ searchParams }) {
  // Check if user is already authenticated
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  
  if (session?.user) {
    // User is already logged in, redirect to home or callback URL
    const params = await searchParams;
    const callbackUrl = params?.callbackUrl || '/';
    redirect(callbackUrl);
  }
  
  // Get any error or callback URL from search params
  const params = await searchParams;
  const error = params?.error;
  const callbackUrl = params?.callbackUrl || '/';
  const mode = params?.mode || 'signin';
  
  return <AuthPageClient initialMode={mode} callbackUrl={callbackUrl} error={error} />;
}




