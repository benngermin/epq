import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

// Immediately override fetch before any other code can use it
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = args[0];
    if (typeof url === 'string' && url.includes('/optimized')) {
      console.error('Blocking request to optimized endpoint:', url);
      console.trace('Stack trace for optimized endpoint request');
      // Return a rejected promise instead of making the request
      return Promise.reject(new Error('Optimized endpoint does not exist. Please refresh the page.'));
    }
    return originalFetch.apply(this, args);
  };
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        // Intercept and redirect optimized endpoint queries
        if (Array.isArray(queryKey) && queryKey[0] && typeof queryKey[0] === 'string') {
          const url = queryKey[0];
          if (url.includes('/optimized')) {
            console.error('Intercepted optimized query:', url);
            // Redirect to non-optimized endpoint
            const redirectedUrl = url.replace('/optimized', '');
            const newQueryKey = [redirectedUrl, ...queryKey.slice(1)];
            return getQueryFn({ on401: "throw" })({ queryKey: newQueryKey });
          }
        }
        return getQueryFn({ on401: "throw" })({ queryKey });
      },
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 30 * 60 * 1000, // Increased to 30 minutes for better caching
      gcTime: 60 * 60 * 1000, // Keep data for 1 hour in cache
      retry: (failureCount, error) => {
        // Don't retry on 401/403/404 errors
        if (error && typeof error === 'object' && 'message' in error) {
          const message = String(error.message);
          if (message.includes('401') || message.includes('403') || message.includes('404') || message.includes('optimized')) {
            return false;
          }
        }
        // Retry only once for other errors
        return failureCount < 1;
      },
      retryDelay: () => 1000, // Fixed 1 second delay for faster retries
    },
    mutations: {
      retry: false, // Don't retry mutations by default
    },
  },
});
