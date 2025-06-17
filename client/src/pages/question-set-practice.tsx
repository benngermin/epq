import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, GraduationCap, LogOut, BookOpen, ChevronRight, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { QuestionCard } from "@/components/question-card";
import { ChatInterface } from "@/components/chat-interface";

export default function QuestionSetPractice() {
  const { user, logoutMutation } = useAuth();
  const [, setLocation] = useLocation();
  const { id } = useParams();
  const { toast } = useToast();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [showChat, setShowChat] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");

  const questionSetId = parseInt(id || "0");

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

  const { data: questions, isLoading: questionsLoading } = useQuery({
    queryKey: ["/api/questions", questionSetId],
    queryFn: () => fetch(`/api/questions/${questionSetId}`, { 
      credentials: "include" 
    }).then(res => {
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
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
      toast({
        title: data.isCorrect ? "Correct!" : "Incorrect",
        description: data.isCorrect ? "Well done!" : "Review the explanation to understand better.",
        variant: data.isCorrect ? "default" : "destructive",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to submit answer",
        description: error.message,
        variant: "destructive",
      });
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/")}
                className="flex items-center"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
              <div className="flex items-center">
                <GraduationCap className="h-6 w-6 text-primary mr-3" />
                <div>
                  <span className="font-semibold text-foreground">{questionSet.title}</span>
                  <p className="text-xs text-muted-foreground">
                    Question {currentQuestionIndex + 1} of {questions.length}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground hidden sm:block">Welcome, {user?.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => logoutMutation.mutate()}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            <span>Progress</span>
            <span>{currentQuestionIndex + 1} / {questions.length}</span>
          </div>
          <Progress value={((currentQuestionIndex + 1) / questions.length) * 100} className="h-2" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Question Section */}
          <div className="space-y-6">
            <QuestionCard
              question={currentQuestion}
              onSubmitAnswer={handleSubmitAnswer}
              isSubmitting={submitAnswerMutation.isPending}
              testRunId={0} // Not used for question set practice
            />

            {/* Navigation */}
            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={handlePreviousQuestion}
                disabled={currentQuestionIndex === 0}
              >
                Previous
              </Button>
              <Button
                onClick={handleNextQuestion}
                disabled={currentQuestionIndex === questions.length - 1}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>

          {/* Chat/Explanation Section */}
          <div className="space-y-6">
            {showChat && currentQuestion?.latestVersion && (
              <ChatInterface
                questionVersionId={currentQuestion.latestVersion.id}
                chosenAnswer={selectedAnswer}
                correctAnswer={currentQuestion.latestVersion.correctAnswer}
              />
            )}

            {/* Question Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Practice Summary</CardTitle>
                <CardDescription>Track your progress through this question set</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Questions Answered</span>
                    <span>{Object.keys(userAnswers).length} / {questions.length}</span>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {questions.map((question: any, index: number) => {
                      const isAnswered = userAnswers[question.id];
                      const isCurrent = index === currentQuestionIndex;
                      
                      return (
                        <Button
                          key={question.id}
                          variant={isCurrent ? "default" : isAnswered ? "secondary" : "outline"}
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            setCurrentQuestionIndex(index);
                            setShowChat(false);
                            setSelectedAnswer("");
                          }}
                        >
                          {index + 1}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}