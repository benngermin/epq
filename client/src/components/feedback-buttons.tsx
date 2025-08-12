import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { FeedbackModal } from "./feedback-modal";
import { useToast } from "@/hooks/use-toast";

interface FeedbackButtonsProps {
  messageId: string;
  questionVersionId?: number;
  onFeedbackSubmitted?: () => void;
}

export function FeedbackButtons({ messageId, questionVersionId, onFeedbackSubmitted }: FeedbackButtonsProps) {
  const [feedbackState, setFeedbackState] = useState<"positive" | "negative" | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"positive" | "negative">("positive");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const submitFeedback = async (type: "positive" | "negative", message?: string) => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          type,
          message: message || "",
          messageId,
          questionVersionId,
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
      <div className="flex gap-2 mt-2">
        <button
          onClick={handleThumbsUp}
          disabled={!!feedbackState || isSubmitting}
          className={`p-1.5 rounded-md transition-all ${
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
          className={`p-1.5 rounded-md transition-all ${
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

      <FeedbackModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleModalSubmit}
        feedbackType={modalType}
      />
    </>
  );
}