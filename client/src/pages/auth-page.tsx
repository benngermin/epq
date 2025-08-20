import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Shield, AlertCircle, Lock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import institutesLogo from "@assets/the-institutes-logo_1750194170496.png";

export default function AuthPage() {
  const { user, authConfig, loginMutation } = useAuth();
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  
  // Version indicator to verify new code is loaded
  useEffect(() => {
    console.log("Auth Page Version: 2.1 - Updated August 19, 2025");
    console.log("Features: SSO + Admin Login buttons with parameter debugging");
    console.log("useSearch() returned:", searchParams);
    console.log("window.location.search:", window.location.search);
    console.log("window.location.href:", window.location.href);
  }, []);
  
  // Parse and validate URL params - use window.location.search as primary source
  // because wouter's useSearch() might not always return the correct parameters
  const urlParams = new URLSearchParams(window.location.search || searchParams);
  
  // Validate error parameter - only allow specific known error codes
  const rawError = urlParams.get('error');
  const validErrors = ['state_mismatch', 'cognito_failed', 'session_save_failed', 'authentication_failed'];
  const error = rawError && validErrors.includes(rawError) ? rawError : null;
  
  // Log invalid error attempts for security monitoring
  if (rawError && !validErrors.includes(rawError)) {
    console.warn('Invalid error parameter attempted:', rawError);
  }

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
      hasUser: !!user,
      currentUrl: window.location.href,
      searchParams: window.location.search,
      wouterSearchParams: searchParams,
      urlParamsEntries: Array.from(urlParams.entries())
    });
    
    // Add a small delay to ensure all parameters are loaded
    if (authConfig?.ssoRequired && authConfig?.cognitoLoginUrl && !user) {
      setTimeout(() => {
        // Re-parse parameters inside setTimeout to ensure we have the latest values
        const currentUrlParams = new URLSearchParams(window.location.search);
        
        // Preserve and validate URL parameters when redirecting to SSO
        // Support both course_id (with underscore) and courseId (camelCase)
        const courseId = currentUrlParams.get('course_id') || currentUrlParams.get('courseId');
        const assignmentName = currentUrlParams.get('assignmentName');
        
        console.log('SSO auto-redirect - Found parameters:', {
          courseId,
          assignmentName,
          allParams: Array.from(currentUrlParams.entries()),
          rawSearch: window.location.search,
          wouterSearch: searchParams
        });
        
        // Validate courseId (should be numeric)
        const validCourseId = courseId && /^\d+$/.test(courseId) ? courseId : null;
        // Validate assignmentName (alphanumeric, spaces, dashes, underscores only)
        const validAssignmentName = assignmentName && /^[a-zA-Z0-9\s\-_]+$/.test(assignmentName) ? assignmentName : null;
        
        let ssoUrl = authConfig.cognitoLoginUrl;
        if (!ssoUrl) {
          console.error('SSO URL not configured');
          return;
        }
        
        const ssoParams = new URLSearchParams();
        
        if (validCourseId) {
          // Use course_id with underscore to match what the server expects
          ssoParams.append('course_id', validCourseId);
        }
        if (validAssignmentName) {
          ssoParams.append('assignmentName', validAssignmentName);
        }
        
        if (ssoParams.toString()) {
          ssoUrl += (ssoUrl.includes('?') ? '&' : '?') + ssoParams.toString();
        }
        
        console.log('SSO auto-redirect - Final URL:', ssoUrl);
        window.location.href = ssoUrl;
      }, 100); // Small delay to ensure parameters are loaded
    }
  }, [authConfig, user, urlParams]);



  const onLocalLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(
      { email, password },
      {
        onSuccess: () => setLocation("/"),
        onError: (error: any) => {
          // Show error message
          console.error("Login failed:", error);
        }
      }
    );
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
          {authConfig?.hasCognitoSSO && (
            <Button 
              onClick={() => {
                // Preserve and validate URL parameters when clicking SSO button
                // Use window.location.search directly for reliability
                const currentUrlParams = new URLSearchParams(window.location.search);
                // Support both course_id (with underscore) and courseId (camelCase)
                const courseId = currentUrlParams.get('course_id') || currentUrlParams.get('courseId');
                const assignmentName = currentUrlParams.get('assignmentName');
                
                console.log('SSO button clicked - Found parameters:', {
                  courseId,
                  assignmentName,
                  allParams: Array.from(currentUrlParams.entries()),
                  rawSearch: window.location.search,
                  currentUrl: window.location.href
                });
                
                // Validate parameters
                const validCourseId = courseId && /^\d+$/.test(courseId) ? courseId : null;
                const validAssignmentName = assignmentName && /^[a-zA-Z0-9\s\-_]+$/.test(assignmentName) ? assignmentName : null;
                
                let ssoUrl = authConfig.cognitoLoginUrl!;
                const ssoParams = new URLSearchParams();
                
                if (validCourseId) {
                  // Use course_id with underscore to match what the server expects
                  ssoParams.append('course_id', validCourseId);
                }
                if (validAssignmentName) {
                  ssoParams.append('assignmentName', validAssignmentName);
                }
                
                if (ssoParams.toString()) {
                  ssoUrl += (ssoUrl.includes('?') ? '&' : '?') + ssoParams.toString();
                }
                
                console.log('SSO button - Redirecting to:', ssoUrl);
                window.location.href = ssoUrl;
              }}
              variant="default"
              className="w-full"
            >
              <Shield className="w-4 h-4 mr-2" />
              Sign in with Single Sign-On
            </Button>
          )}

          {authConfig?.hasLocalAuth && !showAdminLogin && (
            <Button 
              onClick={() => setShowAdminLogin(true)}
              variant="outline"
              className="w-full"
            >
              <Lock className="w-4 h-4 mr-2" />
              Admin Login
            </Button>
          )}
        </div>

        {showAdminLogin && (
          <Card>
            <CardHeader>
              <CardTitle>Admin Login</CardTitle>
              <CardDescription>
                Non-SSO login is restricted to admin users only
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onLocalLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                {loginMutation.isError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {loginMutation.error?.message || "Invalid email or password"}
                    </AlertDescription>
                  </Alert>
                )}
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? "Signing in..." : "Sign In"}
                </Button>
                <Button 
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setShowAdminLogin(false)}
                >
                  Back
                </Button>
              </form>
            </CardContent>
          </Card>
        )}


      </div>
    </div>
  );
}
