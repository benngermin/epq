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
  max: 10, // Reduced max connections to avoid overloading database
  min: 2, // Reduced minimum connections for better resource usage
  idleTimeoutMillis: 60000, // Reduced to 1 minute - balances connection reuse with resource cleanup
  connectionTimeoutMillis: 10000, // Timeout connection attempts after 10 seconds
  // Add error handling for connection issues
  application_name: 'cpc-practice',
  query_timeout: 30000, // 30 second query timeout
  allowExitOnIdle: true, // Allow the process to exit when pool is idle
  statement_timeout: 30000, // 30 second statement timeout
  idle_in_transaction_session_timeout: 10000, // Kill idle transactions after 10 seconds
});

// Log pool events in development
if (process.env.NODE_ENV === 'development') {
  const poolErrorHandler = (err: Error) => {
    console.error('Unexpected database pool error', err);
  };
  
  const poolConnectHandler = () => {
    // Removed connection logging to reduce noise
    // console.log('New database connection established');
  };
  
  const poolRemoveHandler = () => {
    // Commenting out to reduce noise - this is normal behavior for connection pools
    // console.log('Database connection removed from pool');
  };

  pool.on('error', poolErrorHandler);
  pool.on('connect', poolConnectHandler);
  pool.on('remove', poolRemoveHandler);
  
  // Cleanup function to remove listeners
  let cleanupDone = false;
  const cleanupListeners = () => {
    if (cleanupDone) return;
    cleanupDone = true;
    
    pool.off('error', poolErrorHandler);
    pool.off('connect', poolConnectHandler);
    pool.off('remove', poolRemoveHandler);
  };
  
  process.on('exit', cleanupListeners);
  process.on('SIGINT', cleanupListeners);
  process.on('SIGTERM', cleanupListeners);
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