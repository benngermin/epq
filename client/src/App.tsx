import { Switch, Route } from "wouter";
import { lazy, Suspense, useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./hooks/use-auth";
import { QuestionProvider } from "./contexts/question-context";
import { ProtectedRoute } from "./lib/protected-route";
import { initializePerformanceOptimizations } from "./lib/prefetch";

// Lazy load pages for better performance
const NotFound = lazy(() => import("@/pages/not-found"));
const AuthPage = lazy(() => import("@/pages/auth-page"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const TestPlayer = lazy(() => import("@/pages/test-player"));
const AdminPanel = lazy(() => import("@/pages/admin-panel"));
const QuestionSetPractice = lazy(() => import("@/pages/question-set-practice-optimized"));
const Debug = lazy(() => import("@/pages/Debug"));

// Loading component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <ProtectedRoute path="/" component={() => {
          // Redirect to default question set (CPCU 500, Question Set 1 = ID 7)
          window.location.href = "/question-set/7";
          return <PageLoader />;
        }} />
        <ProtectedRoute path="/dashboard" component={Dashboard} />
        <ProtectedRoute path="/test/:runId" component={TestPlayer} />
        <ProtectedRoute path="/question-set/:id" component={QuestionSetPractice} />
        <ProtectedRoute path="/admin" component={AdminPanel} />
        <ProtectedRoute path="/debug" component={Debug} />
        <Route path="/auth" component={AuthPage} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  useEffect(() => {
    // Initialize performance optimizations on app load
    initializePerformanceOptimizations();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <QuestionProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </QuestionProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
