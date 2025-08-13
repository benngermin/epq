import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface PickFromListProps {
  answerChoices: string[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  allowMultiple?: boolean;
  disabled?: boolean;
  correctAnswer?: string;
}

export function PickFromList({
  answerChoices,
  value,
  onChange,
  allowMultiple = false,
  disabled,
  correctAnswer,
}: PickFromListProps) {
  if (allowMultiple) {
    // Multiple selection with checkboxes
    const selectedValues = Array.isArray(value) ? value : value ? [value] : [];
    
    return (
      <div className="space-y-5 sm:space-y-6 md:space-y-7 flex-1 flex flex-col justify-center">
        {answerChoices.map((choice, index) => {
          const isSelected = selectedValues.includes(choice);
          const isCorrectChoice = correctAnswer && correctAnswer.includes(choice);
          
          return (
            <div key={index}>
              <Label
                htmlFor={`choice-${index}`}
                className={cn(
                  "flex items-center p-5 sm:p-6 md:p-7 lg:p-8 rounded-lg border cursor-pointer transition-all duration-200",
                  "hover:border-primary hover:bg-accent",
                  isSelected && "border-primary bg-primary/10",
                  disabled && "cursor-default",
                  disabled && isCorrectChoice && "border-green-500 bg-green-50"
                )}
              >
                <Checkbox
                  id={`choice-${index}`}
                  checked={isSelected}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onChange([...selectedValues, choice]);
                    } else {
                      onChange(selectedValues.filter(v => v !== choice));
                    }
                  }}
                  disabled={disabled}
                  className="mr-4"
                />
                <span className="text-base leading-relaxed">{choice}</span>
              </Label>
            </div>
          );
        })}
      </div>
    );
  }

  // Single selection with dropdown
  return (
    <div className="p-0.5">
      <Select
        value={value as string}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select an option" />
        </SelectTrigger>
        <SelectContent>
          {answerChoices.map((choice, index) => (
            <SelectItem key={index} value={choice}>
              {choice}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}