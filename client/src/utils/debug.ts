// Debug utility for tracking question loading issues
const isDevelopment = import.meta.env.MODE === 'development' || import.meta.env.DEV;

// Safe function to check if debug mode is enabled
// Handles iframe contexts where window.location might throw
function isDebugEnabled(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  
  try {
    // Try to access window.location.search
    // This might throw in cross-origin iframe contexts
    const search = window.location.search;
    return search.includes('debug=true');
  } catch (e) {
    // If we can't access location (iframe restrictions), fall back to checking localStorage
    // or just return false for safety
    try {
      // Try localStorage as a fallback
      const debugFlag = window.localStorage?.getItem('debug');
      return debugFlag === 'true';
    } catch {
      // If localStorage also fails, debug is disabled
      return false;
    }
  }
}

export function debugLog(message: string, data?: any) {
  if (isDevelopment) {
    try {
      if (isDebugEnabled()) {
        console.log(`[DEBUG] ${message}`, data || '');
      }
    } catch (e) {
      // Silently fail - don't let debug utilities break the app
    }
  }
}

export function debugError(message: string, error: any) {
  if (isDevelopment) {
    try {
      console.error(`[ERROR] ${message}`, error);
      
      // Log additional error details
      if (error && typeof error === 'object') {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name,
          ...error
        });
      }
    } catch (e) {
      // Even error logging shouldn't break the app
      // Last resort: try basic console.error
      try {
        console.error(`[ERROR] ${message}`, error);
      } catch {
        // Complete failure - do nothing
      }
    }
  }
}