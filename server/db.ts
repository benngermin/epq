import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure Neon with better connection settings
const sql = neon(process.env.DATABASE_URL, {
  fetchOptions: {
    cache: 'no-store',
    keepalive: true,
  },
  fullResults: true,
});

export const db = drizzle(sql, { schema });