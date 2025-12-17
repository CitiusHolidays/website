/**
 * Database Query Helpers
 * 
 * Common database operations for the booking platform.
 * Use these instead of writing raw queries in API routes.
 */

import { db } from './index';
import { users, trips, bookings } from './schema';
import { eq, and, gte, lte, desc, asc, sql } from 'drizzle-orm';
import { encryptPassportDetails, decryptPassportDetails } from '../encryption';

// ============================================================================
// USER QUERIES
// ============================================================================

/**
 * Get user by ID
 */
export async function getUserById(userId) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user;
}

/**
 * Get user by email
 */
export async function getUserByEmail(email) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  return user;
}

/**
 * Update user profile
 */
export async function updateUserProfile(userId, data) {
  const [updated] = await db
    .update(users)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();
  return updated;
}

/**
 * Update user passport details (encrypted)
 */
export async function updateUserPassport(userId, passportDetails) {
  const encrypted = encryptPassportDetails(passportDetails);
  
  const [updated] = await db
    .update(users)
    .set({
      passportDetailsEncrypted: encrypted,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();
    
  return updated;
}

/**
 * Get user with decrypted passport details
 */
export async function getUserWithPassport(userId) {
  const user = await getUserById(userId);
  if (!user) return null;
  
  return {
    ...user,
    passportDetails: user.passportDetailsEncrypted 
      ? decryptPassportDetails(user.passportDetailsEncrypted)
      : null,
  };
}

// ============================================================================
// TRIP QUERIES
// ============================================================================

/**
 * Get all active trips
 */
export async function getActiveTrips() {
  return db
    .select()
    .from(trips)
    .where(eq(trips.isActive, 1))
    .orderBy(asc(trips.startDate));
}

/**
 * Get upcoming trips (starting after today)
 */
export async function getUpcomingTrips() {
  const today = new Date().toISOString().split('T')[0];
  
  return db
    .select()
    .from(trips)
    .where(and(
      eq(trips.isActive, 1),
      gte(trips.startDate, today)
    ))
    .orderBy(asc(trips.startDate));
}

/**
 * Get trip by ID
 */
export async function getTripById(tripId) {
  const [trip] = await db
    .select()
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1);
  return trip;
}

/**
 * Get trip by slug
 */
export async function getTripBySlug(slug) {
  const [trip] = await db
    .select()
    .from(trips)
    .where(eq(trips.slug, slug))
    .limit(1);
  return trip;
}

/**
 * Check seat availability for a trip
 */
export async function checkTripAvailability(tripId, requiredSeats = 1) {
  const trip = await getTripById(tripId);
  if (!trip) return { available: false, reason: 'Trip not found' };
  if (!trip.isActive) return { available: false, reason: 'Trip is not active' };
  if (trip.availableSeats < requiredSeats) {
    return { 
      available: false, 
      reason: `Only ${trip.availableSeats} seats available`,
      availableSeats: trip.availableSeats,
    };
  }
  return { available: true, trip };
}

/**
 * Create a new trip
 */
export async function createTrip(tripData) {
  const [trip] = await db
    .insert(trips)
    .values({
      ...tripData,
      availableSeats: tripData.totalSeats, // Initially all seats available
    })
    .returning();
  return trip;
}

// ============================================================================
// BOOKING QUERIES
// ============================================================================

/**
 * Get booking by ID
 */
export async function getBookingById(bookingId) {
  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);
  return booking;
}

/**
 * Get booking with trip and user details
 */
export async function getBookingWithDetails(bookingId) {
  const result = await db
    .select({
      booking: bookings,
      trip: trips,
      user: users,
    })
    .from(bookings)
    .innerJoin(trips, eq(bookings.tripId, trips.id))
    .innerJoin(users, eq(bookings.userId, users.id))
    .where(eq(bookings.id, bookingId))
    .limit(1);
    
  return result[0] || null;
}

/**
 * Get all bookings for a user
 */
export async function getUserBookings(userId) {
  return db
    .select({
      booking: bookings,
      trip: trips,
    })
    .from(bookings)
    .innerJoin(trips, eq(bookings.tripId, trips.id))
    .where(eq(bookings.userId, userId))
    .orderBy(desc(bookings.createdAt));
}

/**
 * Get bookings by status
 */
export async function getBookingsByStatus(status) {
  return db
    .select({
      booking: bookings,
      trip: trips,
      user: users,
    })
    .from(bookings)
    .innerJoin(trips, eq(bookings.tripId, trips.id))
    .innerJoin(users, eq(bookings.userId, users.id))
    .where(eq(bookings.status, status))
    .orderBy(desc(bookings.createdAt));
}

/**
 * Update booking status
 */
export async function updateBookingStatus(bookingId, status, additionalData = {}) {
  const [updated] = await db
    .update(bookings)
    .set({
      status,
      ...additionalData,
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, bookingId))
    .returning();
  return updated;
}

/**
 * Cancel a booking and restore seats
 */
export async function cancelBooking(bookingId) {
  const booking = await getBookingById(bookingId);
  if (!booking) throw new Error('Booking not found');
  if (booking.status === 'cancelled') throw new Error('Booking already cancelled');
  
  // Update booking status
  await updateBookingStatus(bookingId, 'cancelled');
  
  // If booking was confirmed, restore seats
  if (booking.status === 'confirmed') {
    await db
      .update(trips)
      .set({
        availableSeats: sql`${trips.availableSeats} + ${booking.travelers}`,
        updatedAt: new Date(),
      })
      .where(eq(trips.id, booking.tripId));
  }
  
  return { success: true };
}

/**
 * Get booking statistics
 */
export async function getBookingStats() {
  const stats = await db
    .select({
      status: bookings.status,
      count: sql`count(*)::int`,
      totalAmount: sql`sum(${bookings.totalAmount})::int`,
    })
    .from(bookings)
    .groupBy(bookings.status);
    
  return stats.reduce((acc, row) => {
    acc[row.status] = { count: row.count, totalAmount: row.totalAmount };
    return acc;
  }, {});
}











