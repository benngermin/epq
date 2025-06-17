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
      return question.topicFocus.length > 40 
        ? question.topicFocus.substring(0, 40) + "..."
        : question.topicFocus;
    }
    
    // Fallback to truncated question text
    if (question.questionText && question.questionText.trim() !== "") {
      const cleanText = question.questionText.replace(/\s+/g, ' ').trim();
      return cleanText.length > 40 
        ? cleanText.substring(0, 40) + "..."
        : cleanText;
    }
    
    return "Question";
  };

  const correctCount = questionStatuses.filter(status => status === "correct").length;
  const incorrectCount = questionStatuses.filter(status => status === "incorrect").length;
  const remainingCount = questionStatuses.filter(status => status === "unanswered").length;

  return (
    <div className={cn(
      "bg-background border-r border-border/30 shadow-sm flex-shrink-0 transition-all duration-300 flex flex-col h-full",
      isCollapsed ? "w-0 overflow-hidden" : "w-56 lg:w-60 xl:w-64 2xl:w-72"
    )}>
      <Card className="rounded-none border-0 border-b border-border/30 flex-shrink-0 bg-card">
        <CardHeader className={cn(
          "transition-all duration-300",
          isCollapsed ? "p-0" : "p-2 lg:p-3 xl:p-4"
        )}>
          <div className="flex justify-between items-center">
            <CardTitle className={cn(
              "text-foreground transition-all duration-300",
              isCollapsed ? "text-0" : "text-sm xl:text-base 2xl:text-lg"
            )}>
              Questions
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onToggleCollapse} className="flex-shrink-0">
              {isCollapsed ? (
                <ChevronRight className="h-3 w-3 xl:h-4 xl:w-4" />
              ) : (
                <ChevronLeft className="h-3 w-3 xl:h-4 xl:w-4" />
              )}
            </Button>
          </div>
          {!isCollapsed && (
            <div className="text-xs xl:text-sm 2xl:text-base text-muted-foreground">
              <span className="text-success">Correct: {correctCount}</span> • 
              <span className="text-error ml-1">Incorrect: {incorrectCount}</span> • 
              <span className="text-muted-foreground ml-1">Remaining: {remainingCount}</span>
            </div>
          )}
        </CardHeader>
      </Card>
      
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <CardContent className="p-2 lg:p-2.5 xl:p-3">
            <div className="flex flex-col gap-1 lg:gap-1.5 xl:gap-2">
              {Array.from({ length: totalQuestions }, (_, index) => {
              const status = questionStatuses[index];
              const isCurrent = index === currentQuestionIndex;
              const isVisited = visitedQuestions.has(index);
              
              return (
                <div key={index} className={cn(
                  "flex items-center gap-1 lg:gap-1.5 xl:gap-2",
                  !isVisited && "opacity-60"
                )}>
                  <span className={cn(
                    "font-bold text-xs lg:text-sm w-3 lg:w-4 xl:w-5 text-center flex-shrink-0",
                    isVisited ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {index + 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "flex-1 h-5 lg:h-6 xl:h-7 justify-between text-xs lg:text-sm font-medium px-1.5 lg:px-2 xl:px-3",
                      isVisited 
                        ? "border-border bg-card text-foreground hover:border-primary hover:bg-accent"
                        : "border-border/50 bg-muted text-muted-foreground hover:border-border hover:bg-accent",
                      isCurrent && "ring-1 ring-primary ring-offset-1"
                    )}
                    onClick={() => onQuestionClick(index)}
                  >
                    <span className="truncate text-left">{getQuestionTitle(index)}</span>
                    {status === "correct" && <Check className="h-2.5 w-2.5 lg:h-3 lg:w-3 xl:h-4 xl:w-4 text-success flex-shrink-0" />}
                    {status === "incorrect" && <X className="h-2.5 w-2.5 lg:h-3 lg:w-3 xl:h-4 xl:w-4 text-error flex-shrink-0" />}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
        </div>
      )}
    </div>
  );
}
