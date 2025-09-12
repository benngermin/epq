import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    // Handle authentication errors specially
    if (res.status === 401) {
      // Clear user data from cache
      queryClient.setQueryData(["/api/user"], null);
      // Don't redirect immediately to avoid interrupting the auth flow
      const text = (await res.text()) || "Session expired. Please log in again.";
      throw new Error(`401: ${text}`);
    }
    
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  retryCount: number = 0,
): Promise<Response> {
  try {
    const res = await fetch(url, {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    // Handle 401 with retry for session race conditions - increased retries
    if (res.status === 401 && retryCount < 3 && url.includes('/api/user')) {
      // Wait progressively longer for session to be established
      const delay = Math.min(500 * Math.pow(2, retryCount), 2000); // 500ms, 1s, 2s
      await new Promise(resolve => setTimeout(resolve, delay));
      return apiRequest(method, url, data, retryCount + 1);
    }

    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    // If network error and haven't retried yet, try once more
    if (retryCount < 1 && error instanceof TypeError && error.message.includes('fetch')) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return apiRequest(method, url, data, retryCount + 1);
    }
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export function getQueryFn<T>(options: {
  on401: UnauthorizedBehavior;
}): QueryFunction<T> {
  const { on401: unauthorizedBehavior } = options;
  
  // Create the actual query function with retry logic
  const queryFn: QueryFunction<T> = async ({ queryKey }) => {
    let retryCount = 0;
    
    while (retryCount <= 3) {
      const res = await fetch(queryKey[0] as string, {
        credentials: "include",
      });

      // Handle 401 with retry for /api/user endpoint - increased retries for better session handling
      if (res.status === 401 && retryCount < 3 && queryKey[0] === '/api/user') {
        // Wait progressively longer for session to be established
        const delay = Math.min(500 * Math.pow(2, retryCount), 2000); // 500ms, 1s, 2s
        await new Promise(resolve => setTimeout(resolve, delay));
        retryCount++;
        continue; // Retry the request
      }

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null as T;
      }

      await throwIfResNotOk(res);
      return await res.json() as T;
    }
    
    // If we've exhausted retries, handle as a normal 401
    if (unauthorizedBehavior === "returnNull") {
      return null as T;
    }
    
    throw new Error("401: Authentication failed after retries");
  };
  
  return queryFn;
}



export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 30 * 60 * 1000, // Increased to 30 minutes for better caching
      gcTime: 60 * 60 * 1000, // Keep data for 1 hour in cache
      retry: (failureCount, error) => {
        // Don't retry on 401/403/404 errors
        if (error && typeof error === 'object' && 'message' in error) {
          const message = String(error.message);
          if (message.includes('401') || message.includes('403') || message.includes('404')) {
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
