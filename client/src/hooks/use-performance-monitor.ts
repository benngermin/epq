import { useEffect, useRef } from 'react';

interface PerformanceMetrics {
  renderTime: number;
  componentName: string;
  timestamp: number;
}

export function usePerformanceMonitor(componentName: string) {
  const renderStartTime = useRef<number>(0);
  
  // Record render start time immediately when component renders
  renderStartTime.current = performance.now();
  
  useEffect(() => {
    // Calculate render time after DOM update
    const renderEndTime = performance.now();
    const renderTime = renderEndTime - renderStartTime.current;
    
    // Only process metrics in development
    if (import.meta.env.DEV) {
      // Only log slow renders
      if (renderTime > 50) {
        console.warn(`[Performance] ${componentName} took ${renderTime.toFixed(2)}ms to render`);
      }
      
      // Only store metrics for slow renders to reduce sessionStorage writes
      if (renderTime > 50) {
        const metrics: PerformanceMetrics = {
          renderTime,
          componentName,
          timestamp: Date.now()
        };
        
        try {
          // Check if sessionStorage is available before using it
          if (typeof sessionStorage !== 'undefined' && sessionStorage !== null) {
            const existingMetrics = JSON.parse(
              sessionStorage.getItem('performance-metrics') || '[]'
            );
            existingMetrics.push(metrics);
            
            // Keep only last 50 metrics to reduce memory usage
            if (existingMetrics.length > 50) {
              existingMetrics.splice(0, existingMetrics.length - 50);
            }
            
            sessionStorage.setItem('performance-metrics', JSON.stringify(existingMetrics));
          }
        } catch (e) {
          // Ignore sessionStorage errors (quota exceeded, private browsing, etc.)
          if (import.meta.env.DEV) {
            console.warn('Failed to store performance metrics:', e);
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }); // Intentionally runs on every render to measure performance
}