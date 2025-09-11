import { Button } from "@/components/ui/button";
import { RotateCcw, BookOpen } from "lucide-react";

interface StaticExplanationProps {
  explanation: string;
  onReviewQuestion?: () => void;
}

export function StaticExplanation({ explanation, onReviewQuestion }: StaticExplanationProps) {
  // Split explanation by newlines to handle paragraph formatting
  const paragraphs = explanation.split('\n').filter(line => line.trim());

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center p-4 border-b">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-lg">Explanation</h3>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {paragraphs.map((paragraph, index) => (
            <p 
              key={index} 
              className="text-base leading-relaxed text-foreground whitespace-pre-wrap"
              data-testid={`text-explanation-${index}`}
            >
              {paragraph}
            </p>
          ))}
        </div>
      </div>

      {/* Footer with description and Review Question button */}
      <div className="border-t">
        <div className="p-4 pb-2 bg-muted/10">
          <div className="flex items-center justify-center text-sm text-muted-foreground">
            <BookOpen className="h-4 w-4 mr-2" />
            <span>This is a pre-written explanation for this calculation question</span>
          </div>
        </div>
        <div className="p-4 pt-2">
          {onReviewQuestion && (
            <Button
              onClick={onReviewQuestion}
              variant="outline"
              className="w-full py-2 md:py-3 text-sm md:text-base border-primary text-primary hover:bg-primary hover:text-primary-foreground"
              data-testid="button-review-question"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Review Question
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}