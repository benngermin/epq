import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route, useSearch } from "wouter";

export function ProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: () => React.JSX.Element;
}) {
  const { user, isLoading } = useAuth();
  const searchParams = useSearch();

  return (
    <Route path={path}>
      {() => {
        if (isLoading) {
          return (
            <div className="flex items-center justify-center min-h-screen">
              <Loader2 className="h-8 w-8 animate-spin text-border" />
            </div>
          );
        }

        if (!user) {
          // For debugging - log everything
          console.log('[ProtectedRoute] Current location:', window.location.href);
          console.log('[ProtectedRoute] Search params from wouter:', searchParams);
          console.log('[ProtectedRoute] Path param:', path);
          
          // Temporarily try basic redirect first to test if auth route works
          console.log('[ProtectedRoute] Redirecting to: /auth');
          return <Redirect to="/auth" />;
        }

        return <Component />;
      }}
    </Route>
  );
}
