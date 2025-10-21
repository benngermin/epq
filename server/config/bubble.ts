// Bubble API configuration with environment-driven settings
// NOTE: The Content Repository only has a version-test environment, not a live version
// Both production and development should use version-test
export const BUBBLE_BASE_URL = 
  process.env.BUBBLE_BASE_URL ?? 
  'https://ti-content-repository.bubbleapps.io/version-test/api/1.1/obj';

export const BUBBLE_PAGE_SIZE = parseInt(process.env.BUBBLE_PAGE_SIZE ?? '100', 10);

// Additional Bubble configuration
export const BUBBLE_API_KEY = process.env.BUBBLE_API_KEY;