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
    console.log('\n=== CLIENT AUTH PAGE LOADED ===');
    console.log('Version: 2.2 - With enhanced authentication flow debugging');
    
    // Enhanced parameter logging for debugging
    const params = new URLSearchParams(searchParams);
    console.log('\nURL Parameters Received:');
    console.log('  Full URL:', window.location.href);
    console.log('  Search params:', window.location.search);
    console.log('  courseId (camelCase):', params.get('courseId') || 'NOT PRESENT');
    console.log('  course_id (underscore):', params.get('course_id') || 'NOT PRESENT');
    console.log('  assignmentName (camelCase):', params.get('assignmentName') || 'NOT PRESENT');
    console.log('  assignment_name (underscore):', params.get('assignment_name') || 'NOT PRESENT');
    
    if (params.get('course_id')) {
      console.log('  ✓ Found course_id parameter:', params.get('course_id'));
      console.log('  ℹ️ This will be preserved through SSO flow');
    }
    if (params.get('courseId')) {
      console.log('  ✓ Found courseId parameter:', params.get('courseId'));
      console.log('  ℹ️ This will be preserved through SSO flow');
    }
    if (!params.get('course_id') && !params.get('courseId')) {
      console.log('  ⚠️ No course parameter found - will use default course');
    }
  }, [searchParams]);
  
  // Parse and validate URL params
  const urlParams = new URLSearchParams(searchParams);
  
  // Critical debugging - log the raw URL and all parameters
  console.log('\n🚨 CRITICAL URL PARAMETER DEBUGGING');
  console.log('  Current window.location.href:', window.location.href);
  console.log('  Current window.location.search:', window.location.search);
  console.log('  searchParams string:', searchParams);
  console.log('  urlParams.toString():', urlParams.toString());
  console.log('  All URL parameters:');
  Array.from(urlParams.entries()).forEach(([key, value]) => {
    console.log(`    ${key}: ${value}`);
  });
  
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
      
      console.log('\n🔍 SSO AUTO-REDIRECT - PARAMETER CHECK');
      console.log('  Raw courseId extracted:', courseId);
      console.log('  Raw assignmentName extracted:', assignmentName);
      console.log('  Course ID type:', typeof courseId);
      console.log('  Course ID validation regex test:', courseId ? /^\d+$/.test(courseId) : 'N/A');
      
      // Validate courseId (should be numeric)
      const validCourseId = courseId && /^\d+$/.test(courseId) ? courseId : null;
      // Validate assignmentName (alphanumeric, spaces, dashes, underscores only)
      const validAssignmentName = assignmentName && /^[a-zA-Z0-9\s\-_]+$/.test(assignmentName) ? assignmentName : null;
      
      console.log('  Valid courseId after validation:', validCourseId);
      console.log('  Valid assignmentName after validation:', validAssignmentName);
      
      let ssoUrl = authConfig.cognitoLoginUrl;
      const ssoParams = new URLSearchParams();
      
      if (validCourseId) {
        ssoParams.append('courseId', validCourseId);
        ssoParams.append('course_id', validCourseId); // Also send underscore version
      }
      if (validAssignmentName) {
        ssoParams.append('assignmentName', validAssignmentName);
        ssoParams.append('assignment_name', validAssignmentName); // Also send underscore version
      }
      
      if (ssoParams.toString()) {
        ssoUrl += (ssoUrl.includes('?') ? '&' : '?') + ssoParams.toString();
      }
      
      console.log('\n🔄 AUTO-REDIRECTING TO SSO');
      console.log('  Base SSO URL:', authConfig.cognitoLoginUrl);
      console.log('  Final SSO URL:', ssoUrl);
      console.log('  URL params being sent:', ssoParams.toString());
      console.log('  With courseId:', validCourseId || 'NONE');
      console.log('  With assignmentName:', validAssignmentName || 'NONE');
      
      // Small delay to ensure logs are visible
      setTimeout(() => {
        window.location.href = ssoUrl;
      }, 100);
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
                
                console.log('\n🔍 SSO BUTTON CLICK - PARAMETER CHECK');
                console.log('  Raw courseId extracted:', courseId);
                console.log('  Raw assignmentName extracted:', assignmentName);
                
                // Validate parameters
                const validCourseId = courseId && /^\d+$/.test(courseId) ? courseId : null;
                const validAssignmentName = assignmentName && /^[a-zA-Z0-9\s\-_]+$/.test(assignmentName) ? assignmentName : null;
                
                let ssoUrl = authConfig.cognitoLoginUrl!;
                const ssoParams = new URLSearchParams();
                
                if (validCourseId) {
                  ssoParams.append('courseId', validCourseId);
                  ssoParams.append('course_id', validCourseId); // Also send underscore version
                }
                if (validAssignmentName) {
                  ssoParams.append('assignmentName', validAssignmentName);
                  ssoParams.append('assignment_name', validAssignmentName); // Also send underscore version  
                }
                
                if (ssoParams.toString()) {
                  ssoUrl += (ssoUrl.includes('?') ? '&' : '?') + ssoParams.toString();
                }
                
                console.log('\n🔐 SSO BUTTON CLICKED');
                console.log('  Base SSO URL:', authConfig.cognitoLoginUrl);
                console.log('  Final redirect URL:', ssoUrl);
                console.log('  URL params being sent:', ssoParams.toString());
                console.log('  With courseId:', validCourseId || 'NONE');
                console.log('  With assignmentName:', validAssignmentName || 'NONE');
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
