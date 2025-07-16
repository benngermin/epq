import { useState, useEffect } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrueFalseQuestionProps {
  question: any;
  onSubmitAnswer: (answer: string) => void;
  isSubmitting: boolean;
  hasAnswer: boolean;
  isCorrect?: boolean;
}

export function TrueFalseQuestion({ 
  question, 
  onSubmitAnswer, 
  isSubmitting,
  hasAnswer,
  isCorrect
}: TrueFalseQuestionProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");

  // Reset selection when question changes
  useEffect(() => {
    setSelectedAnswer("");
  }, [question?.id]);

  const handleSubmit = () => {
    if (!selectedAnswer || hasAnswer) return;
    onSubmitAnswer(selectedAnswer);
  };

  const choices = ["True", "False"];

  return (
    <div className="space-y-4">
      <div className="mb-2">
        <Badge variant="secondary" className="w-fit bg-accent text-accent-foreground border text-sm">
          Question {(question.questionIndex || 0) + 1} - True/False
        </Badge>
      </div>

      <div className="mb-4">
        <p className="text-base text-foreground leading-relaxed">
          {question.latestVersion?.questionText}
        </p>
      </div>

      <RadioGroup
        value={hasAnswer ? question.userAnswer?.chosenAnswer : selectedAnswer}
        onValueChange={setSelectedAnswer}
        disabled={hasAnswer || isSubmitting}
      >
        <div className="space-y-3">
          {choices.map((choice) => {
            const isSelected = hasAnswer 
              ? question.userAnswer?.chosenAnswer === choice
              : selectedAnswer === choice;
            const isCorrectChoice = choice === question.latestVersion?.correctAnswer;

            return (
              <div key={choice}>
                <Label
                  htmlFor={choice}
                  className={cn(
                    "flex items-center p-4 rounded-lg border cursor-pointer transition-all duration-200",
                    "hover:border-primary hover:bg-accent",
                    isSelected && "border-primary bg-primary/10",
                    hasAnswer && "cursor-default",
                    hasAnswer && isSelected && isCorrectChoice && "bg-green-50 dark:bg-green-900/20 border-green-500",
                    hasAnswer && isSelected && !isCorrectChoice && "bg-red-50 dark:bg-red-900/20 border-red-500",
                    hasAnswer && !isSelected && isCorrectChoice && "bg-green-50/50 dark:bg-green-900/10 border-green-300"
                  )}
                >
                  <RadioGroupItem
                    value={choice}
                    id={choice}
                    className="mr-3"
                  />
                  <span className="text-base font-medium">{choice}</span>
                  {hasAnswer && isCorrectChoice && (
                    <CheckCircle className="h-4 w-4 text-success ml-auto" />
                  )}
                  {hasAnswer && isSelected && !isCorrectChoice && (
                    <XCircle className="h-4 w-4 text-error ml-auto" />
                  )}
                </Label>
              </div>
            );
          })}
        </div>
      </RadioGroup>

      {hasAnswer && (
        <div className="mt-4">
          <div className={`p-3 rounded-lg border ${
            isCorrect 
              ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" 
              : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
          }`}>
            <div className="flex items-center">
              {isCorrect ? (
                <>
                  <CheckCircle className="h-4 w-4 text-success mr-2" />
                  <span className="font-medium text-success text-sm">Correct!</span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-error mr-2" />
                  <span className="font-medium text-error text-sm">Incorrect</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {!hasAnswer && (
        <div className="mt-4">
          <Button
            onClick={handleSubmit}
            disabled={!selectedAnswer || isSubmitting}
            className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isSubmitting ? "Submitting..." : "Submit Answer"}
          </Button>
        </div>
      )}
    </div>
  );
}