import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle } from "lucide-react";

interface FillInBlankQuestionProps {
  question: any;
  onSubmitAnswer: (answer: string) => void;
  isSubmitting: boolean;
  hasAnswer: boolean;
  isCorrect?: boolean;
}

export function FillInBlankQuestion({ 
  question, 
  onSubmitAnswer, 
  isSubmitting,
  hasAnswer,
  isCorrect
}: FillInBlankQuestionProps) {
  const [userInput, setUserInput] = useState("");

  // Reset input when question changes
  useEffect(() => {
    setUserInput("");
  }, [question?.id]);

  const handleSubmit = () => {
    if (!userInput.trim() || hasAnswer) return;
    onSubmitAnswer(userInput.trim());
  };

  // Replace _____ with input field in question text
  const renderQuestionText = () => {
    const text = question.latestVersion?.questionText || "";
    const parts = text.split("_____");
    
    if (parts.length === 1) {
      // No blank in question, just show text and input below
      return (
        <>
          <p className="text-base text-foreground leading-relaxed mb-4">{text}</p>
          <div className="mt-4">
            <Label htmlFor="answer-input" className="text-sm font-medium mb-2">Your Answer:</Label>
            <Input
              id="answer-input"
              type="text"
              value={hasAnswer ? question.userAnswer?.chosenAnswer || "" : userInput}
              onChange={(e) => setUserInput(e.target.value)}
              disabled={hasAnswer || isSubmitting}
              className="mt-2"
              placeholder="Type your answer here..."
              onKeyPress={(e) => {
                if (e.key === "Enter" && !hasAnswer && !isSubmitting && userInput.trim()) {
                  handleSubmit();
                }
              }}
            />
          </div>
        </>
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
                value={hasAnswer ? question.userAnswer?.chosenAnswer || "" : userInput}
                onChange={(e) => setUserInput(e.target.value)}
                disabled={hasAnswer || isSubmitting}
                className="inline-block w-40 mx-2 px-2 py-1"
                placeholder="answer"
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !hasAnswer && !isSubmitting && userInput.trim()) {
                    handleSubmit();
                  }
                }}
              />
            )}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="mb-2">
        <Badge variant="secondary" className="w-fit bg-accent text-accent-foreground border text-sm">
          Question {(question.questionIndex || 0) + 1} - Fill in the Blank
        </Badge>
      </div>

      {renderQuestionText()}

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
                    Incorrect. The correct answer is: {question.latestVersion?.correctAnswer}
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
            disabled={!userInput.trim() || isSubmitting}
            className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isSubmitting ? "Submitting..." : "Submit Answer"}
          </Button>
        </div>
      )}
    </div>
  );
}