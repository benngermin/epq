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
      console.log('[BeforeYouStartModal] Agreement saved to localStorage');
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
      <DialogContent className="max-w-2xl">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-2xl font-bold text-gray-900">
            Before You Start:
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Important section - plain text */}
          <div className="space-y-3">
            <p className="text-gray-800 font-medium">
              Important:
            </p>
            <p className="text-gray-800 font-normal">
              Practice questions familiarize you with the exam format, but don't cover every possible topic that could be on the exam.
            </p>
            <p className="text-gray-800 font-normal">
              AI assistant explanations may occasionally be incorrect or incomplete.
            </p>
            <p className="text-gray-600 text-base">
              Always use your official study materials to verify information and complete
              your exam preparation.
            </p>
          </div>

          {/* Checkbox */}
          <div className="flex items-center space-x-3 p-4 border rounded-lg border-gray-200">
            <Checkbox
              id="understand"
              checked={isChecked}
              onCheckedChange={(checked) => setIsChecked(checked as boolean)}
              className="w-5 h-5"
            />
            <label
              htmlFor="understand"
              className="text-gray-700 cursor-pointer select-none"
            >
              I understand this is a practice tool with AI assistance that may have
              limitations, and I will verify information with official study materials.
            </label>
          </div>

          {/* Begin Practice button */}
          <Button
            onClick={handleBeginPractice}
            disabled={!isChecked}
            className={`w-full py-6 text-lg font-medium transition-all ${
              isChecked 
                ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }`}
            variant="secondary"
          >
            Begin Practice
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}