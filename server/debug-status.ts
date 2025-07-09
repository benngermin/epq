import { db } from './db';
import { sql } from 'drizzle-orm';
import os from 'os';

export async function getDebugStatus() {
  const status: any = {
    timestamp: new Date().toISOString(),
    server: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV
    },
    system: {
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      cpus: os.cpus().length,
      loadAverage: os.loadavg()
    },
    database: {
      status: 'unknown',
      connectionCount: 0,
      error: null
    },
    performance: {
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      externalMemory: Math.round(process.memoryUsage().external / 1024 / 1024) + ' MB',
      cpuUsage: process.cpuUsage()
    }
  };

  // Test database connection
  try {
    const result = await db.execute(sql`SELECT COUNT(*) as count FROM pg_stat_activity WHERE datname = current_database()`);
    status.database.status = 'connected';
    status.database.connectionCount = result.rows[0]?.count || 0;
  } catch (error) {
    status.database.status = 'error';
    status.database.error = error instanceof Error ? error.message : 'Unknown error';
  }

  return status;
}