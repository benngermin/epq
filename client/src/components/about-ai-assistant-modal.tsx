import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface AboutAIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AboutAIAssistantModal({ isOpen, onClose }: AboutAIAssistantModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-2xl font-bold text-gray-900">
            About the AI Assistant
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-5">
          <p className="text-gray-600 text-base leading-relaxed">
            Our AI assistant provides explanations for why your answers to
            practice exam questions are correct or incorrect. It uses your
            actual course content, making it more accurate than general AI
            tools. However, like all generative AI, it can still make mistakes,
            provide incomplete explanations, or misinterpret concepts.
            Static answers in particular may sometimes be incorrect.
          </p>

          {/* Yellow warning box */}
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-2">
                <p className="text-gray-800">
                  <span className="font-semibold">Important:</span>
                </p>
                <p className="text-gray-700">
                  AI-generated explanations may occasionally be wrong, even
                  when they sound confident. Always verify important information
                  and problem-solving steps against your official study materials
                  and textbooks.
                </p>
              </div>
            </div>
          </div>

          <p className="text-gray-600 text-base leading-relaxed">
            Think of the AI as a helpful study companion that usually explains
            answers correctly, but isn't infallible. Use it to enhance your
            learning, not replace careful study.
          </p>

          <div className="space-y-2">
            <p className="text-gray-800 font-semibold">
              Our Commitment:
            </p>
            <p className="text-gray-600 text-base leading-relaxed">
              We continuously work to improve accuracy by
              grounding the AI in your course content. You can help us by using
              the thumbs up/down buttons to provide feedback on any
              explanation. We review and follow up on all feedback to make the
              tool better for everyone.
            </p>
          </div>

          {/* Continue button */}
          <Button
            onClick={onClose}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-base font-medium"
          >
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}