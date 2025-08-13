import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, GraduationCap, BookOpen, ChevronRight, ChevronLeft, CheckCircle, XCircle, RotateCcw, PanelLeft, LogOut } from "lucide-react";
import institutesLogo from "@assets/the-institutes-logo_1750194170496.png";
import { OptimizedImage } from "@/components/optimized-image";

import { useState } from "react";
import { QuestionCard } from "@/components/question-card";
import { SimpleStreamingChat } from "@/components/simple-streaming-chat";

export default function QuestionSetPractice() {
  const { user, logoutMutation } = useAuth();
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/question-set/:id");

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [showChat, setShowChat] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showBeginDialog, setShowBeginDialog] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const [chatResetTimestamp, setChatResetTimestamp] = useState(Date.now());

  const questionSetId = parseInt(params?.id || "0");

  const { data: questionSet, isLoading: questionSetLoading, error: questionSetError } = useQuery({
    queryKey: ["/api/question-sets", questionSetId],
    queryFn: () => fetch(`/api/question-sets/${questionSetId}`, { 
      credentials: "include" 
    }).then(res => {
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    }),
    enabled: !!questionSetId,
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const { data: courses } = useQuery({
    queryKey: ["/api/courses"],
    queryFn: () => fetch("/api/courses", { 
      credentials: "include" 
    }).then(res => {
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    }),
  });

  const course = courses?.find((c: any) => c.id === questionSet?.courseId);

  // Fetch all question sets for the current course
  const { data: courseQuestionSets } = useQuery({
    queryKey: ["/api/courses", questionSet?.courseId, "question-sets"],
    queryFn: () => fetch(`/api/courses/${questionSet?.courseId}/question-sets`, { 
      credentials: "include" 
    }).then(res => {
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    }),
    enabled: !!questionSet?.courseId,
  });

  const { data: questions, isLoading: questionsLoading, error: questionsError } = useQuery({
    queryKey: ["/api/questions", questionSetId],
    queryFn: () => fetch(`/api/questions/${questionSetId}`, { 
      credentials: "include" 
    }).then(res => {
      if (!res.ok) {
        throw new Error(`${res.status}: ${res.statusText}`);
      }
      return res.json();
    }),
    enabled: !!questionSetId && !!questionSet, // Only fetch questions after questionSet is loaded
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  });

  const submitAnswerMutation = useMutation({
    mutationFn: async ({ questionVersionId, answer }: { questionVersionId: number; answer: string }) => {
      const res = await apiRequest("POST", `/api/question-sets/${questionSetId}/answer`, {
        questionVersionId,
        answer,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setSelectedAnswer(data.chosenAnswer);
      setShowChat(true);
    },
    onError: (error: Error) => {
    },
  });

  const currentQuestion = questions?.[currentQuestionIndex];
  const hasAnswered = currentQuestion?.id ? !!userAnswers[currentQuestion.id] : false;

  const handleSubmitAnswer = (answer: string) => {
    if (!currentQuestion?.latestVersion?.id) {
      return;
    }
    
    setUserAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: answer
    }));
    
    submitAnswerMutation.mutate({
      questionVersionId: currentQuestion.latestVersion.id,
      answer,
    });
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < (questions?.length || 0) - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setShowChat(false);
      setSelectedAnswer("");
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      setShowChat(false);
      setSelectedAnswer("");
    }
  };

  const resetMutation = useMutation({
    mutationFn: async () => {
      // Reset user answers by clearing localStorage or making API call
      // For now, we'll just reset the local state
      setUserAnswers({});
      setCurrentQuestionIndex(0);
      setSelectedAnswer("");
      setShowChat(false);
      setIsCardFlipped(false);
      setResetDialogOpen(false);
      setChatResetTimestamp(Date.now()); // Force all chat components to reset
    },
    onSuccess: () => {
    }
  });

  const handleReset = () => {
    resetMutation.mutate();
  };

  if (questionSetLoading || questionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <GraduationCap className="mx-auto h-12 w-12 text-primary animate-pulse mb-4" />
          <p className="text-muted-foreground">Loading questions...</p>
        </div>
      </div>
    );
  }

  // Debug logging
  if (questionSetError || questionsError) {
  }

  if (questionSetError || questionsError) {
    const errorMessage = questionSetError?.message || questionsError?.message || "Failed to load questions. Please try again.";
    const isAuthError = errorMessage.includes('401') || errorMessage.includes('Authentication required');
    
    if (isAuthError) {
      setLocation("/auth");
      return null;
    }
    
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6 text-center">
            <XCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
            <h3 className="text-lg font-semibold mb-2">Error Loading Questions</h3>
            <p className="text-muted-foreground mb-4">
              {errorMessage}
            </p>
            <div className="space-y-2">
              <Button onClick={() => window.location.reload()} className="w-full">
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!questionSet || !questions || questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6 text-center">
            <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Questions Available</h3>
            <p className="text-muted-foreground mb-4">
              This question set doesn't contain any questions yet.
            </p>
            <Button onClick={() => window.location.reload()}>
              Reload Page
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Before You Begin Dialog */}
      <Dialog open={showBeginDialog} onOpenChange={setShowBeginDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold mb-4">Before You Begin</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Warning Box */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-base text-foreground leading-relaxed">
                <span className="font-semibold">Important:</span> These practice questions familiarize you with the exam format, but don't cover every possible topic. Use them alongside other study materials for complete preparation.
              </p>
            </div>
            
            {/* Checkbox */}
            <div className="flex items-center space-x-3">
              <Checkbox
                id="agree-terms"
                checked={agreedToTerms}
                onCheckedChange={(checked) => {
                  if (typeof checked === 'boolean') {
                    setAgreedToTerms(checked);
                  }
                }}
              />
              <label 
                htmlFor="agree-terms" 
                className="text-base text-foreground leading-relaxed cursor-pointer"
              >
                I understand this is a practice tool, not my only study resource.
              </label>
            </div>
            
            {/* Begin Practice Button */}
            <Button
              onClick={() => setShowBeginDialog(false)}
              disabled={!agreedToTerms}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Begin Practice
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Navigation Header */}
      <nav className="bg-card shadow-sm border-b">
        <div className="w-full px-4 md:px-6">
          <div className="flex items-center gap-3 py-4 md:py-3 lg:py-4">
            {/* Course Name - Show only course number on mobile, full title on desktop */}
            <div className="flex-1 min-w-0">
              <h1 
                className="text-lg md:text-xl lg:text-[28px] font-semibold leading-tight
                           truncate whitespace-nowrap" 
                style={{ fontFamily: '"Open Sans", sans-serif' }}
                title={course ? `${course.courseNumber}: ${course.courseTitle}` : "Loading..."}
              >
                <span className="md:hidden">{course?.courseNumber || "Loading..."}</span>
                <span className="hidden md:inline">
                  {course ? `${course.courseNumber}: ${course.courseTitle}` : "Loading..."}
                </span>
              </h1>
            </div>
            
            {/* Center - Logo (Desktop only) */}
            <div className="hidden lg:flex px-4">
              <OptimizedImage 
                src={institutesLogo} 
                alt="The Institutes" 
                className="h-10" 
              />
            </div>
            
            {/* Question Set Dropdown - Always right-aligned */}
            <div className="flex-shrink-0">
              <Select
                value={questionSetId.toString()}
                onValueChange={(value) => setLocation(`/question-set/${value}`)}
              >
                <SelectTrigger className="w-[180px] sm:w-[200px] md:w-[240px] lg:w-[280px] xl:w-[320px] h-9 lg:h-11 text-sm lg:text-[16px] font-medium text-foreground border-2 border-gray-300 hover:border-gray-400 focus:border-blue-500 transition-colors">
                  <SelectValue placeholder="Select a question set" />
                </SelectTrigger>
                <SelectContent>
                  {courseQuestionSets?.map((qs: any) => (
                    <SelectItem key={qs.id} value={qs.id.toString()}>
                      {qs.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </nav>

      

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Mobile Progress Indicator - In Grey Background Area */}
        <div className="lg:hidden bg-muted/40 px-4 py-2">
          <Button
            variant="outline"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex items-center gap-2 bg-background h-auto py-2.5 px-3"
          >
            <PanelLeft className="h-4 w-4 flex-shrink-0" />
            <span className="leading-none inline-block">
              Progress ({Object.keys(userAnswers).length}/{questions.length})
            </span>
          </Button>
        </div>

        <div className="h-full w-full flex flex-col bg-muted/40">
          <div className="flex gap-2 sm:gap-3 md:gap-4 lg:gap-6 flex-1 relative h-full">
          {/* Left Sidebar - Collapsible Progress Bar */}
          <div className={`fixed inset-y-0 left-0 z-50 w-80 bg-background border-r transition-transform duration-300 ease-in-out lg:relative lg:z-auto lg:w-72 xl:w-80 lg:transform-none lg:border-0 lg:h-full ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
            {/* Overlay for mobile */}
            {sidebarOpen && (
              <div 
                className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                onClick={() => setSidebarOpen(false)}
              />
            )}
            
            <Card className="h-full flex flex-col relative z-50 lg:z-auto">
              {/* Close Button for Mobile */}
              <div className="lg:hidden absolute top-4 right-4 z-10">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarOpen(false)}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>

              {/* Desktop Header */}
              <CardHeader className="pb-3 sm:pb-6 flex-shrink-0 hidden lg:block">
                <CardTitle className="text-lg font-semibold">Practice Summary</CardTitle>
                <CardDescription className="text-sm text-muted-foreground">Track your progress through this question set</CardDescription>
                <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center text-sm mt-3 w-full"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Reset All
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reset All Questions?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will clear all your answers and start the question set over from the beginning. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleReset} disabled={resetMutation.isPending}>
                        {resetMutation.isPending ? "Resetting..." : "Reset All"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardHeader>
              
              {/* Mobile/Tablet Header */}
              <CardHeader className="p-4 flex-shrink-0 lg:hidden">
                <CardTitle className="text-lg font-semibold">Practice Summary</CardTitle>
                <CardDescription className="text-sm text-muted-foreground">Track your progress through this question set</CardDescription>
                <div className="mt-3">
                  <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center text-sm w-full"
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Reset All
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Reset All Questions?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will clear all your answers and start the question set over from the beginning. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleReset} disabled={resetMutation.isPending}>
                          {resetMutation.isPending ? "Resetting..." : "Reset All"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardHeader>

              <CardContent className="pt-0 flex-1 flex flex-col min-h-0">
                {/* Summary Stats */}
                <div className="space-y-4 flex-shrink-0">
                  <div className="flex justify-between text-sm">
                    <span>Questions Answered</span>
                    <span>{Object.keys(userAnswers).length} / {questions?.length || 0}</span>
                  </div>
                </div>
                  
                {/* Question list */}
                <div className="space-y-2 flex-1 overflow-y-auto px-1 py-1 mt-4 max-h-[calc(100vh-400px)]">
                  {questions?.map((question: any, index: number) => {
                    const isAnswered = question?.id ? userAnswers[question.id] : false;
                    const isCurrent = index === currentQuestionIndex;
                    const isCorrect = isAnswered && userAnswers[question.id] === question?.latestVersion?.correctAnswer;
                    
                    return (
                      <div
                        key={question.id}
                        className={`flex items-center gap-3 p-3 mx-1 rounded-lg border cursor-pointer transition-all duration-200 hover:bg-muted/70 hover:border-primary/40 hover:shadow-sm hover:scale-[1.02] ${
                          isCurrent 
                            ? "border-primary bg-primary/5" 
                            : isAnswered && isCorrect
                              ? "border-green-200 bg-green-50 hover:bg-green-100/80"
                            : isAnswered && !isCorrect
                              ? "border-red-200 bg-red-50 hover:bg-red-100/80" 
                              : "border-muted-foreground/20"
                        }`}
                        onClick={() => {
                          setCurrentQuestionIndex(index);
                          setShowChat(false);
                          setSelectedAnswer("");
                          setSidebarOpen(false); // Close sidebar on mobile after selection
                        }}
                      >
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                          isCurrent
                            ? "bg-primary text-primary-foreground"
                            : isAnswered && isCorrect
                              ? "bg-green-500 text-white"
                            : isAnswered && !isCorrect
                              ? "bg-red-500 text-white"
                              : "bg-muted text-muted-foreground"
                        }`}>
                          {isAnswered ? (
                            isCorrect ? (
                              <CheckCircle className="h-4 w-4" />
                            ) : (
                              <XCircle className="h-4 w-4" />
                            )
                          ) : (
                            index + 1
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            Question {index + 1}
                          </p>
                        </div>
                        {isCurrent && (
                          <div className="w-2 h-2 bg-primary rounded-full"></div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Main Content - Question and Chat */}
          <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden px-2 sm:px-3 md:px-4 pt-0 sm:pt-3 md:pt-4 pb-4">
            <div className="flex-1 overflow-y-auto flex items-center justify-center min-h-0">
              <div className="w-full max-w-4xl mx-auto">
                <QuestionCard
                  question={{
                    ...currentQuestion,
                    questionIndex: currentQuestionIndex,
                    userAnswer: userAnswers[currentQuestion?.id] ? {
                      chosenAnswer: userAnswers[currentQuestion.id],
                      isCorrect: userAnswers[currentQuestion.id] === currentQuestion?.latestVersion?.correctAnswer
                    } : null
                  }}
                  onSubmitAnswer={handleSubmitAnswer}
                  isSubmitting={submitAnswerMutation.isPending}
                  testRunId={0} // Not used for question set practice
                  onFlipChange={setIsCardFlipped}
                  onNextQuestion={handleNextQuestion}
                  hasNextQuestion={currentQuestionIndex < questions.length - 1}
                  selectedAnswer={selectedAnswer}
                  chatResetTimestamp={chatResetTimestamp}
                />
              </div>
            </div>

            {/* Navigation Controls at Bottom - Always visible */}
            <div className="bg-background border-t border-border p-4 flex-shrink-0">
              <div className="max-w-4xl mx-auto flex justify-between">
                <Button
                  variant="outline"
                  onClick={handlePreviousQuestion}
                  disabled={currentQuestionIndex === 0}
                  className="min-w-[120px] bg-[#6B7280] border-[#6B7280] text-white hover:bg-[#6B7280]/90 hover:border-[#6B7280]/90 disabled:bg-gray-300 disabled:border-gray-300 disabled:text-gray-500"
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>
                <div className="hidden sm:flex text-sm text-muted-foreground items-center">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </div>
                <Button
                  variant="outline"
                  onClick={handleNextQuestion}
                  disabled={currentQuestionIndex === questions.length - 1}
                  className="min-w-[120px] bg-[#6B7280] border-[#6B7280] text-white hover:bg-[#6B7280]/90 hover:border-[#6B7280]/90 disabled:bg-gray-300 disabled:border-gray-300 disabled:text-gray-500"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}