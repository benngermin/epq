import { Switch, Route, Redirect } from "wouter";
import { lazy, Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./hooks/use-auth";
import { QuestionProvider } from "./contexts/question-context";
import { ProtectedRoute } from "./lib/protected-route";

// Lazy load pages for better performance
const NotFound = lazy(() => import("@/pages/not-found"));
const AuthPage = lazy(() => import("@/pages/auth-page"));
const CoursePage = lazy(() => import("@/pages/course-page"));
const TestPlayer = lazy(() => import("@/pages/test-player"));
const AdminPanel = lazy(() => import("@/pages/admin-panel"));
const QuestionSetPractice = lazy(() => import("@/pages/question-set-practice"));
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
        <Route path="/">
          <Redirect to="/course/1" />
        </Route>
        <ProtectedRoute path="/course/:courseId" component={CoursePage} />
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
