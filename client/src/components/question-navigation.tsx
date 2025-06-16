import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuestionNavigationProps {
  testRun: any;
  currentQuestionIndex: number;
  answeredQuestions: any[];
  onQuestionClick: (index: number) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  allQuestions: any[];
  visitedQuestions: Set<number>;
}

export function QuestionNavigation({
  testRun,
  currentQuestionIndex,
  answeredQuestions,
  onQuestionClick,
  isCollapsed,
  onToggleCollapse,
  allQuestions,
  visitedQuestions,
}: QuestionNavigationProps) {
  const totalQuestions = testRun.questionOrder?.length || 85;
  
  // Create array of question statuses
  const questionStatuses = Array.from({ length: totalQuestions }, (_, index) => {
    const answer = answeredQuestions.find(a => {
      const questionVersionId = testRun.questionOrder[index];
      return a.questionVersionId === questionVersionId;
    });
    
    if (!answer) return "unanswered";
    return answer.isCorrect ? "correct" : "incorrect";
  });

  // Function to generate meaningful title for each question
  const getQuestionTitle = (index: number): string => {
    if (!allQuestions || allQuestions.length <= index) {
      return "Question";
    }
    
    const question = allQuestions[index];
    if (!question) return "Question";
    
    // Use topic focus if available
    if (question.topicFocus && question.topicFocus.trim() !== "") {
      return question.topicFocus.length > 25 
        ? question.topicFocus.substring(0, 25) + "..."
        : question.topicFocus;
    }
    
    // Fallback to truncated question text
    if (question.questionText && question.questionText.trim() !== "") {
      const cleanText = question.questionText.replace(/\s+/g, ' ').trim();
      return cleanText.length > 25 
        ? cleanText.substring(0, 25) + "..."
        : cleanText;
    }
    
    return "Question";
  };

  const correctCount = questionStatuses.filter(status => status === "correct").length;
  const incorrectCount = questionStatuses.filter(status => status === "incorrect").length;
  const remainingCount = questionStatuses.filter(status => status === "unanswered").length;

  return (
    <div className={cn(
      "w-64 bg-card border-r shadow-sm flex-shrink-0 transition-all duration-300 flex flex-col h-full",
      isCollapsed && "w-0 overflow-hidden"
    )}>
      <Card className="rounded-none border-0 border-b flex-shrink-0">
        <CardHeader className="pb-4">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg">Questions</CardTitle>
            <Button variant="ghost" size="sm" onClick={onToggleCollapse}>
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="text-sm text-muted-foreground">
            <span className="text-green-600">Correct: {correctCount}</span> • 
            <span className="text-red-600 ml-1">Incorrect: {incorrectCount}</span> • 
            <span className="text-gray-500 ml-1">Remaining: {remainingCount}</span>
          </div>
        </CardHeader>
      </Card>
      
      <div className="flex-1 overflow-y-auto">
        <CardContent className="p-4">
          <div className="flex flex-col gap-2">
            {Array.from({ length: totalQuestions }, (_, index) => {
              const status = questionStatuses[index];
              const isCurrent = index === currentQuestionIndex;
              const isVisited = visitedQuestions.has(index);
              
              return (
                <div key={index} className={cn(
                  "flex items-center gap-2",
                  !isVisited && "opacity-60"
                )}>
                  <span className={cn(
                    "font-bold text-sm w-6 text-center flex-shrink-0",
                    isVisited ? "text-gray-600" : "text-gray-400"
                  )}>
                    {index + 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "flex-1 h-8 justify-between text-sm font-medium",
                      isVisited 
                        ? "border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50"
                        : "border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300 hover:bg-gray-100",
                      isCurrent && "ring-2 ring-primary ring-offset-2"
                    )}
                    onClick={() => onQuestionClick(index)}
                  >
                    <span>{getQuestionTitle(index)}</span>
                    {status === "correct" && <Check className="h-4 w-4 text-green-600" />}
                    {status === "incorrect" && <X className="h-4 w-4 text-red-600" />}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </div>
    </div>
  );
}
