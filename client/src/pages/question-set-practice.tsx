import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, GraduationCap, LogOut, BookOpen, ChevronRight, ChevronLeft, CheckCircle, XCircle, ChevronDown, Settings, User, RotateCcw, PanelLeft } from "lucide-react";
import institutesLogo from "@assets/the-institutes-logo_1750194170496.png";

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

  console.log("Route Match:", match);
  console.log("Route Params:", params);
  const questionSetId = parseInt(params?.id || "0");
  console.log("Parsed Question Set ID:", questionSetId);

  const { data: questionSet, isLoading: questionSetLoading } = useQuery({
    queryKey: ["/api/question-sets", questionSetId],
    queryFn: () => fetch(`/api/question-sets/${questionSetId}`, { 
      credentials: "include" 
    }).then(res => {
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    }),
    enabled: !!questionSetId,
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

  const { data: questions, isLoading: questionsLoading, error: questionsError } = useQuery({
    queryKey: ["/api/questions", questionSetId],
    queryFn: () => fetch(`/api/questions/${questionSetId}`, { 
      credentials: "include" 
    }).then(res => {
      if (!res.ok) {
        console.error(`Questions API error: ${res.status} ${res.statusText}`);
        throw new Error(`${res.status}: ${res.statusText}`);
      }
      return res.json();
    }),
    enabled: !!questionSetId,
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
      console.error("Failed to submit answer:", error.message);
    },
  });

  const currentQuestion = questions?.[currentQuestionIndex];
  const hasAnswered = currentQuestion && userAnswers[currentQuestion.id];

  const handleSubmitAnswer = (answer: string) => {
    if (!currentQuestion?.latestVersion) return;
    
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
    },
    onSuccess: () => {
      console.log("Reset completed successfully");
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
  console.log("Question Set ID:", questionSetId);
  console.log("Question Set Data:", questionSet);
  console.log("Questions Data:", questions);
  console.log("Questions Error:", questionsError);
  console.log("Questions Loading:", questionsLoading);

  if (!questionSet || !questions || questions.length === 0) {
    console.log("Showing no questions available screen");
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6 text-center">
            <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Questions Available</h3>
            <p className="text-muted-foreground mb-4">
              This question set doesn't contain any questions yet.
            </p>
            <Button onClick={() => setLocation("/")}>
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <nav className="bg-card shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <img 
                  src={institutesLogo} 
                  alt="The Institutes" 
                  className="h-6 w-6 text-primary mr-3 cursor-pointer hover:opacity-80 transition-opacity" 
                  onClick={() => setLocation("/")}
                />
                <div>
                  <span 
                    className="font-semibold text-lg text-foreground cursor-pointer hover:text-primary transition-colors"
                    onClick={() => setLocation("/")}
                  >
                    {course?.title && questionSet?.title ? `${course.title}: ${questionSet.title}` : questionSet?.title || "Loading..."}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/")}
                className="hidden lg:flex items-center text-sm"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Return to Dashboard
              </Button>
              <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                      {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.name}</p>
                    <p className="text-sm leading-none text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setLocation("/")}>
                  <GraduationCap className="mr-2 h-4 w-4" />
                  <span>Dashboard</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocation("/admin")}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Admin</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logoutMutation.mutate()}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </nav>

      

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8 pb-24">
        {/* Mobile Control Buttons */}
        <div className="lg:hidden mb-4 flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex items-center gap-2"
          >
            <PanelLeft className="h-4 w-4" />
            Progress ({Object.keys(userAnswers).length}/{questions.length})
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/")}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Button>
        </div>

        <div className="flex gap-2 sm:gap-3 md:gap-4 lg:gap-6 min-h-0 relative">
          {/* Left Sidebar - Collapsible Progress Bar */}
          <div className={`
            fixed inset-y-0 left-0 z-50 w-80 bg-background border-r transition-transform duration-300 ease-in-out lg:relative lg:z-auto lg:w-72 xl:w-80 lg:transform-none lg:border-0
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `}>
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
                    <span>{Object.keys(userAnswers).length} / {questions.length}</span>
                  </div>
                </div>
                  
                {/* Question list */}
                <div className="space-y-2 flex-1 overflow-y-auto px-1 py-1 mt-4">
                  {questions.map((question: any, index: number) => {
                    const isAnswered = userAnswers[question.id];
                    const isCurrent = index === currentQuestionIndex;
                    const isCorrect = isAnswered && userAnswers[question.id] === question.latestVersion?.correctAnswer;
                    
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
                          <p className="text-sm text-muted-foreground truncate">
                            {question.latestVersion?.topicFocus || "General topic"}
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
          <div className="flex-1 min-w-0">
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
              />
            </div>
          </div>

          {/* Fixed Navigation Bar at Bottom - Always visible */}
          <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 z-50">
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
              <div className="text-sm text-muted-foreground flex items-center">
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
  );
}