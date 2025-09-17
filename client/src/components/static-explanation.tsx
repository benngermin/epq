import { Button } from "@/components/ui/button";
import { RotateCcw, BookOpen, AlertCircle } from "lucide-react";
import { FeedbackButtons } from "@/components/feedback-buttons";
import { useState, useEffect } from "react";
import { parseTextWithLinks } from "@/lib/text-parser";

interface StaticExplanationProps {
  explanation: string;
  onReviewQuestion?: () => void;
  questionVersionId?: number;
}

export function StaticExplanation({ explanation, onReviewQuestion, questionVersionId }: StaticExplanationProps) {
  const [hasError, setHasError] = useState(false);
  const [processedParagraphs, setProcessedParagraphs] = useState<string[]>([]);
  
  useEffect(() => {
    try {
      // Validate and process explanation text
      if (!explanation || typeof explanation !== 'string' || explanation.trim().length === 0) {
        setHasError(true);
        setProcessedParagraphs(['No explanation is available for this question.']);
        return;
      }
      
      // Sanitize explanation text (remove potentially harmful content)
      const sanitizedExplanation = explanation
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Remove iframe tags
        .trim();
      
      // Split explanation by newlines and filter out empty lines
      // Handle edge cases: single line, multiple consecutive newlines, etc.
      const lines = sanitizedExplanation.split(/\n+/);
      const filtered = lines
        .map(line => line.trim())
        .filter(line => line.length > 0);
      
      // If no valid paragraphs after filtering, show error message
      if (filtered.length === 0) {
        setHasError(true);
        setProcessedParagraphs(['The explanation content appears to be empty.']);
      } else {
        setHasError(false);
        setProcessedParagraphs(filtered);
      }
    } catch (error) {
      console.error('Error processing static explanation:', error);
      setHasError(true);
      setProcessedParagraphs(['An error occurred while processing the explanation.']);
    }
  }, [explanation]);
  
  // Create a unique message ID for feedback - handle missing questionVersionId
  const messageId = `static-${questionVersionId || 'unknown'}-${Date.now()}`;
  
  // Use validated questionVersionId, default to 0 if invalid
  const validQuestionVersionId = questionVersionId && questionVersionId > 0 ? questionVersionId : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center p-2 border-b">
        <div className="flex items-center gap-2">
          {hasError ? (
            <AlertCircle className="h-4 w-4 text-orange-500" />
          ) : (
            <BookOpen className="h-4 w-4 text-primary" />
          )}
          <h3 className="font-semibold">
            {hasError ? 'Explanation Unavailable' : 'Explanation'}
          </h3>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="max-w-3xl mx-auto space-y-3">
          {processedParagraphs.length > 0 ? (
            processedParagraphs.map((paragraph, index) => (
              <p 
                key={`paragraph-${index}`} 
                className={`text-base leading-relaxed whitespace-pre-wrap ${
                  hasError ? 'text-muted-foreground italic' : 'text-foreground'
                }`}
                data-testid={`text-explanation-${index}`}
              >
                {hasError ? paragraph : parseTextWithLinks(paragraph)}
              </p>
            ))
          ) : (
            <p className="text-muted-foreground italic">
              No explanation content available.
            </p>
          )}
        </div>
      </div>

      {/* Footer with feedback and Review Question button */}
      <div className="border-t">
        {/* Only show feedback buttons if we have valid content and not an error */}
        {!hasError && processedParagraphs.length > 0 && (
          <div className="px-3 py-1 pt-[0px] pb-[0px]">
            <FeedbackButtons
              messageId={messageId}
              questionVersionId={validQuestionVersionId}
              conversation={[
                { id: messageId, role: "assistant", content: processedParagraphs.join('\n\n') }
              ]}
              disclaimerText="Expert-authored explanation for this complex topic"
              variant="static"
            />
          </div>
        )}
        
        {/* Review Question button */}
        <div className="px-3 pb-2">
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