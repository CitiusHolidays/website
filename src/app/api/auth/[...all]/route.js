/**
 * BetterAuth API Route Handler
 * 
 * Handles all authentication routes:
 * - POST /api/auth/sign-up - Register new user
 * - POST /api/auth/sign-in - Login user
 * - POST /api/auth/sign-out - Logout user
 * - GET /api/auth/session - Get current session
 * - GET /api/auth/callback/google - Google OAuth callback
 * - etc.
 */

import { auth } from '@/lib/auth';
import { toNextJsHandler } from 'better-auth/next-js';

export const { GET, POST } = toNextJsHandler(auth);



