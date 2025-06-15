import { useState, useEffect } from "react";
import { useParams, useLocation, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { QuestionCard } from "@/components/question-card";
import { QuestionNavigation } from "@/components/question-navigation";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function TestPlayer() {
  const [match, params] = useRoute("/test/:runId");
  const runId = params?.runId;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isRailCollapsed, setIsRailCollapsed] = useState(false);

  const { data: testRun, isLoading: testRunLoading, error: testRunError } = useQuery({
    queryKey: [`/api/test-runs/${runId}`],
    enabled: !!runId,
  });

  console.log("Test Player - runId:", runId);
  console.log("Test Player - testRun:", testRun);
  console.log("Test Player - testRunLoading:", testRunLoading);
  console.log("Test Player - testRunError:", testRunError);

  const { data: currentQuestion, isLoading: questionLoading } = useQuery({
    queryKey: [`/api/test-runs/${runId}/question/${currentQuestionIndex}`],
    enabled: !!runId && currentQuestionIndex >= 0,
  });

  const submitAnswerMutation = useMutation({
    mutationFn: async (data: { questionVersionId: number; chosenAnswer: string }) => {
      const res = await apiRequest("POST", `/api/test-runs/${runId}/answers`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/test-runs/${runId}/question/${currentQuestionIndex}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/test-runs/${runId}`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to submit answer",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const completeTestMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/test-runs/${runId}/complete`);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Test completed!",
        description: "Redirecting to dashboard...",
      });
      setTimeout(() => setLocation("/"), 2000);
    },
  });

  // Get answered questions for navigation
  const answeredQuestions = (testRun as any)?.answers || [];
  const totalQuestions = (testRun as any)?.questionOrder?.length || 85;
  const progress = Math.round((currentQuestionIndex / totalQuestions) * 100);

  const navigateToQuestion = (index: number) => {
    if (index >= 0 && index < totalQuestions) {
      setCurrentQuestionIndex(index);
    }
  };

  const handlePrevious = () => {
    navigateToQuestion(currentQuestionIndex - 1);
  };

  const handleNext = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      navigateToQuestion(currentQuestionIndex + 1);
    } else {
      // Last question - complete test
      completeTestMutation.mutate();
    }
  };

  const handleSubmitAnswer = (chosenAnswer: string) => {
    if (!currentQuestion) return;
    
    submitAnswerMutation.mutate({
      questionVersionId: (currentQuestion as any).id,
      chosenAnswer,
    });
  };

  const exitTest = () => {
    setLocation("/");
  };

  if (testRunLoading || questionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Progress value={50} className="w-64 mb-4" />
          <p className="text-muted-foreground">Loading test...</p>
        </div>
      </div>
    );
  }

  if (!testRun || !currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Test not found</h1>
          <Button onClick={() => setLocation("/")}>Return to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="bg-card shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center min-w-0 flex-1">
              <Button variant="ghost" size="sm" onClick={exitTest} className="mr-2 sm:mr-4 flex-shrink-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <span className="font-semibold text-foreground text-sm sm:text-base truncate">
                {(testRun as any)?.practiceTest?.title || "Practice Test"}
              </span>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
              <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                Q {currentQuestionIndex + 1}/{totalQuestions}
              </span>
              <div className="w-16 sm:w-32">
                <Progress value={progress} className="h-2" />
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex h-[calc(100vh-56px)] sm:h-[calc(100vh-64px)]">
        {/* Question Navigation Rail - Hidden on mobile */}
        <div className="hidden lg:block">
          <QuestionNavigation
            testRun={testRun}
            currentQuestionIndex={currentQuestionIndex}
            answeredQuestions={answeredQuestions}
            onQuestionClick={navigateToQuestion}
            isCollapsed={isRailCollapsed}
            onToggleCollapse={() => setIsRailCollapsed(!isRailCollapsed)}
          />
        </div>

        {/* Main Question Area */}
        <div className="flex-1 flex flex-col relative">
          <div className="flex-1 p-4 sm:p-8 pb-20 sm:pb-24 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              <QuestionCard
                question={currentQuestion}
                onSubmitAnswer={handleSubmitAnswer}
                isSubmitting={submitAnswerMutation.isPending}
                testRunId={parseInt(runId!)}
              />
            </div>
          </div>

          {/* Navigation Controls - Only show when question is answered */}
          {(currentQuestion as any)?.userAnswer && (
            <div className="absolute bottom-0 left-0 right-0 border-t bg-card/95 backdrop-blur-sm p-3 sm:p-4 shadow-lg">
              <div className="max-w-4xl mx-auto">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4">
                  <Button
                    variant="outline"
                    onClick={handlePrevious}
                    disabled={currentQuestionIndex === 0}
                    className="flex items-center gap-2 w-full sm:w-auto sm:min-w-[100px] order-2 sm:order-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>

                  <div className="text-xs sm:text-sm text-muted-foreground text-center flex-shrink-0 order-1 sm:order-2">
                    <span className="block sm:hidden">{answeredQuestions.length}/{totalQuestions} answered</span>
                    <span className="hidden sm:block">{answeredQuestions.length} of {totalQuestions} answered</span>
                  </div>

                  <Button
                    onClick={handleNext}
                    disabled={completeTestMutation.isPending}
                    className="flex items-center gap-2 w-full sm:w-auto sm:min-w-[100px] order-3"
                  >
                    {currentQuestionIndex === totalQuestions - 1 ? (
                      completeTestMutation.isPending ? "Completing..." : "Complete Test"
                    ) : (
                      <>
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
