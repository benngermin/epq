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

// Create a connection pool with optimized limits to reduce churn
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 20, // Increased max connections to handle concurrent requests better
  min: 5, // Maintain minimum connections to reduce connection setup overhead
  idleTimeoutMillis: 300000, // Keep idle connections for 5 minutes (was 30 seconds)
  connectionTimeoutMillis: 10000, // Timeout connection attempts after 10 seconds
  // Add error handling for connection issues
  application_name: 'cpc-practice',
  query_timeout: 30000, // 30 second query timeout
  allowExitOnIdle: true, // Allow the process to exit when pool is idle
});

// Log pool events in development
if (process.env.NODE_ENV === 'development') {
  const poolErrorHandler = (err: Error) => {
    console.error('Unexpected database pool error', err);
  };
  
  const poolConnectHandler = () => {
    console.log('New database connection established');
  };
  
  const poolRemoveHandler = () => {
    console.log('Database connection removed from pool');
  };

  pool.on('error', poolErrorHandler);
  pool.on('connect', poolConnectHandler);
  pool.on('remove', poolRemoveHandler);
  
  // Cleanup function to remove listeners
  process.on('exit', () => {
    pool.off('error', poolErrorHandler);
    pool.off('connect', poolConnectHandler);
    pool.off('remove', poolRemoveHandler);
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