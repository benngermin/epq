import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface BeforeYouStartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAgree: () => void;
}

export function BeforeYouStartModal({ isOpen, onClose, onAgree }: BeforeYouStartModalProps) {
  const [isChecked, setIsChecked] = useState(false);

  // Reset checkbox when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsChecked(false);
    }
  }, [isOpen]);

  const handleBeginPractice = () => {
    if (isChecked) {
      // Store the agreement in localStorage so we don't show this again
      localStorage.setItem('epq_agreed_to_terms', 'true');
      onAgree();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      // Only close if the dialog is being closed (not opened)
      if (!open) {
        onClose();
      }
    }}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-xl sm:text-2xl font-bold text-gray-900">
            Before You Start:
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 sm:space-y-6">
          {/* Important section with bullet points */}
          <div className="space-y-2 sm:space-y-3">
            <p className="text-gray-800 font-bold text-sm sm:text-base">
              Important
            </p>
            <ul className="space-y-2 list-disc list-inside">
              <li className="text-gray-800 font-normal text-sm sm:text-base">
                Practice questions familiarize you with the exam format, but don't cover every possible topic that could be on the exam.
              </li>
              <li className="text-gray-800 font-normal text-sm sm:text-base">
                AI assistant explanations may occasionally be incorrect or incomplete.
              </li>
            </ul>
            <p className="text-gray-600 text-xs sm:text-base">
              Always use your official study materials to verify information and complete
              your exam preparation.
            </p>
          </div>

          {/* Checkbox */}
          <div className="flex items-start sm:items-center space-x-2 sm:space-x-3 p-3 sm:p-4 border rounded-lg border-gray-200">
            <Checkbox
              id="understand"
              checked={isChecked}
              onCheckedChange={(checked) => setIsChecked(checked as boolean)}
              className="w-5 h-5 mt-0.5 sm:mt-0"
            />
            <label
              htmlFor="understand"
              className="text-gray-700 cursor-pointer select-none text-sm sm:text-base"
            >
              I understand this is a practice tool with AI assistance that may have limitations.
            </label>
          </div>

          {/* Begin Practice button */}
          <Button
            onClick={handleBeginPractice}
            disabled={!isChecked}
            className="w-full py-4 sm:py-6 text-base sm:text-lg font-medium"
            variant={isChecked ? "default" : "secondary"}
          >
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}