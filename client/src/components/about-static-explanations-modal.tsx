import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface AboutStaticExplanationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AboutStaticExplanationsModal({ isOpen, onClose }: AboutStaticExplanationsModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-2xl font-bold text-gray-900">
            About Static Explanations
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-5">
          <p className="text-gray-600 text-base leading-relaxed">
            We provide static explanations for certain types of questions where 
            precise, verified answers are essential. These explanations are 
            carefully crafted by subject matter experts to ensure accuracy, 
            particularly for calculation-based problems and technical concepts 
            where AI-generated responses may not be reliable.
          </p>

          {/* Yellow warning box */}
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-2">
                <p className="text-gray-800">
                  <span className="font-semibold">Why Static Explanations?</span>
                </p>
                <p className="text-gray-700">
                  For questions involving calculations, formulas, or specific 
                  technical procedures, AI cannot always be trusted to provide 
                  accurate answers. Static explanations ensure you receive 
                  correct, consistent information for these critical topics.
                </p>
              </div>
            </div>
          </div>

          <p className="text-gray-600 text-base leading-relaxed">
            If you have questions about the explanation or need further 
            clarification, please use the feedback buttons to let us know, 
            or contact customer support for assistance.
          </p>

          <div className="space-y-2">
            <p className="text-gray-800 font-semibold">
              Our Commitment:
            </p>
            <p className="text-gray-600 text-base leading-relaxed">
              We continuously review and update our static explanations based 
              on your feedback. Your input helps us improve the learning 
              experience for all students. Use the thumbs up/down buttons to 
              share whether an explanation was helpful or needs improvement.
            </p>
          </div>

          {/* Continue button */}
          <Button
            onClick={onClose}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-base font-medium"
            data-testid="button-continue-static-modal"
          >
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}