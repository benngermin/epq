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
    console.log("Auth Page Version: 2.1 - Updated with dual parameter support");
    console.log("Features: SSO + Admin Login buttons + dual parameter support");
    
    // Enhanced parameter logging for debugging
    const params = new URLSearchParams(searchParams);
    console.log('Auth Page Parameter Debug:', {
      fullUrl: window.location.href,
      search: window.location.search,
      courseId: params.get('courseId'),
      course_id: params.get('course_id'),
      assignmentName: params.get('assignmentName'),
      assignment_name: params.get('assignment_name'),
      timestamp: new Date().toISOString()
    });
  }, [searchParams]);
  
  // Parse and validate URL params
  const urlParams = new URLSearchParams(searchParams);
  
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
      hasUser: !!user
    });
    
    if (authConfig?.ssoRequired && authConfig?.cognitoLoginUrl && !user) {
      // Preserve and validate URL parameters when redirecting to SSO
      // Support both course_id and courseId formats
      const courseId = urlParams.get('courseId') || urlParams.get('course_id');
      const assignmentName = urlParams.get('assignmentName') || urlParams.get('assignment_name');
      
      // Validate courseId (should be numeric)
      const validCourseId = courseId && /^\d+$/.test(courseId) ? courseId : null;
      // Validate assignmentName (alphanumeric, spaces, dashes, underscores only)
      const validAssignmentName = assignmentName && /^[a-zA-Z0-9\s\-_]+$/.test(assignmentName) ? assignmentName : null;
      
      let ssoUrl = authConfig.cognitoLoginUrl;
      const ssoParams = new URLSearchParams();
      
      if (validCourseId) {
        ssoParams.append('courseId', validCourseId);
      }
      if (validAssignmentName) {
        ssoParams.append('assignmentName', validAssignmentName);
      }
      
      if (ssoParams.toString()) {
        ssoUrl += (ssoUrl.includes('?') ? '&' : '?') + ssoParams.toString();
      }
      
      console.log('Redirecting to SSO with params:', ssoUrl);
      window.location.href = ssoUrl;
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
                // Support both course_id and courseId formats
                const courseId = urlParams.get('courseId') || urlParams.get('course_id');
                const assignmentName = urlParams.get('assignmentName') || urlParams.get('assignment_name');
                
                // Validate parameters
                const validCourseId = courseId && /^\d+$/.test(courseId) ? courseId : null;
                const validAssignmentName = assignmentName && /^[a-zA-Z0-9\s\-_]+$/.test(assignmentName) ? assignmentName : null;
                
                let ssoUrl = authConfig.cognitoLoginUrl!;
                const ssoParams = new URLSearchParams();
                
                if (validCourseId) {
                  ssoParams.append('courseId', validCourseId);
                }
                if (validAssignmentName) {
                  ssoParams.append('assignmentName', validAssignmentName);
                }
                
                if (ssoParams.toString()) {
                  ssoUrl += (ssoUrl.includes('?') ? '&' : '?') + ssoParams.toString();
                }
                
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
