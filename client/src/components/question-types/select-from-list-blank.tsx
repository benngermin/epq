import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface SelectFromListBlankProps {
  questionText: string;
  blanks?: Array<{
    blank_id: number;
    answer_choices: string[];
    correct_answer: string;
  }>;
  value: any;
  onChange: (value: any) => void;
  disabled?: boolean;
  correctAnswer?: any;
}

export function SelectFromListBlank({
  questionText,
  blanks = [],
  value,
  onChange,
  disabled,
  correctAnswer,
}: SelectFromListBlankProps) {
  // Parse current values or initialize
  const currentValues = typeof value === 'string' && value ? JSON.parse(value) : {};

  const handleBlankChange = (blankId: number, newValue: string) => {
    const updatedValues = { ...currentValues, [blankId]: newValue };
    onChange(JSON.stringify(updatedValues));
  };

  // Replace blanks in text with dropdowns
  const renderQuestionWithDropdowns = () => {
    let processedText = questionText;
    const elements: JSX.Element[] = [];
    let lastIndex = 0;

    // Find all blank positions
    const blankRegex = /_{3,}/g;
    let match;
    let blankIndex = 0;

    while ((match = blankRegex.exec(questionText)) !== null) {
      // Add text before the blank
      if (match.index > lastIndex) {
        elements.push(
          <span key={`text-${lastIndex}`}>
            {questionText.substring(lastIndex, match.index)}
          </span>
        );
      }

      // Add dropdown for this blank
      const blank = blanks[blankIndex];
      if (blank) {
        elements.push(
          <Select
            key={`blank-${blank.blank_id}`}
            value={currentValues[blank.blank_id] || ""}
            onValueChange={(val) => handleBlankChange(blank.blank_id, val)}
            disabled={disabled}
          >
            <SelectTrigger className="inline-flex w-48 mx-2">
              <SelectValue placeholder="Select an answer" />
            </SelectTrigger>
            <SelectContent>
              {blank.answer_choices.map((choice, idx) => (
                <SelectItem key={idx} value={choice}>
                  {choice}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }

      lastIndex = match.index + match[0].length;
      blankIndex++;
    }

    // Add any remaining text
    if (lastIndex < questionText.length) {
      elements.push(
        <span key={`text-${lastIndex}`}>
          {questionText.substring(lastIndex)}
        </span>
      );
    }

    return <div className="text-base leading-relaxed">{elements}</div>;
  };

  return (
    <div className="space-y-4">
      {renderQuestionWithDropdowns()}

      {disabled && correctAnswer && (
        <div className="mt-4 p-3 bg-muted rounded-lg">
          <p className="text-sm font-medium">Correct answers:</p>
          {blanks.map((blank) => (
            <p key={blank.blank_id} className="text-sm text-muted-foreground">
              Blank {blank.blank_id}: {blank.correct_answer}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}