import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface PickFromListQuestionProps {
  question: any;
  onSubmitAnswer: (answer: string) => void;
  isSubmitting: boolean;
  hasAnswer: boolean;
  isCorrect?: boolean;
}

export function PickFromListQuestion({ 
  question, 
  onSubmitAnswer, 
  isSubmitting,
  hasAnswer,
  isCorrect
}: PickFromListQuestionProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [selectedMultiple, setSelectedMultiple] = useState<string[]>([]);

  const allowMultiple = question.latestVersion?.allowMultiple || false;

  // Reset selection when question changes
  useEffect(() => {
    setSelectedAnswer("");
    setSelectedMultiple([]);
  }, [question?.id]);

  const handleSubmit = () => {
    if (allowMultiple) {
      if (selectedMultiple.length === 0 || hasAnswer) return;
      // For multiple selection, join answers with comma
      onSubmitAnswer(selectedMultiple.join(","));
    } else {
      if (!selectedAnswer || hasAnswer) return;
      onSubmitAnswer(selectedAnswer);
    }
  };

  const handleMultipleChange = (choice: string, checked: boolean) => {
    if (checked) {
      setSelectedMultiple([...selectedMultiple, choice]);
    } else {
      setSelectedMultiple(selectedMultiple.filter(c => c !== choice));
    }
  };

  const choices = question.latestVersion?.answerChoices || [];

  return (
    <div className="space-y-4">
      <div className="mb-2">
        <Badge variant="secondary" className="w-fit bg-accent text-accent-foreground border text-sm">
          Question {(question.questionIndex || 0) + 1} - Pick from List
          {allowMultiple && " (Multiple Selection)"}
        </Badge>
      </div>

      <div className="mb-4">
        <p className="text-base text-foreground leading-relaxed">
          {question.latestVersion?.questionText}
        </p>
      </div>

      {!allowMultiple ? (
        <Select
          value={hasAnswer ? question.userAnswer?.chosenAnswer : selectedAnswer}
          onValueChange={setSelectedAnswer}
          disabled={hasAnswer || isSubmitting}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select an option..." />
          </SelectTrigger>
          <SelectContent>
            {choices.map((choice: string) => (
              <SelectItem key={choice} value={choice}>
                {choice}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <div className="space-y-3">
          {choices.map((choice: string) => {
            const userAnswers = hasAnswer 
              ? (question.userAnswer?.chosenAnswer || "").split(",") 
              : selectedMultiple;
            const isSelected = userAnswers.includes(choice);
            const correctAnswers = (question.latestVersion?.correctAnswer || "").split(",");
            const isCorrectChoice = correctAnswers.includes(choice);

            return (
              <div key={choice}>
                <Label
                  htmlFor={`checkbox-${choice}`}
                  className={cn(
                    "flex items-center p-3 rounded-lg border cursor-pointer transition-all duration-200",
                    "hover:border-primary hover:bg-accent",
                    isSelected && "border-primary bg-primary/10",
                    hasAnswer && "cursor-default",
                    hasAnswer && isSelected && isCorrectChoice && "bg-green-50 dark:bg-green-900/20 border-green-500",
                    hasAnswer && isSelected && !isCorrectChoice && "bg-red-50 dark:bg-red-900/20 border-red-500",
                    hasAnswer && !isSelected && isCorrectChoice && "bg-green-50/50 dark:bg-green-900/10 border-green-300"
                  )}
                >
                  <Checkbox
                    id={`checkbox-${choice}`}
                    checked={isSelected}
                    onCheckedChange={(checked) => handleMultipleChange(choice, checked as boolean)}
                    disabled={hasAnswer || isSubmitting}
                    className="mr-3"
                  />
                  <span className="text-base flex-1">{choice}</span>
                  {hasAnswer && isCorrectChoice && (
                    <CheckCircle className="h-4 w-4 text-success ml-2" />
                  )}
                  {hasAnswer && isSelected && !isCorrectChoice && (
                    <XCircle className="h-4 w-4 text-error ml-2" />
                  )}
                </Label>
              </div>
            );
          })}
        </div>
      )}

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
                  <span className="font-medium text-error text-sm">
                    Incorrect. The correct answer{allowMultiple ? "s are" : " is"}: {question.latestVersion?.correctAnswer}
                  </span>
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
            disabled={allowMultiple ? selectedMultiple.length === 0 : !selectedAnswer}
            className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isSubmitting ? "Submitting..." : "Submit Answer"}
          </Button>
        </div>
      )}
    </div>
  );
}