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
  const [hasInitializedIndex, setHasInitializedIndex] = useState(false);
  const [visitedQuestions, setVisitedQuestions] = useState<Set<number>>(new Set());

  const { data: testRun, isLoading: testRunLoading, error: testRunError } = useQuery({
    queryKey: [`/api/test-runs/${runId}`],
    enabled: !!runId,
  });

  // Initialize current question index to first unanswered question when test data loads
  useEffect(() => {
    if (testRun && !hasInitializedIndex) {
      const answeredQuestions = (testRun as any)?.answers || [];
      const questionOrder = (testRun as any)?.questionOrder || [];
      
      // Find first unanswered question
      let firstUnansweredIndex = 0;
      for (let i = 0; i < questionOrder.length; i++) {
        const questionVersionId = questionOrder[i];
        const hasAnswer = answeredQuestions.some((answer: any) => answer.questionVersionId === questionVersionId);
        if (!hasAnswer) {
          firstUnansweredIndex = i;
          break;
        }
        // If we've answered all questions, stay at the last question
        if (i === questionOrder.length - 1) {
          firstUnansweredIndex = i;
        }
      }
      
      setCurrentQuestionIndex(firstUnansweredIndex);
      setHasInitializedIndex(true);
      
      // Mark the initial question as visited
      setVisitedQuestions(prev => new Set(prev).add(firstUnansweredIndex));
    }
  }, [testRun, hasInitializedIndex]);

  // Track visited questions when current question changes
  useEffect(() => {
    if (currentQuestionIndex >= 0) {
      setVisitedQuestions(prev => new Set(prev).add(currentQuestionIndex));
    }
  }, [currentQuestionIndex]);

  console.log("Test Player - runId:", runId);
  console.log("Test Player - testRun:", testRun);
  console.log("Test Player - testRunLoading:", testRunLoading);
  console.log("Test Player - testRunError:", testRunError);

  const { data: currentQuestion, isLoading: questionLoading } = useQuery({
    queryKey: [`/api/test-runs/${runId}/question/${currentQuestionIndex}`],
    enabled: !!runId && currentQuestionIndex >= 0,
  });

  // Fetch all questions for navigation titles
  const { data: allQuestions } = useQuery({
    queryKey: [`/api/test-runs/${runId}/all-questions`],
    enabled: !!runId && !!testRun,
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
  const progress = Math.round((answeredQuestions.length / totalQuestions) * 100);

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
      <nav className="bg-card shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-[2000px] mx-auto px-3 sm:px-4 md:px-6 lg:px-8 xl:px-12">
          <div className="flex justify-between items-center h-12 sm:h-14 md:h-16">
            <div className="flex items-center min-w-0 flex-1">
              <Button variant="ghost" size="sm" onClick={exitTest} className="mr-2 sm:mr-3 md:mr-4 flex-shrink-0 p-1 sm:p-2">
                <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
              <span className="font-semibold text-foreground text-xs sm:text-sm md:text-base lg:text-base truncate">
                {(testRun as any)?.practiceTest?.title || "Practice Test"}
              </span>
            </div>
            <div className="flex items-center space-x-1 sm:space-x-2 md:space-x-3 lg:space-x-4 flex-shrink-0">
              <span className="text-xs sm:text-sm md:text-base text-muted-foreground whitespace-nowrap">
                Q {currentQuestionIndex + 1}/{totalQuestions}
              </span>
              <div className="w-12 sm:w-16 md:w-24 lg:w-32 xl:w-40">
                <Progress value={progress} className="h-1.5 sm:h-2 md:h-2.5" />
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex h-[calc(100vh-48px)] sm:h-[calc(100vh-56px)] md:h-[calc(100vh-64px)]">
        {/* Question Navigation Rail - Show on all screens with responsive sizing */}
        <div className={cn(
          "flex transition-all duration-300 ease-in-out flex-col border-r border-border",
          // Mobile: compact sidebar
          "w-16 sm:w-20 md:w-24",
          // Large screens: full sidebar or collapsed
          "lg:w-72 xl:w-80 2xl:w-96",
          isRailCollapsed && "lg:w-0 lg:overflow-hidden"
        )}>
          <QuestionNavigation
            testRun={testRun}
            currentQuestionIndex={currentQuestionIndex}
            answeredQuestions={answeredQuestions}
            onQuestionClick={navigateToQuestion}
            isCollapsed={isRailCollapsed}
            onToggleCollapse={() => setIsRailCollapsed(!isRailCollapsed)}
            allQuestions={Array.isArray(allQuestions) ? allQuestions : []}
            visitedQuestions={visitedQuestions}
          />
        </div>

        {/* Main Question Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <div className="p-2 sm:p-3 md:p-4 lg:p-6 xl:p-8" style={{ paddingBottom: 'calc(120px + env(safe-area-inset-bottom))' }}>
              <div className={cn(
                "mx-auto w-full",
                isRailCollapsed 
                  ? "max-w-4xl xl:max-w-5xl 2xl:max-w-6xl" 
                  : "max-w-2xl sm:max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl"
              )}>
                <QuestionCard
                  question={currentQuestion}
                  onSubmitAnswer={handleSubmitAnswer}
                  isSubmitting={submitAnswerMutation.isPending}
                  testRunId={parseInt(runId!)}
                />
              </div>
            </div>
          </div>

          {/* Navigation Controls - Only show when question is answered */}
          {(currentQuestion as any)?.userAnswer && (
            <div className="absolute bottom-0 left-0 right-0 border-t bg-card/95 backdrop-blur-sm p-2 sm:p-3 md:p-4 lg:p-5 shadow-lg">
              <div className={cn(
                "mx-auto",
                isRailCollapsed 
                  ? "max-w-5xl xl:max-w-6xl 2xl:max-w-7xl 3xl:max-w-8xl 4xl:max-w-9xl" 
                  : "max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl 3xl:max-w-7xl"
              )}>
                <div className="flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-3 md:gap-4">
                  <Button
                    variant="outline"
                    onClick={handlePrevious}
                    disabled={currentQuestionIndex === 0}
                    className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto sm:min-w-[90px] md:min-w-[100px] lg:min-w-[120px] order-2 sm:order-1 text-xs sm:text-sm md:text-base lg:text-base"
                  >
                    <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                    Previous
                  </Button>

                  <div className="text-xs sm:text-sm md:text-base text-muted-foreground text-center flex-shrink-0 order-1 sm:order-2">
                    <span className="block sm:hidden">{answeredQuestions.length}/{totalQuestions} answered</span>
                    <span className="hidden sm:block lg:hidden">{answeredQuestions.length} of {totalQuestions} answered</span>
                    <span className="hidden lg:block">{answeredQuestions.length} of {totalQuestions} questions answered</span>
                  </div>

                  <Button
                    onClick={handleNext}
                    disabled={completeTestMutation.isPending}
                    className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto sm:min-w-[90px] md:min-w-[100px] lg:min-w-[120px] order-3 text-xs sm:text-sm md:text-base lg:text-base"
                  >
                    {currentQuestionIndex === totalQuestions - 1 ? (
                      completeTestMutation.isPending ? "Completing..." : "Complete Test"
                    ) : (
                      <>
                        Next
                        <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
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
