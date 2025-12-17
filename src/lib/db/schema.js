/**
 * Drizzle ORM Schema for Spiritual Trails Booking Platform
 * Database: PostgreSQL via Supabase
 * 
 * Tables:
 * - users: Customer accounts with encrypted passport details
 * - trips: Available pilgrimage packages (Kailash Mansarovar, etc.)
 * - bookings: Booking records linking users to trips with payment status
 */

import { pgTable, text, integer, timestamp, decimal, uuid, jsonb, varchar, date, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// USERS TABLE
// ============================================================================
// Stores customer information. Passport details are stored as encrypted JSON.
// The encryption happens at the application layer before insertion.
export const users = pgTable('users', {
  // BetterAuth uses string IDs (nanoid-style), so store as text
  id: text('id').primaryKey(),
  
  // Auth fields (managed by BetterAuth, but we link here)
  email: varchar('email', { length: 255 }).notNull().unique(),
  // BetterAuth expects a boolean flag for email verification
  emailVerified: boolean('email_verified').notNull().default(false),
  
  // Profile information
  name: varchar('name', { length: 255 }).notNull(),
  phoneNumber: varchar('phone_number', { length: 20 }),
  
  // Passport details - ENCRYPTED at application layer
  // Structure: { number, expiryDate, nationality, dateOfBirth }
  // Use AES-256-GCM encryption before storing
  passportDetailsEncrypted: text('passport_details_encrypted'),
  
  // Profile image (optional, for Google OAuth)
  image: text('image'),
  
  // Timestamps - mode:'date' required for BetterAuth to serialize dates properly
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

// ============================================================================
// SESSIONS TABLE (Required by BetterAuth)
// ============================================================================
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(), // BetterAuth generates string IDs, not UUIDs
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

// ============================================================================
// ACCOUNTS TABLE (Required by BetterAuth for OAuth providers)
// ============================================================================
export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(), // BetterAuth generates string IDs, not UUIDs
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: varchar('provider_id', { length: 50 }).notNull(), // 'credential', 'google', etc.
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { mode: 'date' }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { mode: 'date' }),
  scope: text('scope'),
  idToken: text('id_token'),
  password: text('password'), // Hashed password for credential provider
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

// ============================================================================
// VERIFICATION TABLE (Required by BetterAuth for email verification)
// ============================================================================
export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(), // BetterAuth generates string IDs, not UUIDs
  identifier: text('identifier').notNull(), // email or other identifier
  value: text('value').notNull(), // verification code/token
  expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow(),
});

// ============================================================================
// TRIPS TABLE
// ============================================================================
// Pilgrimage packages offered (e.g., Kailash Mansarovar Yatra)
export const trips = pgTable('trips', {
  id: uuid('id').defaultRandom().primaryKey(),
  
  // Trip details
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  description: text('description'),
  
  // Schedule
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  
  // Capacity
  totalSeats: integer('total_seats').notNull(),
  availableSeats: integer('available_seats').notNull(),
  
  // Pricing - stored in smallest currency unit (paise for INR, cents for USD)
  priceInr: integer('price_inr').notNull(), // in paise (e.g., 50000000 = ₹5,00,000)
  priceUsd: integer('price_usd').notNull(), // in cents (e.g., 600000 = $6,000)
  
  // Trip metadata
  difficulty: varchar('difficulty', { length: 50 }), // 'easy', 'moderate', 'challenging'
  itinerary: jsonb('itinerary'), // Array of day-wise itinerary
  inclusions: jsonb('inclusions'), // What's included
  exclusions: jsonb('exclusions'), // What's not included
  
  // Media
  coverImage: text('cover_image'),
  gallery: jsonb('gallery'), // Array of image URLs
  
  // Status
  isActive: integer('is_active').default(1).notNull(), // 1 = active, 0 = inactive
  
  // Timestamps
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

// ============================================================================
// BOOKINGS TABLE
// ============================================================================
// Links users to trips with payment tracking
export const bookings = pgTable('bookings', {
  id: uuid('id').defaultRandom().primaryKey(),
  
  // References
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tripId: uuid('trip_id').notNull().references(() => trips.id, { onDelete: 'restrict' }),
  
  // Booking status
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  // Possible values: 'pending', 'confirmed', 'failed', 'cancelled', 'refunded'
  
  // Payment details (Razorpay)
  razorpayOrderId: varchar('razorpay_order_id', { length: 100 }),
  razorpayPaymentId: varchar('razorpay_payment_id', { length: 100 }),
  razorpaySignature: text('razorpay_signature'),
  
  // Amount details
  totalAmount: integer('total_amount').notNull(), // in smallest currency unit
  currency: varchar('currency', { length: 3 }).notNull().default('INR'), // 'INR' or 'USD'
  
  // Number of travelers
  travelers: integer('travelers').notNull().default(1),
  
  // Traveler details (for all travelers in this booking)
  travelerDetails: jsonb('traveler_details'), // Array of { name, age, passportNumber }
  
  // Special requests or notes
  notes: text('notes'),
  
  // Timestamps
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  confirmedAt: timestamp('confirmed_at', { mode: 'date' }),
});

// ============================================================================
// RELATIONS
// ============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  bookings: many(bookings),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const tripsRelations = relations(trips, ({ many }) => ({
  bookings: many(bookings),
}));

export const bookingsRelations = relations(bookings, ({ one }) => ({
  user: one(users, {
    fields: [bookings.userId],
    references: [users.id],
  }),
  trip: one(trips, {
    fields: [bookings.tripId],
    references: [trips.id],
  }),
}));







