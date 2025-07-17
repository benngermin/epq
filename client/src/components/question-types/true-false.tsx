import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface TrueFalseProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  isCorrect?: boolean;
  correctAnswer?: string;
}

export function TrueFalse({
  value,
  onChange,
  disabled,
  isCorrect,
  correctAnswer,
}: TrueFalseProps) {
  const options = ["True", "False"];

  return (
    <RadioGroup
      value={value}
      onValueChange={onChange}
      disabled={disabled}
    >
      <div className="space-y-3">
        {options.map((option) => {
          const isSelected = value === option;
          const isCorrectChoice = option === correctAnswer;
          
          return (
            <div key={option}>
              <Label
                htmlFor={option}
                className={cn(
                  "flex items-center p-4 rounded-lg border cursor-pointer transition-all duration-200",
                  "hover:border-primary hover:bg-accent",
                  isSelected && "border-primary bg-primary/10",
                  disabled && "cursor-default",
                  disabled && isCorrectChoice && "border-green-500 bg-green-50",
                  disabled && isSelected && !isCorrectChoice && "border-red-500 bg-red-50"
                )}
              >
                <RadioGroupItem
                  value={option}
                  id={option}
                  className="mr-3"
                />
                <span className="text-base font-medium">{option}</span>
              </Label>
            </div>
          );
        })}
      </div>
    </RadioGroup>
  );
}