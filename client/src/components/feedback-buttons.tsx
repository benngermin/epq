import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { FeedbackModal } from "./feedback-modal";
import { AboutAIAssistantModal } from "./about-ai-assistant-modal";
import { AboutStaticExplanationsModal } from "./about-static-explanations-modal";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";

interface FeedbackButtonsProps {
  messageId: string;
  questionVersionId?: number;
  conversation?: Array<{id: string, content: string, role: "user" | "assistant"}>;
  onFeedbackSubmitted?: () => void;
  disclaimerText?: string;
  variant?: 'ai' | 'static';
}

export function FeedbackButtons({ messageId, questionVersionId, conversation, onFeedbackSubmitted, disclaimerText, variant = 'ai' }: FeedbackButtonsProps) {
  const [feedbackState, setFeedbackState] = useState<"positive" | "negative" | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"positive" | "negative">("positive");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const submitFeedback = async (type: "positive" | "negative", message?: string) => {
    setIsSubmitting(true);
    try {
      // Check if we're in demo or mobile-view mode
      const isDemo = window.location.pathname.startsWith('/demo');
      const isMobileView = window.location.pathname.startsWith('/mobile-view');
      const isUnauthenticatedMode = isDemo || isMobileView;
      const apiPrefix = isUnauthenticatedMode ? (isDemo ? '/api/demo' : '/api/mobile-view') : '/api';
      const response = await fetch(`${apiPrefix}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          type,
          message: message || "",
          messageId,
          questionVersionId,
          conversation,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit feedback");
      }

      setFeedbackState(type);
      toast({
        title: "Thank you!",
        description: "Your feedback has been received.",
        className: "bg-green-500 text-white border-green-600",
        duration: 3000,
      });

      onFeedbackSubmitted?.();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit feedback. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleThumbsUp = () => {
    if (feedbackState || isSubmitting) return;
    setModalType("positive");
    setIsModalOpen(true);
  };

  const handleThumbsDown = () => {
    if (feedbackState || isSubmitting) return;
    setModalType("negative");
    setIsModalOpen(true);
  };

  const handleModalSubmit = async (message: string) => {
    await submitFeedback(modalType, message);
    setIsModalOpen(false);
  };

  return (
    <>
      <div className="flex items-center justify-between mt-[2px] mb-[2px]">
        <div className={`flex ${isMobile ? 'gap-1' : 'gap-2'}`}>
          <button
            onClick={handleThumbsUp}
            disabled={!!feedbackState || isSubmitting}
            className={`flex items-center gap-1.5 ${isMobile ? 'px-2 py-1' : 'px-2.5 py-1.5'} rounded-md transition-all ${
              feedbackState === "positive"
                ? "bg-blue-100 dark:bg-blue-900"
                : "hover:bg-gray-100 dark:hover:bg-gray-800"
            } ${feedbackState || isSubmitting ? "cursor-not-allowed opacity-50" : "hover:scale-110"}`}
            aria-label="Good response"
          >
            <ThumbsUp
              className={`h-4 w-4 transition-colors ${
                feedbackState === "positive"
                  ? "fill-[#4a90e2] stroke-[#4a90e2]"
                  : "stroke-[#4a90e2]"
              }`}
            />

          </button>
          <button
            onClick={handleThumbsDown}
            disabled={!!feedbackState || isSubmitting}
            className={`flex items-center gap-1.5 ${isMobile ? 'px-2 py-1' : 'px-2.5 py-1.5'} rounded-md transition-all ${
              feedbackState === "negative"
                ? "bg-blue-100 dark:bg-blue-900"
                : "hover:bg-gray-100 dark:hover:bg-gray-800"
            } ${feedbackState || isSubmitting ? "cursor-not-allowed opacity-50" : "hover:scale-110"}`}
            aria-label="Poor response"
          >
            <ThumbsDown
              className={`h-4 w-4 transition-colors ${
                feedbackState === "negative"
                  ? "fill-[#4a90e2] stroke-[#4a90e2]"
                  : "stroke-[#4a90e2]"
              }`}
            />

          </button>
        </div>
        
        {/* AI disclaimer text */}
        <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-gray-500 flex items-center gap-1 whitespace-nowrap`}>
          <span>{disclaimerText ? "📝" : "🤖"} {disclaimerText || "AI responses may be inaccurate"} • </span>
          <button
            onClick={() => setIsAboutModalOpen(true)}
            className="text-blue-600 hover:text-blue-700 underline"
            data-testid={`button-learn-more-${variant}`}
          >
            Learn more
          </button>
        </div>
      </div>

      <FeedbackModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleModalSubmit}
        feedbackType={modalType}
      />
      
      {variant === 'ai' ? (
        <AboutAIAssistantModal
          isOpen={isAboutModalOpen}
          onClose={() => setIsAboutModalOpen(false)}
        />
      ) : (
        <AboutStaticExplanationsModal
          isOpen={isAboutModalOpen}
          onClose={() => setIsAboutModalOpen(false)}
        />
      )}
    </>
  );
}