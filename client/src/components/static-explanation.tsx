import { Button } from "@/components/ui/button";
import { RotateCcw, BookOpen, AlertCircle } from "lucide-react";
import { FeedbackButtons } from "@/components/feedback-buttons";
import { AboutStaticExplanationsModal } from "@/components/about-static-explanations-modal";
import { useState } from "react";

interface StaticExplanationProps {
  explanation: string;
  onReviewQuestion?: () => void;
  questionVersionId?: number;
}

export function StaticExplanation({ explanation, onReviewQuestion, questionVersionId }: StaticExplanationProps) {
  // Split explanation by newlines to handle paragraph formatting
  const paragraphs = explanation.split('\n').filter(line => line.trim());
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  
  // Create a unique message ID for feedback
  const messageId = `static-${questionVersionId}-${Date.now()}`;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center p-2 border-b">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Explanation</h3>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="max-w-3xl mx-auto space-y-3">
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

      {/* Footer with feedback and Review Question button */}
      <div className="border-t">
        {/* Feedback section with custom props */}
        <div className="px-3 py-0.5">
          <FeedbackButtons
            messageId={messageId}
            questionVersionId={questionVersionId || 0}
            conversation={[
              { id: messageId, role: "assistant", content: explanation }
            ]}
            disclaimerText="Expert-authored explanation for this complex topic"
          />
        </div>
        
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
      
      {/* About Static Explanations Modal */}
      <AboutStaticExplanationsModal
        isOpen={isAboutModalOpen}
        onClose={() => setIsAboutModalOpen(false)}
      />
    </div>
  );
}