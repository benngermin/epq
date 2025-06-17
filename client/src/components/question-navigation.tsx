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
      return `Question ${index + 1}`;
    }
    
    const question = allQuestions[index];
    if (!question) return `Question ${index + 1}`;
    
    console.log('Question data for index', index, ':', question);
    
    // Use topic focus if available (no truncation)
    if (question.topicFocus && question.topicFocus.trim() !== "") {
      return question.topicFocus;
    }
    
    // Extract a meaningful summary from question text
    if (question.questionText && question.questionText.trim() !== "") {
      const cleanText = question.questionText.replace(/\s+/g, ' ').trim();
      
      // Look for key patterns in insurance questions
      if (cleanText.includes('benefits of') || cleanText.includes('advantages of')) {
        return 'Benefits and advantages of insurance';
      }
      if (cleanText.includes('risk management') || cleanText.includes('risk treatment')) {
        return 'Risk management strategies';
      }
      if (cleanText.includes('sensors') || cleanText.includes('IoT') || cleanText.includes('technology')) {
        return 'Technology in risk management';
      }
      if (cleanText.includes('exposure') || cleanText.includes('limiting')) {
        return 'Exposure limitations and boundaries';
      }
      if (cleanText.includes('facilitate') || cleanText.includes('insurance')) {
        return 'How insurance facilitates operations';
      }
      
      // Extract first meaningful phrase up to 60 characters
      const words = cleanText.split(' ');
      let result = '';
      for (const word of words) {
        if ((result + ' ' + word).length > 60) break;
        result = result ? result + ' ' + word : word;
      }
      
      return result || `Question ${index + 1}`;
    }
    
    return `Question ${index + 1}`;
  };

  const correctCount = questionStatuses.filter(status => status === "correct").length;
  const incorrectCount = questionStatuses.filter(status => status === "incorrect").length;
  const remainingCount = questionStatuses.filter(status => status === "unanswered").length;

  return (
    <div className={cn(
      "bg-background border-r border-border/30 shadow-sm flex-shrink-0 transition-all duration-300 flex flex-col h-full",
      isCollapsed ? "w-0 overflow-hidden" : "w-80 lg:w-96 xl:w-[28rem] 2xl:w-[32rem]"
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
                      "flex-1 h-auto min-h-[4rem] justify-start text-sm font-normal px-4 py-3 text-left whitespace-normal",
                      isVisited 
                        ? "border-border bg-card text-foreground hover:border-primary hover:bg-accent"
                        : "border-border/50 bg-muted text-muted-foreground hover:border-border hover:bg-accent",
                      isCurrent && "ring-2 ring-primary ring-offset-1 border-primary bg-primary/5"
                    )}
                    onClick={() => onQuestionClick(index)}
                  >
                    <div className="flex items-start justify-between w-full gap-3">
                      <div className="text-left leading-relaxed flex-1 overflow-hidden">
                        {getQuestionTitle(index)}
                      </div>
                      <div className="flex-shrink-0 mt-1">
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
