import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuestionNavigationProps {
  testRun: any;
  currentQuestionIndex: number;
  answeredQuestions: any[];
  onQuestionClick: (index: number) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function QuestionNavigation({
  testRun,
  currentQuestionIndex,
  answeredQuestions,
  onQuestionClick,
  isCollapsed,
  onToggleCollapse,
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

  const correctCount = questionStatuses.filter(status => status === "correct").length;
  const incorrectCount = questionStatuses.filter(status => status === "incorrect").length;
  const remainingCount = questionStatuses.filter(status => status === "unanswered").length;

  return (
    <div className={cn(
      "w-80 bg-card border-r shadow-sm overflow-y-auto transition-transform duration-300",
      isCollapsed && "-translate-x-full"
    )}>
      <Card className="rounded-none border-0 border-b">
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
        
        <CardContent>
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: totalQuestions }, (_, index) => {
              const status = questionStatuses[index];
              const isCurrent = index === currentQuestionIndex;
              
              return (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className={cn(
                    "w-10 h-10 p-0 text-sm font-medium",
                    status === "correct" && "border-green-500 bg-green-500 text-white hover:bg-green-600",
                    status === "incorrect" && "border-red-500 bg-red-500 text-white hover:bg-red-600",
                    status === "unanswered" && "border-gray-300 bg-white text-gray-700 hover:border-gray-400",
                    isCurrent && "ring-2 ring-primary ring-offset-2"
                  )}
                  onClick={() => onQuestionClick(index)}
                >
                  {index + 1}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
