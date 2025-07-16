// Prefetch critical resources for faster navigation
export function prefetchResource(url: string) {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    requestIdleCallback(() => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = url;
      document.head.appendChild(link);
    });
  } else {
    // Fallback for browsers that don't support requestIdleCallback
    setTimeout(() => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = url;
      document.head.appendChild(link);
    }, 1);
  }
}

// Prefetch API endpoints
export function prefetchApiEndpoint(endpoint: string) {
  if (typeof window !== 'undefined') {
    fetch(endpoint, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'X-Prefetch': 'true',
      },
    }).catch(() => {
      // Silently fail prefetch requests
    });
  }
}

// Preconnect to external domains
export function preconnectToDomain(domain: string) {
  if (typeof window !== 'undefined') {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = domain;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  }
}

// Initialize performance optimizations
export function initializePerformanceOptimizations() {
  // Preconnect to OpenRouter API
  preconnectToDomain('https://openrouter.ai');
  
  // Preconnect to Google Fonts if used
  preconnectToDomain('https://fonts.googleapis.com');
  preconnectToDomain('https://fonts.gstatic.com');
}