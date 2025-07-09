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
      
      // Store in session storage for debugging
      const existingMetrics = JSON.parse(
        sessionStorage.getItem('performance-metrics') || '[]'
      );
      existingMetrics.push(metrics);
      
      // Keep only last 100 metrics
      if (existingMetrics.length > 100) {
        existingMetrics.shift();
      }
      
      sessionStorage.setItem('performance-metrics', JSON.stringify(existingMetrics));
    };
  }, [componentName]);
}