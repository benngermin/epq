import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface EitherOrProps {
  answerChoices: string[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  correctAnswer?: string;
}

export function EitherOr({
  answerChoices,
  value,
  onChange,
  disabled,
  correctAnswer,
}: EitherOrProps) {
  return (
    <div className="space-y-4">
      <RadioGroup
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        className="flex flex-col gap-3"
      >
        {answerChoices.map((choice, index) => {
          const isSelected = value === choice;
          const isCorrectChoice = correctAnswer === choice;

          return (
            <Label
              key={index}
              htmlFor={`either-or-${index}`}
              className={cn(
                "flex items-center p-4 rounded-lg border-2 cursor-pointer transition-all",
                "hover:border-primary hover:bg-accent",
                isSelected && "border-primary bg-primary/10",
                disabled && "cursor-default opacity-75",
                disabled && isCorrectChoice && "border-green-500 bg-green-50",
                disabled && isSelected && !isCorrectChoice && "border-red-500 bg-red-50"
              )}
            >
              <RadioGroupItem
                value={choice}
                id={`either-or-${index}`}
                className="mr-3"
              />
              <span className="text-base flex-1">{choice}</span>
            </Label>
          );
        })}
      </RadioGroup>

    </div>
  );
}