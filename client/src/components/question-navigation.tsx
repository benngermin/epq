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
    const sampleTitles = [
      "How insurance facilitates risk transfer",
      "Using risk treatment to assess exposure",
      "Limiting exposure by setting boundaries", 
      "Use of sensors and IoT in risk management",
      "Technology-related systems security"
    ];
    
    if (!allQuestions || allQuestions.length <= index) {
      return sampleTitles[index % sampleTitles.length];
    }
    
    const question = allQuestions[index];
    if (!question) return sampleTitles[index % sampleTitles.length];
    
    // Use topic focus if available
    if (question.topicFocus && question.topicFocus.trim() !== "") {
      return question.topicFocus.length > 60 
        ? question.topicFocus.substring(0, 60) + "..."
        : question.topicFocus;
    }
    
    // Fallback to truncated question text
    if (question.questionText && question.questionText.trim() !== "") {
      const cleanText = question.questionText.replace(/\s+/g, ' ').trim();
      return cleanText.length > 60 
        ? cleanText.substring(0, 60) + "..."
        : cleanText;
    }
    
    return sampleTitles[index % sampleTitles.length];
  };

  const correctCount = questionStatuses.filter(status => status === "correct").length;
  const incorrectCount = questionStatuses.filter(status => status === "incorrect").length;
  const remainingCount = questionStatuses.filter(status => status === "unanswered").length;

  return (
    <div className={cn(
      "bg-background border-r border-border/30 shadow-sm flex-shrink-0 transition-all duration-300 flex flex-col h-full",
      isCollapsed ? "w-0 overflow-hidden" : "w-64 lg:w-72 xl:w-80 2xl:w-96"
    )}>
      <Card className="rounded-none border-0 border-b border-border/30 flex-shrink-0 bg-card">
        <CardHeader className={cn(
          "transition-all duration-300",
          isCollapsed ? "p-0" : "p-4 lg:p-5 xl:p-6"
        )}>
          <div className="flex justify-between items-center">
            <CardTitle className={cn(
              "text-foreground transition-all duration-300 font-semibold",
              isCollapsed ? "text-0" : "text-lg xl:text-xl"
            )}>
              Practice Summary
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onToggleCollapse} className="flex-shrink-0">
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>
          {!isCollapsed && (
            <div className="mt-2 space-y-2">
              <p className="text-sm text-muted-foreground">
                Track your progress through this question set
              </p>
              <div className="text-sm">
                <div className="font-medium text-foreground mb-1">Questions Answered</div>
                <div className="text-xs text-muted-foreground">
                  {answeredQuestions.length} / {totalQuestions}
                </div>
              </div>
            </div>
          )}
        </CardHeader>
      </Card>
      
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <CardContent className="p-3 lg:p-4 xl:p-5">
            <div className="space-y-2">
              {Array.from({ length: totalQuestions }, (_, index) => {
              const status = questionStatuses[index];
              const isCurrent = index === currentQuestionIndex;
              const isVisited = visitedQuestions.has(index);
              
              return (
                <div key={index} className={cn(
                  "flex items-start gap-3",
                  !isVisited && "opacity-60"
                )}>
                  <div className={cn(
                    "font-bold text-sm w-6 h-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-1",
                    isVisited ? "text-foreground bg-primary/10" : "text-muted-foreground"
                  )}>
                    {index + 1}
                  </div>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 h-auto min-h-[3rem] justify-start text-sm font-normal px-3 py-3 text-left",
                      isVisited 
                        ? "border-border bg-card text-foreground hover:border-primary hover:bg-accent"
                        : "border-border/50 bg-muted text-muted-foreground hover:border-border hover:bg-accent",
                      isCurrent && "ring-2 ring-primary ring-offset-1 border-primary bg-primary/5"
                    )}
                    onClick={() => onQuestionClick(index)}
                  >
                    <div className="flex items-start justify-between w-full gap-2">
                      <span className="text-left leading-5 flex-1 hyphens-auto" style={{ wordBreak: 'break-word' }}>
                        {getQuestionTitle(index)}
                      </span>
                      <div className="flex-shrink-0 mt-0.5">
                        {status === "correct" && <Check className="h-4 w-4 text-green-600" />}
                        {status === "incorrect" && <X className="h-4 w-4 text-red-600" />}
                      </div>
                    </div>
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
