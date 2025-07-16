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
import { ArrowLeft, GraduationCap, BookOpen, ChevronRight, ChevronLeft, CheckCircle, XCircle, RotateCcw, PanelLeft } from "lucide-react";
import institutesLogo from "@assets/the-institutes-logo_1750194170496.png";
import { OptimizedImage } from "@/components/optimized-image";

import { useState, useEffect } from "react";
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
  const [showBeginDialog, setShowBeginDialog] = useState(true);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [chatResetTimestamp, setChatResetTimestamp] = useState(Date.now());

  const questionSetId = parseInt(params?.id || "0");

  // Combine all data fetching into a single query for better performance
  const { data: practiceData, isLoading, error } = useQuery({
    queryKey: ["/api/practice-data", questionSetId],
    queryFn: async () => {
      const [questionSetRes, questionsRes] = await Promise.all([
        fetch(`/api/question-sets/${questionSetId}`, { credentials: "include" }),
        fetch(`/api/questions/${questionSetId}`, { credentials: "include" })
      ]);

      if (!questionSetRes.ok || !questionsRes.ok) {
        throw new Error(`Failed to load practice data`);
      }

      const questionSet = await questionSetRes.json();
      const questions = await questionsRes.json();

      // Fetch course and question sets info
      const courseRes = await fetch(`/api/courses/${questionSet.courseId}`, { credentials: "include" });
      const questionSetsRes = await fetch(`/api/courses/${questionSet.courseId}/question-sets`, { credentials: "include" });

      const course = courseRes.ok ? await courseRes.json() : null;
      const courseQuestionSets = questionSetsRes.ok ? await questionSetsRes.json() : [];

      return { questionSet, questions, course, courseQuestionSets };
    },
    enabled: !!questionSetId,
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
    if (currentQuestionIndex < (practiceData?.questions?.length || 0) - 1) {
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
    <div className="h-screen bg-background overflow-hidden flex flex-col">
      {/* Navigation Header */}
      <nav className="bg-card shadow-sm border-b flex-shrink-0">
        <div className="w-full px-6">
          <div className="flex items-center h-20 relative">
            {/* Left - Course Name */}
            <div className="flex-1 min-w-0 max-w-[40%]">
              <h1 
                className="text-[28px] font-semibold truncate" 
                style={{ fontFamily: '"Open Sans", sans-serif' }}
                title={course?.title || "Loading..."}
              >
                {course?.title || "Loading..."}
              </h1>
            </div>
            
            {/* Center - Logo (Absolutely positioned) */}
            <div className="absolute left-1/2 transform -translate-x-1/2">
              <OptimizedImage 
                src={institutesLogo} 
                alt="The Institutes" 
                className="h-10" 
              />
            </div>
            
            {/* Right - Question Set Dropdown */}
            <div className="flex-1 flex justify-end items-center">
              <Select
                value={questionSetId.toString()}
                onValueChange={(value) => setLocation(`/question-set/${value}`)}
              >
                <SelectTrigger className="w-[320px] h-11 text-[16px] font-medium text-foreground border-2 border-gray-300 hover:border-gray-400 focus:border-blue-500 transition-colors">
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

      <div className="flex-1 flex overflow-hidden">
        {/* Mobile Control Button */}
        <div className="lg:hidden absolute top-24 left-4 z-10">
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
                          <p className="text-xs text-muted-foreground truncate">
                            {question.latestVersion?.topicFocus || "General topic"}
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
                  onFlipChange={setIsCardFlipped}
                  onNextQuestion={handleNextQuestion}
                  hasNextQuestion={currentQuestionIndex < questions.length - 1}
                  selectedAnswer={selectedAnswer}
                  chatResetTimestamp={chatResetTimestamp}
                />
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
                onCheckedChange={setAgreedToTerms}
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
  );
}