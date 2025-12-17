/**
 * BetterAuth Configuration
 * 
 * Provides authentication for the Spiritual Trails platform.
 * Supports:
 * - Email/Password registration and login
 * - Google OAuth
 * - Session management
 * 
 * Integrates with our Drizzle schema for user storage.
 */

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from './db';
import * as schema from './db/schema';

export const auth = betterAuth({
  // Database adapter - using Drizzle with our schema
  database: drizzleAdapter(db, {
    provider: 'pg', // PostgreSQL
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
    // Map BetterAuth fields to our schema
    usePlainText: false,
  }),

  // Base URL for callbacks
  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL,
  
  // Secret for signing tokens - MUST be set in production
  secret: process.env.BETTER_AUTH_SECRET,

  // Email/Password authentication
  emailAndPassword: {
    enabled: true,
    // Password requirements
    minPasswordLength: 8,
    // Require email verification before login
    requireEmailVerification: false, // Set to true in production
    // Custom password validation
    validatePassword: (password) => {
      if (password.length < 8) {
        return { valid: false, message: 'Password must be at least 8 characters' };
      }
      if (!/[A-Z]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one uppercase letter' };
      }
      if (!/[0-9]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one number' };
      }
      return { valid: true };
    },
  },

  // OAuth providers
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Request additional scopes if needed
      scope: ['email', 'profile'],
    },
  },

  // Session configuration
  session: {
    // Session expiry in seconds (30 days)
    expiresIn: 30 * 24 * 60 * 60,
    // Update session on each request
    updateAge: 24 * 60 * 60, // 24 hours
    // Cookie configuration
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },

  // User configuration
  user: {
    // Additional fields to store on user creation
    additionalFields: {
      phoneNumber: {
        type: 'string',
        required: false,
      },
    },
    // Transform user object before returning to client
    // Don't expose sensitive fields
    publicFields: ['id', 'email', 'name', 'image', 'phoneNumber'],
  },

  // Account configuration
  account: {
    // Allow linking multiple accounts (email + Google)
    accountLinking: {
      enabled: true,
      // Allow linking if email matches
      trustedProviders: ['google'],
    },
  },

  // Rate limiting
  rateLimit: {
    enabled: true,
    // Window in seconds
    window: 60,
    // Max requests per window
    max: 10,
  },

  // Callbacks for custom logic
  callbacks: {
    // Called after successful sign up
    async onUserCreated({ user }) {
      console.log(`New user registered: ${user.email}`);
      // TODO: Send welcome email
      // await sendWelcomeEmail(user);
    },
    // Called after successful sign in
    async onSignIn({ user, account }) {
      console.log(`User signed in: ${user.email} via ${account?.providerId || 'credentials'}`);
    },
  },

  // Advanced options
  advanced: {
    // Use secure cookies in production
    useSecureCookies: process.env.NODE_ENV === 'production',
    // Generate custom session token
    generateSessionToken: () => {
      return crypto.randomUUID();
    },
  },
});

// Note: Use toNextJsHandler(auth) in API routes
// Note: Use createAuthClient() from auth-client.js for client-side auth











