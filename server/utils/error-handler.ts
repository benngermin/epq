import type { Response } from "express";

interface DatabaseError extends Error {
  code?: string;
  severity?: string;
  detail?: string;
}

export function handleDatabaseError(error: any, res: Response, defaultMessage: string = "Database operation failed") {
  const dbError = error as DatabaseError;
  
  // Log the full error in development
  if (process.env.NODE_ENV === "development") {
    console.error("Database error:", {
      message: error.message,
      code: dbError.code,
      severity: dbError.severity,
      detail: dbError.detail,
      stack: error.stack
    });
  }
  
  // Handle specific database error codes
  if (dbError.code === '57P01' || error.message?.includes('terminating connection due to administrator command')) {
    return res.status(503).json({ 
      message: "Database connection was interrupted. Please try again.",
      error: "CONNECTION_TERMINATED"
    });
  }
  
  if (error.message?.includes('Circuit breaker is OPEN')) {
    return res.status(503).json({ 
      message: "Database is temporarily unavailable due to connection issues. Please try again in a moment.",
      error: "SERVICE_UNAVAILABLE"
    });
  }
  
  if (error.message?.includes('Connect Timeout Error') || 
      error.message?.includes('UND_ERR_CONNECT_TIMEOUT')) {
    return res.status(503).json({ 
      message: "Database connection timeout. Please try again.",
      error: "CONNECTION_TIMEOUT"
    });
  }
  
  if (error.message?.includes('ECONNRESET') || 
      error.message?.includes('connection terminated')) {
    return res.status(503).json({ 
      message: "Database connection was reset. Please try again.",
      error: "CONNECTION_RESET"
    });
  }
  
  // Default error response
  return res.status(500).json({ 
    message: defaultMessage,
    error: "DATABASE_ERROR"
  });
}

export function isRetryableError(error: any): boolean {
  const errorMessage = error.message || '';
  const dbError = error as DatabaseError;
  
  return (
    dbError.code === '57P01' ||
    errorMessage.includes('terminating connection due to administrator command') ||
    errorMessage.includes('Connect Timeout Error') ||
    errorMessage.includes('UND_ERR_CONNECT_TIMEOUT') ||
    errorMessage.includes('ECONNRESET') ||
    errorMessage.includes('connection terminated') ||
    errorMessage.includes('fetch failed')
  );
}