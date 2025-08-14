// Debug utility for tracking question loading issues
const isDevelopment = import.meta.env.MODE === 'development' || import.meta.env.DEV;

export function debugLog(message: string, data?: any) {
  if (isDevelopment) {
    if (typeof window !== 'undefined' && window.location.search.includes('debug=true')) {
      console.log(`[DEBUG] ${message}`, data || '');
    }
  }
}

export function debugError(message: string, error: any) {
  if (isDevelopment) {
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
  }
}