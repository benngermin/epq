import { createContext, ReactNode, useContext, useEffect } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { insertUserSchema, User as SelectUser, InsertUser } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AuthConfig = {
  hasLocalAuth: boolean;
  hasCognitoSSO: boolean;
  ssoRequired?: boolean;
  cognitoLoginUrl: string | null;
  cognitoDomain: string | null;
};

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  authConfig: AuthConfig | null;
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser, Error, InsertUser>;
};

type LoginData = Pick<InsertUser, "email" | "password">;

export const AuthContext = createContext<AuthContextType | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  
  // Check if we're in demo or mobile-view mode
  const isDemo = window.location.pathname.startsWith('/demo');
  const isMobileView = window.location.pathname.startsWith('/mobile-view');
  const isUnauthenticatedMode = isDemo || isMobileView;
  
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<SelectUser | undefined, Error>({
    queryKey: ["/api/user"],
    queryFn: isUnauthenticatedMode 
      ? async () => ({
          id: isMobileView ? -2 : -1,
          name: isMobileView ? "Mobile User" : "Demo User",
          email: isMobileView ? "mobile@example.com" : "demo@example.com",
          cognitoSub: null,
          password: null,
          isAdmin: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as SelectUser)
      : getQueryFn({ on401: "returnNull" }),
    staleTime: 15 * 60 * 1000, // 15 minutes - longer for user data
    gcTime: 30 * 60 * 1000, // Keep user data cached longer
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: true, // Only refetch on reconnect
    enabled: isUnauthenticatedMode ? true : undefined, // Always enable for demo/mobile-view mode
  });

  const { data: authConfig } = useQuery<AuthConfig>({
    queryKey: ["/api/auth/config"],
    queryFn: async () => {
      const response = await fetch("/api/auth/config");
      return response.json();
    },
    staleTime: 60 * 60 * 1000, // Cache auth config for 1 hour
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      return await res.json();
    },
    onSuccess: (user: SelectUser) => {
      queryClient.setQueryData(["/api/user"], user);
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: InsertUser) => {
      const res = await apiRequest("POST", "/api/register", credentials);
      return await res.json();
    },
    onSuccess: (user: SelectUser) => {
      queryClient.setQueryData(["/api/user"], user);
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Demo login functionality removed - no longer supported

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        authConfig: authConfig ?? null,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
