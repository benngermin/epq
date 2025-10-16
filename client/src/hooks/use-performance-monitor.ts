import { useEffect, useRef } from 'react';

interface PerformanceMetrics {
  renderTime: number;
  componentName: string;
  timestamp: number;
}

// Helper function to safely check sessionStorage availability
function isSessionStorageAvailable(): boolean {
  try {
    // Test if sessionStorage exists and is accessible
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return false;
    }
    // Test if we can actually write to it (fails in private browsing on some browsers)
    const testKey = '__performance_test__';
    window.sessionStorage.setItem(testKey, 'test');
    window.sessionStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

export function usePerformanceMonitor(componentName: string) {
  const renderStartTime = useRef<number>(0);
  const isStorageAvailable = useRef<boolean>(isSessionStorageAvailable());
  
  // Record render start time immediately when component renders
  renderStartTime.current = performance.now();
  
  useEffect(() => {
    // Calculate render time after DOM update
    const renderEndTime = performance.now();
    const renderTime = renderEndTime - renderStartTime.current;
    
    // Only process metrics in development
    if (!import.meta.env.DEV) {
      return;
    }
    
    // Only log slow renders
    if (renderTime > 50) {
      console.warn(`[Performance] ${componentName} took ${renderTime.toFixed(2)}ms to render`);
    }
    
    // Only store metrics for slow renders to reduce sessionStorage writes
    if (renderTime > 50 && isStorageAvailable.current) {
      const metrics: PerformanceMetrics = {
        renderTime,
        componentName,
        timestamp: Date.now()
      };
      
      try {
        const existingMetrics = JSON.parse(
          sessionStorage.getItem('performance-metrics') || '[]'
        );
        existingMetrics.push(metrics);
        
        // Keep only last 50 metrics to reduce memory usage
        if (existingMetrics.length > 50) {
          existingMetrics.splice(0, existingMetrics.length - 50);
        }
        
        sessionStorage.setItem('performance-metrics', JSON.stringify(existingMetrics));
      } catch (e) {
        // If storage fails, disable it for future attempts
        isStorageAvailable.current = false;
        if (import.meta.env.DEV) {
          console.warn('Failed to store performance metrics, disabling storage:', e);
        }
      }
    }
    
    // Cleanup function is not needed for performance monitoring
    // as we're not setting up any subscriptions or timers
  }); // Intentionally runs on every render to measure performance
}