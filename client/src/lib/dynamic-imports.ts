// Dynamic imports for code splitting and better performance
import { lazy } from 'react';

// Heavy components that should be loaded on demand
export const DynamicAdminPanel = lazy(() => 
  import('@/pages/admin-panel').then(module => ({
    default: module.default
  }))
);

export const DynamicDebug = lazy(() => 
  import('@/pages/Debug').then(module => ({
    default: module.default
  }))
);

export const DynamicTestPlayer = lazy(() => 
  import('@/pages/test-player').then(module => ({
    default: module.default
  }))
);

// Chart components that might be heavy
export const DynamicChart = lazy(() => 
  import('recharts').then(module => ({
    default: module.LineChart
  }))
);