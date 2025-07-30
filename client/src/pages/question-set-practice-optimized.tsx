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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, GraduationCap, BookOpen, ChevronRight, ChevronLeft, CheckCircle, XCircle, RotateCcw, PanelLeft, LogOut } from "lucide-react";
import institutesLogo from "@assets/the-institutes-logo_1750194170496.png";
import { OptimizedImage } from "@/components/optimized-image";

import { useState, useEffect } from "react";
import { QuestionCard } from "@/components/question-card";
import { SimpleStreamingChat } from "@/components/simple-streaming-chat";
import { debugLog, debugError } from "@/utils/debug";
import { ErrorBoundary } from "@/components/error-boundary";
import { AssessmentErrorFallback } from "@/components/assessment-error-fallback";
import type { Course } from "@shared/schema";

export default function QuestionSetPractice() {
  const { user, isLoading: authLoading, logoutMutation } = useAuth();
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/question-set/:id");
  
  // Redirect to auth if not logged in
  useEffect(() => {
    // Only redirect when we're sure the user is not authenticated (not during loading)
    if (user === null && !authLoading) { // null means definitely not authenticated, undefined means still loading
      setLocation("/auth");
    }
  }, [user, authLoading, setLocation]);

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

  // Handle the case where route doesn't match
  if (!match || !params?.id) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6 text-center">
            <XCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
            <h3 className="text-lg font-semibold mb-2">Invalid Question Set</h3>
            <p className="text-muted-foreground mb-4">
              The question set you're trying to access doesn't exist or the URL is invalid.
            </p>
            <Button onClick={() => setLocation("/dashboard")} className="w-full">
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const questionSetId = parseInt(params.id);
  
  // Reset state when question set changes
  useEffect(() => {
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    setShowChat(false);
    setSelectedAnswer("");
    setIsCardFlipped(false);
    setSidebarOpen(false);
    // Don't show the dialog again when switching between question sets
    // setShowBeginDialog(true);
    // setAgreedToTerms(false);
    setChatResetTimestamp(Date.now());
  }, [questionSetId]);

  // Initialize chat on mount
  useEffect(() => {
    setChatResetTimestamp(Date.now());
  }, [questionSetId]);

  // Fetch all courses for admin dropdown
  const { data: courses } = useQuery<(Course & { questionSets: any[] })[]>({
    queryKey: ["/api/courses"],
    enabled: !!user?.isAdmin, // Only fetch if user is admin
  });

  // Combine all data fetching into a single query for better performance
  const { data: practiceData, isLoading, error } = useQuery({
    queryKey: ["/api/practice-data", questionSetId],
    queryFn: async () => {
      try {
        // First check if we're authenticated
        const authRes = await fetch('/api/user', { credentials: "include" });
        if (!authRes.ok) {
          console.error('Authentication check failed:', authRes.status);
          throw new Error('Authentication required');
        }

        const [questionSetRes, questionsRes] = await Promise.all([
          fetch(`/api/question-sets/${questionSetId}`, { credentials: "include" }),
          fetch(`/api/questions/${questionSetId}`, { credentials: "include" })
        ]);

        // Check if responses are JSON before parsing
        const contentType1 = questionSetRes.headers.get("content-type");
        const contentType2 = questionsRes.headers.get("content-type");
        
        if (!contentType1?.includes("application/json") || !contentType2?.includes("application/json")) {
          throw new Error("Server returned non-JSON response. Please refresh the page.");
        }

        if (!questionSetRes.ok || !questionsRes.ok) {
          if (questionSetRes.status === 401 || questionsRes.status === 401) {
            throw new Error('Authentication required');
          }
          throw new Error(`Failed to load practice data`);
        }

        const questionSet = await questionSetRes.json();
        const questions = await questionsRes.json();

        // Fetch course and question sets info
        const courseRes = await fetch(`/api/courses/${questionSet.courseId}`, { credentials: "include" });
        const questionSetsRes = await fetch(`/api/courses/${questionSet.courseId}/question-sets`, { credentials: "include" });

        const course = courseRes.ok ? await courseRes.json() : null;
        const courseQuestionSets = questionSetsRes.ok ? await questionSetsRes.json() : [];

        debugLog(`Loaded ${questions.length} questions for question set ${questionSetId}`);
        
        // Check for any issues with questions around #36
        const questionAround36 = questions.find((q: any) => q.originalQuestionNumber === 36);
        if (questionAround36) {
          debugLog('Question 36 details:', {
            id: questionAround36.id,
            originalNumber: questionAround36.originalQuestionNumber,
            hasLatestVersion: !!questionAround36.latestVersion,
            latestVersionDetails: questionAround36.latestVersion
          });
        }
        
        return { questionSet, questions, course, courseQuestionSets };
      } catch (error) {
        debugError("Error loading practice data", error);
        throw error;
      }
    },
    enabled: !!questionSetId && !!user, // Only fetch when we have a user
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
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
  });

  const currentQuestion = practiceData?.questions?.[currentQuestionIndex];
  const hasAnswered = currentQuestion?.id ? !!userAnswers[currentQuestion.id] : false;
  
  // Add error boundary check for question data
  useEffect(() => {
    if (practiceData?.questions && currentQuestionIndex >= 0) {
      const q = practiceData.questions[currentQuestionIndex];
      debugLog(`Current question index: ${currentQuestionIndex}`, {
        hasQuestion: !!q,
        questionId: q?.id,
        originalNumber: q?.originalQuestionNumber,
        hasLatestVersion: !!q?.latestVersion,
        totalQuestions: practiceData.questions.length
      });
      
      // Special check for question around index 35-36 (question #36-37)
      if (currentQuestionIndex >= 34 && currentQuestionIndex <= 37) {
        debugLog(`Near question 36 - Index ${currentQuestionIndex}`, {
          question: q,
          nextQuestionExists: !!practiceData.questions[currentQuestionIndex + 1],
          prevQuestionExists: !!practiceData.questions[currentQuestionIndex - 1]
        });
      }
    }
  }, [currentQuestionIndex, practiceData]);

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
    if (!practiceData?.questions || practiceData.questions.length === 0) return;
    
    const maxIndex = practiceData.questions.length - 1;
    if (currentQuestionIndex < maxIndex) {
      debugLog(`Navigating from question ${currentQuestionIndex + 1} to ${currentQuestionIndex + 2}`);
      setCurrentQuestionIndex(prev => Math.min(prev + 1, maxIndex));
      setShowChat(false);
      setSelectedAnswer("");
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => Math.max(prev - 1, 0));
      setShowChat(false);
      setSelectedAnswer("");
    }
  };

  const resetMutation = useMutation({
    mutationFn: async () => {
      // Reset all state to initial values
      setUserAnswers({});
      setCurrentQuestionIndex(0);
      setSelectedAnswer("");
      setShowChat(false);
      setIsCardFlipped(false);
      setResetDialogOpen(false);
      // Force all chat components to reset by updating timestamp
      setChatResetTimestamp(Date.now());
      // Scroll to top of the page
      window.scrollTo(0, 0);
    },
  });

  const handleReset = () => {
    resetMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <GraduationCap className="mx-auto h-12 w-12 text-primary animate-pulse mb-4" />
          <p className="text-muted-foreground">Loading questions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    const errorMessage = error?.message || "Failed to load questions. Please try again.";
    const isAuthError = errorMessage.includes('401') || errorMessage.includes('Authentication required');
    const isJsonError = errorMessage.includes('JSON') || errorMessage.includes('DOCTYPE');
    
    if (isAuthError) {
      setLocation("/auth");
      return null;
    }
    
    // If it's a JSON parsing error, it likely means we're getting HTML instead of JSON
    // This often happens with cached requests to non-existent endpoints
    if (isJsonError) {
      // Clear all caches and reload
      queryClient.clear();
      window.location.reload();
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
              <Button onClick={() => {
                queryClient.clear();
                window.location.reload();
              }} className="w-full">
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!practiceData?.questionSet || !practiceData?.questions || practiceData.questions.length === 0) {
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

  const { questionSet, questions, course, courseQuestionSets } = practiceData;

  return (
    <ErrorBoundary 
      fallback={(props) => (
        <AssessmentErrorFallback 
          {...props} 
          questionIndex={currentQuestionIndex} 
        />
      )}
    >
      <div className="h-screen bg-background overflow-hidden flex flex-col">
      {/* Navigation Header */}
      <nav className="bg-card shadow-sm border-b flex-shrink-0">
        <div className="w-full px-6">
          <div className="flex items-center justify-between h-24 lg:h-20">
            {/* Left - Course Name */}
            <div className="flex-1 min-w-0 max-w-[calc(50%-100px)] lg:max-w-[calc(50%-120px)] xl:max-w-[calc(50%-140px)]">
              <h1 
                className="text-lg lg:text-[28px] font-semibold truncate leading-tight lg:leading-[1.2]" 
                style={{ fontFamily: '"Open Sans", sans-serif' }}
                title={course ? `${course.courseNumber}: ${course.courseTitle}` : "Loading..."}
              >
                {course ? `${course.courseNumber}: ${course.courseTitle}` : "Loading..."}
              </h1>
            </div>
            
            {/* Center - Logo */}
            <div className="hidden lg:flex px-4 mx-4">
              <OptimizedImage 
                src={institutesLogo} 
                alt="The Institutes" 
                className="h-10" 
              />
            </div>
            
            {/* Right - Dropdowns */}
            <div className="flex-1 min-w-0 flex justify-end items-center gap-2 lg:gap-4">
              {/* Logout Button - Admin Only */}
              {user?.isAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => logoutMutation.mutate()}
                  className="h-9 w-9 lg:h-11 lg:w-11 hover:bg-destructive/10 hover:text-destructive flex-shrink-0"
                  title="Logout"
                >
                  <LogOut className="h-4 w-4 lg:h-5 lg:w-5" />
                </Button>
              )}
              
              {/* Course Dropdown - Admin Only */}
              {user?.isAdmin && (
                <Select
                  value={course?.id?.toString() || ""}
                  onValueChange={(value) => {
                    // Find the selected course
                    const selectedCourse = courses?.find(c => c.id.toString() === value);
                    if (selectedCourse && selectedCourse.questionSets && selectedCourse.questionSets.length > 0) {
                      // Update window.currentCourse
                      (window as any).currentCourse = selectedCourse;
                      
                      // Navigate to the first question set of the new course
                      const firstQuestionSet = selectedCourse.questionSets
                        .sort((a, b) => {
                          const aNum = parseInt(a?.title?.match(/\d+/)?.[0] || '0');
                          const bNum = parseInt(b?.title?.match(/\d+/)?.[0] || '0');
                          return aNum - bNum;
                        })[0];
                      
                      setLocation(`/question-set/${firstQuestionSet.id}`);
                    }
                  }}
                >
                  <SelectTrigger className="hidden lg:flex w-[150px] xl:w-[200px] h-11 text-sm lg:text-[16px] font-medium text-foreground border-2 border-gray-300 hover:border-gray-400 focus:border-blue-500 transition-colors">
                    <SelectValue placeholder="Select a course" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses
                      ?.filter((c: any) => c.questionSets && c.questionSets.length > 0)
                      ?.map((c: any) => {
                        // Use the courseNumber field directly
                        let courseNumber = c.courseNumber;
                        
                        return (
                          <SelectItem key={c.id} value={c.id.toString()}>
                            {courseNumber}
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
              )}

              {/* Question Set Dropdown */}
              <Select
                value={questionSetId.toString()}
                onValueChange={(value) => {
                  setLocation(`/question-set/${value}`);
                }}
              >
                <SelectTrigger className="w-[200px] lg:w-[280px] xl:w-[320px] h-9 lg:h-11 text-sm lg:text-[16px] font-medium text-foreground border-2 border-gray-300 hover:border-gray-400 focus:border-blue-500 transition-colors">
                  <SelectValue placeholder="Select a question set" />
                </SelectTrigger>
                <SelectContent>
                  {(() => {
                    // For admins, show question sets from the selected course in the course dropdown
                    // For non-admins, show question sets from the current course
                    const questionSetsToShow = user?.isAdmin && courses 
                      ? courses.find(c => c.id === course?.id)?.questionSets || courseQuestionSets
                      : courseQuestionSets;
                      
                    return questionSetsToShow?.map((qs: any) => (
                      <SelectItem key={qs.id} value={qs.id.toString()}>
                        {qs.title}
                      </SelectItem>
                    ));
                  })()}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex-1 flex overflow-hidden">
        {/* Mobile Control Button */}
        <div className="lg:hidden absolute top-28 left-4 z-10">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex items-center gap-2"
          >
            <PanelLeft className="h-4 w-4" />
            Progress ({Object.keys(userAnswers).length}/{questions.length})
          </Button>
        </div>

        {/* Left Sidebar - Fixed height with proper scrolling */}
        <div className={`fixed lg:relative inset-y-0 left-0 z-50 w-80 lg:w-72 xl:w-80 bg-background border-r transition-transform duration-300 ease-in-out lg:transform-none ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} flex flex-col h-full`}>
          {/* Overlay for mobile */}
          {sidebarOpen && (
            <div 
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}
          
          <Card className="h-full flex flex-col relative z-50 overflow-hidden border-0 rounded-none shadow-none">
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

            {/* Header */}
            <CardHeader className="pb-4 flex-shrink-0">
              <CardTitle className="text-lg font-semibold mb-3">
                {questionSet?.title?.replace(/^CPCU \d+:\s*/, '') || 'Question Set'}
              </CardTitle>
              <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center justify-center text-sm w-full"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset All Questions?</AlertDialogTitle>
                    <AlertDialogDescription className="text-base text-foreground leading-relaxed">
                      This will clear all your answers and start the question set over from the beginning.
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

            <CardContent className="pt-0 flex-1 flex flex-col overflow-hidden">
              {/* Summary Stats */}
              <div className="flex-shrink-0 mb-4">
                <div className="flex justify-between text-sm">
                  <span>Questions Answered</span>
                  <span>{Object.keys(userAnswers).length} / {questions?.length || 0}</span>
                </div>
              </div>
                
              {/* Question list - with proper scrolling */}
              <div className="flex-1 overflow-hidden">
                <div className="h-full overflow-y-auto space-y-2 pr-2 pb-4">
                  {questions?.map((question: any, index: number) => {
                    const isAnswered = question?.id ? userAnswers[question.id] : false;
                    const isCurrent = index === currentQuestionIndex;
                    const isCorrect = isAnswered && userAnswers[question.id] === question?.latestVersion?.correctAnswer;
                    
                    return (
                      <div
                        key={question.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:bg-muted/70 hover:border-primary/40 hover:shadow-sm hover:scale-[1.02] ${
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
                          setSidebarOpen(false);
                        }}
                      >
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium flex-shrink-0 ${
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
                          <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0"></div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Main Content - Question */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 p-4 overflow-hidden">
            <div className="w-full max-w-4xl mx-auto">
              {currentQuestion ? (
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
                  testRunId={0}
                  onFlipChange={setIsCardFlipped}
                  onNextQuestion={handleNextQuestion}
                  hasNextQuestion={currentQuestionIndex < practiceData.questions.length - 1}
                  selectedAnswer={selectedAnswer}
                  chatResetTimestamp={chatResetTimestamp}
                />
              ) : (
                <Card className="max-w-2xl mx-auto">
                  <CardContent className="pt-6 text-center">
                    <p className="text-muted-foreground">Question not found at index {currentQuestionIndex}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Navigation Controls at Bottom - Full Width */}
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
          <div className="text-sm text-muted-foreground flex items-center">
            Question {currentQuestionIndex + 1} of {practiceData.questions.length}
          </div>
          <Button
            variant="outline"
            onClick={handleNextQuestion}
            disabled={currentQuestionIndex === practiceData.questions.length - 1}
            className="min-w-[120px] bg-[#6B7280] border-[#6B7280] text-white hover:bg-[#6B7280]/90 hover:border-[#6B7280]/90 disabled:bg-gray-300 disabled:border-gray-300 disabled:text-gray-500"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>

      {/* Before You Begin Dialog */}
      <Dialog open={showBeginDialog} onOpenChange={setShowBeginDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold mb-4">Before You Begin</DialogTitle>
            <DialogDescription className="sr-only">
              Important information about using this practice tool for exam preparation
            </DialogDescription>
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
    </div>
    </ErrorBoundary>
  );
}