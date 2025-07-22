import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from "@shared/schema";
import ws from 'ws';

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure WebSocket for Neon serverless driver
neonConfig.webSocketConstructor = ws;

// Create a connection pool with proper limits
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 10, // Maximum number of connections in the pool
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 10000, // Timeout connection attempts after 10 seconds
  // Add error handling for connection issues
  application_name: 'cpc-practice',
  query_timeout: 30000, // 30 second query timeout
});

// Log pool events in development
if (process.env.NODE_ENV === 'development') {
  pool.on('error', (err) => {
    console.error('Unexpected database pool error', err);
  });
  
  pool.on('connect', () => {
    console.log('New database connection established');
  });
  
  pool.on('remove', () => {
    console.log('Database connection removed from pool');
  });
}

export const db = drizzle(pool, { schema });

// Graceful shutdown handler
export async function closeDatabase() {
  try {
    await pool.end();
    console.log('Database pool closed gracefully');
  } catch (error) {
    console.error('Error closing database pool:', error);
  }
}