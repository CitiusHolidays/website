/**
 * Database Connection - Drizzle ORM with Supabase PostgreSQL
 * 
 * Uses connection pooling via Supabase's pgBouncer for serverless environments.
 * For Vercel Edge Functions, we use the HTTP-based postgres-js driver.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Connection string from environment
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL environment variable is not set. ' +
    'Please add your Supabase connection string to .env.local'
  );
}

// For serverless environments, we need to handle connection pooling carefully
// Supabase provides a pooler URL that should be used for serverless
const isProduction = process.env.NODE_ENV === 'production';

// Create postgres connection with appropriate settings for serverless
const client = postgres(connectionString, {
  // For serverless, we want to use transaction mode pooling
  // Supabase pooler handles this, but we add safeguards
  max: isProduction ? 1 : 10, // Limit connections in serverless
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 10, // Connection timeout in seconds
  
  // SSL configuration for Supabase
  ssl: isProduction ? 'require' : false,
  
  // Prepare statements - disable for transaction mode pooling
  prepare: false,
});

// Create and export the Drizzle database instance
export const db = drizzle(client, { 
  schema,
  logger: process.env.NODE_ENV === 'development',
});

// Export schema for use in queries
export { schema };

// Helper to run a query with proper error handling
export async function withDb(callback) {
  try {
    return await callback(db);
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
}











