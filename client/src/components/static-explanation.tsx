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
      <div className="flex items-center p-3 border-b">
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

      {/* Footer with feedback and Review Question button */}
      <div className="border-t">
        {/* Feedback section */}
        <div className="p-3 space-y-2">
          <FeedbackButtons
            messageId={messageId}
            questionVersionId={questionVersionId || 0}
            conversation={[
              { id: messageId, role: "assistant", content: explanation }
            ]}
          />
          
          {/* Note about static explanations */}
          <div className="flex items-center justify-center gap-1 text-xs text-gray-500">
            <span>🤖 Pre-written explanation because AI can't be trusted to explain this topic</span>
            <span>•</span>
            <button
              onClick={() => setIsAboutModalOpen(true)}
              className="text-blue-600 hover:text-blue-700 underline"
              data-testid="button-learn-more-static"
            >
              Learn more
            </button>
          </div>
        </div>
        
        {/* Review Question button */}
        <div className="px-3 pb-3">
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