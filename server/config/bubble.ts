// Bubble API configuration with environment-driven settings
export const BUBBLE_BASE_URL = 
  process.env.BUBBLE_BASE_URL ?? 
  (process.env.NODE_ENV === 'production'
    ? 'https://ti-content-repository.bubbleapps.io/api/1.1/obj'
    : 'https://ti-content-repository.bubbleapps.io/version-test/api/1.1/obj');

export const BUBBLE_PAGE_SIZE = parseInt(process.env.BUBBLE_PAGE_SIZE ?? '100', 10);

// Additional Bubble configuration
export const BUBBLE_API_KEY = process.env.BUBBLE_API_KEY;

// Sunset configuration  
// FINAL_REFRESH_SUNSET_ENABLED should be set to true ONLY in production
export const FINAL_REFRESH_SUNSET_ENABLED = process.env.FINAL_REFRESH_SUNSET_ENABLED === 'true';
// FINAL_REFRESH_AUTO_SUNSET is false by default everywhere - sunset must be manual
export const FINAL_REFRESH_AUTO_SUNSET = process.env.FINAL_REFRESH_AUTO_SUNSET === 'true';

// Advisory lock ID for Final Refresh (using a unique number)
export const FINAL_REFRESH_LOCK_ID = 821402;