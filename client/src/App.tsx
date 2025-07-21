import { Switch, Route } from "wouter";
import { lazy, Suspense, useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./hooks/use-auth";
import { QuestionProvider } from "./contexts/question-context";
import { ProtectedRoute } from "./lib/protected-route";
import { AdminProtectedRoute } from "./lib/admin-protected-route";

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
        <ProtectedRoute path="/" component={() => <Dashboard />} />
        <ProtectedRoute path="/dashboard" component={() => <Dashboard />} />
        <ProtectedRoute path="/test/:runId" component={() => <TestPlayer />} />
        <ProtectedRoute path="/question-set/:id" component={() => <QuestionSetPractice />} />
        <AdminProtectedRoute path="/admin" component={() => <AdminPanel />} />
        <ProtectedRoute path="/debug" component={() => <Debug />} />
        <Route path="/auth" component={() => <AuthPage />} />
        <Route component={() => <NotFound />} />
      </Switch>
    </Suspense>
  );
}

function App() {
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
