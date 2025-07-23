import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FillInBlankProps {
  questionText: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  isCorrect?: boolean;
  correctAnswer?: string;
  acceptableAnswers?: string[];
}

export function FillInBlank({
  questionText,
  value,
  onChange,
  disabled,
  isCorrect,
  correctAnswer,
  acceptableAnswers,
}: FillInBlankProps) {
  // Replace _____ or similar patterns with the input field
  const renderQuestionWithInput = () => {
    const parts = questionText.split(/_{3,}/);
    
    if (parts.length === 1) {
      // No blank found, append input at the end
      return (
        <div className="space-y-4">
          <p className="text-base text-foreground leading-relaxed">{questionText}</p>
          <div className="flex items-center gap-2">
            <Label htmlFor="answer-input">Your answer:</Label>
            <div className="p-0.5">
              <Input
                id="answer-input"
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                className="w-48"
                placeholder="Type your answer"
              />
            </div>
          </div>
        </div>
      );
    }
    
    // Render with inline input
    return (
      <div className="text-base text-foreground leading-relaxed">
        {parts.map((part, index) => (
          <span key={index}>
            {part}
            {index < parts.length - 1 && (
              <Input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                className="inline-block w-48 mx-2"
                placeholder="Type your answer"
              />
            )}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {renderQuestionWithInput()}
      
      {disabled && correctAnswer && (
        <div className="mt-4 p-3 bg-muted rounded-lg">
          <p className="text-sm font-medium">Correct answer: {correctAnswer}</p>
          {acceptableAnswers && acceptableAnswers.length > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              Also accepted: {acceptableAnswers.join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}