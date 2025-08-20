import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";

export function ProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: () => React.JSX.Element;
}) {
  const { user, isLoading } = useAuth();

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
          // Preserve current URL parameters when redirecting to auth
          const currentSearch = window.location.search;
          const authUrl = currentSearch ? `/auth${currentSearch}` : '/auth';
          
          if (currentSearch) {
            console.log('\n🔒 PROTECTED ROUTE - Redirecting to auth');
            console.log('  Preserving parameters:', currentSearch);
            console.log('  Redirect URL:', authUrl);
          }
          
          return <Redirect to={authUrl} />;
        }

        return <Component />;
      }}
    </Route>
  );
}
