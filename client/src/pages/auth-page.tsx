import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Shield, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import institutesLogo from "@assets/the-institutes-logo_1750194170496.png";

export default function AuthPage() {
  const { user, authConfig, demoLoginMutation } = useAuth();
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  
  // Parse error from URL params
  const urlParams = new URLSearchParams(searchParams);
  const error = urlParams.get('error');

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  // Auto-redirect to SSO if it's required
  useEffect(() => {
    console.log('Auth config check:', {
      authConfig,
      ssoRequired: authConfig?.ssoRequired,
      cognitoLoginUrl: authConfig?.cognitoLoginUrl,
      hasUser: !!user
    });
    
    if (authConfig?.ssoRequired && authConfig?.cognitoLoginUrl && !user) {
      console.log('Redirecting to SSO:', authConfig.cognitoLoginUrl);
      // Immediately redirect to SSO
      window.location.href = authConfig.cognitoLoginUrl;
    }
  }, [authConfig, user]);



  const onDemoLogin = () => {
    demoLoginMutation.mutate(undefined, {
      onSuccess: () => setLocation("/"),
    });
  };

  // Show loading state while redirecting to SSO (production only)
  if (authConfig?.ssoRequired && !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="text-center">
          <img src={institutesLogo} alt="The Institutes" className="mx-auto h-12 w-12 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Redirecting to Single Sign-On...</h2>
          <p className="text-muted-foreground">Please wait while we redirect you to the login page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={institutesLogo} alt="The Institutes" className="mx-auto h-12 w-12 mb-4" />
          <h1 className="text-3xl font-bold text-foreground">Exam Practice Questions</h1>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error === 'state_mismatch' && 'Session expired. Please try signing in again.'}
              {error === 'cognito_failed' && 'Authentication failed. Please try again.'}
              {error && !['state_mismatch', 'cognito_failed'].includes(error) && 'An error occurred during sign in.'}
            </AlertDescription>
          </Alert>
        )}

        <div className="mb-6 space-y-3">
          <Button 
            onClick={onDemoLogin}
            variant="default"
            className="w-full"
            disabled={demoLoginMutation.isPending}
          >
            {demoLoginMutation.isPending ? "Signing in..." : "Quick Demo Access"}
          </Button>
          
          {authConfig?.hasCognitoSSO && (
            <Button 
              onClick={() => window.location.href = authConfig.cognitoLoginUrl!}
              variant="outline"
              className="w-full"
            >
              <Shield className="w-4 h-4 mr-2" />
              Sign in with Single Sign-On
            </Button>
          )}
        </div>


      </div>
    </div>
  );
}
