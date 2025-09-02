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
  isCorrect?: boolean;
}

export function SelectFromListBlank({
  questionText,
  blanks = [],
  value,
  onChange,
  disabled,
  correctAnswer,
  isCorrect,
}: SelectFromListBlankProps) {
  // Parse current values or initialize
  let currentValues: Record<number, string> = {};
  if (value) {
    if (typeof value === 'string') {
      try {
        currentValues = JSON.parse(value);
      } catch (e) {
        // If parsing fails, it might be a single value or invalid JSON
        currentValues = {};
      }
    } else if (typeof value === 'object') {
      currentValues = value;
    }
  }

  const handleBlankChange = (blankId: number, newValue: string) => {
    const updatedValues = { ...currentValues, [blankId]: newValue };
    onChange(JSON.stringify(updatedValues));
  };

  // Replace blanks in text with dropdowns
  const renderQuestionWithDropdowns = () => {
    let processedText = questionText;
    const elements: JSX.Element[] = [];
    let lastIndex = 0;

    // Combined regex to find both underscore patterns (___) and blank_n patterns
    const blankRegex = /(?:_{3,}|blank_(\d+))/gi;
    let match;

    // Create array to store matches with their blank IDs
    const matches: Array<{ index: number; length: number; blankId: number }> = [];
    
    while ((match = blankRegex.exec(questionText)) !== null) {
      let blankId: number;
      
      // Check if this is a blank_n pattern
      if (match[1]) {
        // Extract the number from blank_n
        blankId = parseInt(match[1]);
      } else {
        // For underscore patterns, use sequential numbering starting from 1
        blankId = matches.length + 1;
      }
      
      matches.push({
        index: match.index,
        length: match[0].length,
        blankId: blankId
      });
    }

    // Process matches to build elements
    matches.forEach((matchInfo, index) => {
      // Add text before the blank
      if (matchInfo.index > lastIndex) {
        elements.push(
          <span key={`text-${lastIndex}`}>
            {questionText.substring(lastIndex, matchInfo.index)}
          </span>
        );
      }

      // Find the corresponding blank data by blank_id
      let blank = blanks.find(b => b.blank_id === matchInfo.blankId);
      
      // If no exact match found but blanks array exists, try to use the blank at the corresponding index
      if (!blank && blanks.length > 0) {
        // Use modulo to cycle through available blanks if there are more blank patterns than blank data
        const blankIndex = (matchInfo.blankId - 1) % blanks.length;
        blank = blanks[blankIndex];
        // Override the blank_id to match the pattern in the text
        if (blank) {
          blank = { ...blank, blank_id: matchInfo.blankId };
        }
      }
      
      if (blank) {
        elements.push(
          <Select
            key={`blank-${matchInfo.blankId}`}
            value={currentValues[matchInfo.blankId] || ""}
            onValueChange={(val) => handleBlankChange(matchInfo.blankId, val)}
            disabled={disabled}
          >
            <SelectTrigger className="inline-flex w-48 mx-2">
              <SelectValue placeholder="Select an option" />
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
      } else {
        // If still no blank data, show the original text pattern
        elements.push(
          <span key={`blank-text-${matchInfo.blankId}`} className="mx-2 font-medium">
            {questionText.substring(matchInfo.index, matchInfo.index + matchInfo.length)}
          </span>
        );
      }

      lastIndex = matchInfo.index + matchInfo.length;
    });

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

    </div>
  );
}