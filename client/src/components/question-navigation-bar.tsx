import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

interface QuestionNavigationBarProps {
  currentQuestionIndex: number;
  totalQuestions: number;
  onPrevious: () => void;
  onNext: () => void;
  canGoNext?: boolean;
  canGoPrevious?: boolean;
  isVisible?: boolean;
  nextButtonText?: string;
  isNextLoading?: boolean;
  statusText?: string;
}

export function QuestionNavigationBar({
  currentQuestionIndex,
  totalQuestions,
  onPrevious,
  onNext,
  canGoNext = true,
  canGoPrevious = true,
  isVisible = true,
  nextButtonText,
  isNextLoading = false,
  statusText,
}: QuestionNavigationBarProps) {
  if (!isVisible) return null;

  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;
  const defaultNextText = isLastQuestion ? "Complete Test" : "Next";
  const buttonText = nextButtonText || defaultNextText;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 z-50">
      <div className="max-w-4xl mx-auto flex justify-between items-center">
        <Button
          variant="outline"
          onClick={onPrevious}
          disabled={currentQuestionIndex === 0 || !canGoPrevious}
          className="min-w-[120px] text-sm font-medium"
        >
          Previous
        </Button>
        <div className="text-sm text-muted-foreground flex items-center font-medium">
          {statusText || `Question ${currentQuestionIndex + 1} of ${totalQuestions}`}
        </div>
        <Button
          onClick={onNext}
          disabled={!canGoNext || isNextLoading}
          className="min-w-[120px] text-sm font-medium bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          {isNextLoading ? "Loading..." : buttonText}
          {!isLastQuestion && !isNextLoading && <ChevronRight className="h-4 w-4 ml-2" />}
        </Button>
      </div>
    </div>
  );
}