import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";

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
  // Parse the value as JSON if it contains multiple blanks, otherwise use it as a single string
  const [blankValues, setBlankValues] = useState<Record<number, string>>(() => {
    try {
      if (value && value.startsWith('{')) {
        return JSON.parse(value);
      }
      return { 0: value || '' };
    } catch {
      return { 0: value || '' };
    }
  });

  // Count the number of blanks
  const blankCount = (questionText.match(/_{3,}/g) || []).length;

  // Update local state when value prop changes (e.g., when navigating between questions)
  useEffect(() => {
    try {
      if (value && value.startsWith('{')) {
        setBlankValues(JSON.parse(value));
      } else if (blankCount <= 1) {
        setBlankValues({ 0: value || '' });
      }
    } catch {
      setBlankValues({ 0: value || '' });
    }
  }, [value, questionText]); // Also depend on questionText to reset when question changes

  // Update parent component when values change
  useEffect(() => {
    if (blankCount <= 1) {
      // Single blank or no blank: send just the string value
      onChange(blankValues[0] || '');
    } else {
      // Multiple blanks: send JSON stringified object
      onChange(JSON.stringify(blankValues));
    }
  }, [blankValues, blankCount, onChange]);

  const handleBlankChange = (index: number, newValue: string) => {
    setBlankValues(prev => ({
      ...prev,
      [index]: newValue
    }));
  };

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
                value={blankValues[0] || ''}
                onChange={(e) => handleBlankChange(0, e.target.value)}
                disabled={disabled}
                className="w-48"
                placeholder="Type your answer"
              />
            </div>
          </div>
        </div>
      );
    }
    
    // Render with inline input(s)
    return (
      <div className="text-base text-foreground leading-relaxed">
        {parts.map((part, index) => (
          <span key={index}>
            {part}
            {index < parts.length - 1 && (
              <Input
                type="text"
                value={blankValues[index] || ''}
                onChange={(e) => handleBlankChange(index, e.target.value)}
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
      
      {disabled && !isCorrect && correctAnswer && (
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