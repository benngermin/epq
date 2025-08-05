import { useEffect, useRef } from 'react';

interface PerformanceMetrics {
  renderTime: number;
  componentName: string;
  timestamp: number;
}

export function usePerformanceMonitor(componentName: string) {
  const renderStartTime = useRef<number>(0);
  
  useEffect(() => {
    renderStartTime.current = performance.now();
    
    return () => {
      const renderEndTime = performance.now();
      const renderTime = renderEndTime - renderStartTime.current;
      
      // Only log slow renders in development
      if (process.env.NODE_ENV === 'development' && renderTime > 50) {
        console.warn(`[Performance] ${componentName} took ${renderTime.toFixed(2)}ms to render`);
      }
      
      // Store metrics for analysis
      const metrics: PerformanceMetrics = {
        renderTime,
        componentName,
        timestamp: Date.now()
      };
      
      // Store in session storage for debugging (only in development)
      if (process.env.NODE_ENV === 'development') {
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
          // Ignore sessionStorage errors (quota exceeded, etc.)
          console.warn('Failed to store performance metrics:', e);
        }
      }
    };
  }, [componentName]);
}