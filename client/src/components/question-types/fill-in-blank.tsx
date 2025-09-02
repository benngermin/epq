import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState, useMemo } from "react";

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

  // Create a combined pattern that matches underscore blanks (___), blank_N patterns, square brackets [], and asterisk-wrapped words
  // Memoize to prevent recreation on every render
  const blankPattern = useMemo(() => /(?:_{3,}|blank_\d+|\[\s*\]|\*[^*]+\*)/g, []);
  
  // Count the number of blanks - memoized to prevent recalculation
  const blankCount = useMemo(() => {
    return (questionText.match(blankPattern) || []).length;
  }, [questionText, blankPattern]);

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
  }, [value, questionText, blankCount]); // Also depend on questionText and blankCount to reset when question changes

  // Track if this is initial mount or question change
  const [isUserInput, setIsUserInput] = useState(false);

  // Update parent component only when user actually changes values
  useEffect(() => {
    // Only call onChange if this is from user input, not from prop updates
    if (isUserInput) {
      if (blankCount <= 1) {
        // Single blank or no blank: send just the string value
        onChange(blankValues[0] || '');
      } else {
        // Multiple blanks: send JSON stringified object
        onChange(JSON.stringify(blankValues));
      }
      setIsUserInput(false); // Reset flag after calling onChange
    }
  }, [blankValues, blankCount, isUserInput]); // Removed onChange from deps to prevent circular updates

  const handleBlankChange = (index: number, newValue: string) => {
    setIsUserInput(true); // Mark this as user input
    setBlankValues(prev => ({
      ...prev,
      [index]: newValue
    }));
  };

  // Replace _____ or blank_N patterns with the input field
  const renderQuestionWithInput = () => {
    // Split by both underscore patterns and blank_N patterns
    const parts = questionText.split(blankPattern);
    
    // Find all blank matches to preserve their order
    const blanks = questionText.match(blankPattern) || [];
    
    if (blanks.length === 0) {
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
      
    </div>
  );
}