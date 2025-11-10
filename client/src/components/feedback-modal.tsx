import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { X } from "lucide-react";
import { useLocation } from "wouter";
import { useKeyboardHeight } from "@/hooks/use-keyboard-height";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (message: string) => void;
  feedbackType: "positive" | "negative";
}

export function FeedbackModal({ isOpen, onClose, onSubmit, feedbackType }: FeedbackModalProps) {
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [location] = useLocation();
  const isMobileView = location.startsWith("/mobile-view");
  const isMobile = useIsMobile();
  const { isVisible: isKeyboardVisible, height: keyboardHeight } = useKeyboardHeight();

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

  // Calculate modal positioning based on keyboard visibility for mobile-view
  const getModalPositioning = () => {
    if (isMobileView && isMobile && isKeyboardVisible) {
      // Position modal at top when keyboard is visible
      return {
        position: "fixed" as const,
        top: "10px",
        left: "50%",
        transform: "translateX(-50%)",
        maxHeight: `calc(100vh - ${keyboardHeight}px - 20px)`,
        overflowY: "auto" as const
      };
    } else if (isMobileView && isMobile) {
      // Mobile view without keyboard - position slightly higher
      return {
        position: "fixed" as const,
        top: "20%",
        left: "50%",
        transform: "translateX(-50%)",
        maxHeight: "80vh",
        overflowY: "auto" as const
      };
    } else {
      // Default desktop positioning
      return {
        position: "fixed" as const,
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)"
      };
    }
  };

  const modalStyle = getModalPositioning();

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-50 animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        className={cn(
          "z-50 w-full max-w-[600px] p-4",
          isMobileView && isMobile ? "px-2" : ""
        )}
        style={modalStyle}
      >
        <div className={cn(
          "bg-background rounded-lg shadow-lg animate-in",
          isKeyboardVisible && isMobileView ? "" : "zoom-in-95",
          "duration-300",
          isMobileView && isMobile && isKeyboardVisible ? "max-h-full overflow-hidden flex flex-col" : ""
        )}>
          <div className="border-b p-4 sm:p-6 sm:pb-4 flex-shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-lg sm:text-xl font-semibold text-foreground">
                {feedbackType === "positive" ? "Positive" : "Negative"} Feedback
              </h2>
              <button
                onClick={onClose}
                className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          
          <div className={cn(
            "p-4 sm:p-6",
            isMobileView && isMobile && isKeyboardVisible ? "flex-1 overflow-y-auto min-h-0" : ""
          )}>
            <label className="text-sm font-medium text-foreground block mb-3">
              Please provide details:
            </label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={placeholder}
              className={cn(
                "resize-none",
                isMobileView && isMobile ? "min-h-[80px]" : "min-h-[120px]"
              )}
              autoFocus={!isMobileView} // Disable auto-focus on mobile-view to prevent keyboard jump
            />
          </div>
          
          <div className="flex gap-3 p-4 sm:p-6 pt-0 flex-shrink-0">
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