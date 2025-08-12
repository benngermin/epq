import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { X } from "lucide-react";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (message: string) => void;
  feedbackType: "positive" | "negative";
}

export function FeedbackModal({ isOpen, onClose, onSubmit, feedbackType }: FeedbackModalProps) {
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMessage("");
      // Focus textarea when modal opens
      setTimeout(() => {
        const textarea = document.querySelector('textarea');
        textarea?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Handle ESC key press
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  const handleSubmit = async () => {
    if (!message.trim()) {
      return;
    }
    setIsSubmitting(true);
    await onSubmit(message);
    setIsSubmitting(false);
    onClose();
  };

  if (!isOpen) return null;

  const placeholder = feedbackType === "positive"
    ? "How did this answer meet your expectations or needs?"
    : "What aspects of this response fell short of your expectations?";

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-50 animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-[600px] p-4">
        <div className="bg-background rounded-lg shadow-lg animate-in zoom-in-95 duration-300">
          <div className="border-b p-6 pb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">Feedback</h2>
              <button
                onClick={onClose}
                className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          
          <div className="p-6">
            <label className="text-sm font-medium text-foreground block mb-3">
              Please provide details:
            </label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={placeholder}
              className="min-h-[120px] resize-none"
              autoFocus
            />
          </div>
          
          <div className="flex gap-3 p-6 pt-0">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!message.trim() || isSubmitting}
              className="flex-1 bg-[#003d7a] hover:bg-[#003d7a]/90 text-white"
            >
              {isSubmitting ? "Submitting..." : "Submit"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}