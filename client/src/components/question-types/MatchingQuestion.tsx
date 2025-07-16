import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface MatchingQuestionProps {
  question: any;
  onSubmitAnswer: (answer: string) => void;
  isSubmitting: boolean;
  hasAnswer: boolean;
  isCorrect?: boolean;
}

interface MatchingPair {
  left: string;
  right: string;
}

export function MatchingQuestion({ 
  question, 
  onSubmitAnswer, 
  isSubmitting,
  hasAnswer,
  isCorrect
}: MatchingQuestionProps) {
  const [matches, setMatches] = useState<Map<string, string>>(new Map());
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [draggedFrom, setDraggedFrom] = useState<"left" | "right" | null>(null);

  // Get the matching pairs from answer choices
  const pairs = (question.latestVersion?.answerChoices || []) as MatchingPair[];
  const leftItems = pairs.map(p => p.left);
  const rightItems = pairs.map(p => p.right);

  // Reset matches when question changes
  useEffect(() => {
    setMatches(new Map());
  }, [question?.id]);

  // Parse correct answer if viewing submitted answer
  useEffect(() => {
    if (hasAnswer && question.userAnswer?.chosenAnswer) {
      try {
        const userPairs = JSON.parse(question.userAnswer.chosenAnswer) as MatchingPair[];
        const newMatches = new Map<string, string>();
        userPairs.forEach(pair => {
          newMatches.set(pair.left, pair.right);
        });
        setMatches(newMatches);
      } catch (e) {
        console.error("Failed to parse user answer", e);
      }
    }
  }, [hasAnswer, question.userAnswer]);

  const handleDragStart = (item: string, from: "left" | "right") => {
    setDraggedItem(item);
    setDraggedFrom(from);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetItem: string, targetSide: "left" | "right") => {
    if (!draggedItem || !draggedFrom || hasAnswer) return;

    const newMatches = new Map(matches);

    if (draggedFrom === "left" && targetSide === "right") {
      // Dragging from left to right - create a match
      newMatches.set(draggedItem, targetItem);
    } else if (draggedFrom === "right" && targetSide === "left") {
      // Dragging from right to left - create a match
      newMatches.set(targetItem, draggedItem);
    }

    setMatches(newMatches);
    setDraggedItem(null);
    setDraggedFrom(null);
  };

  const handleRemoveMatch = (leftItem: string) => {
    if (hasAnswer) return;
    const newMatches = new Map(matches);
    newMatches.delete(leftItem);
    setMatches(newMatches);
  };

  const handleSubmit = () => {
    if (matches.size !== leftItems.length || hasAnswer) return;
    
    // Convert matches to array format for submission
    const matchArray: MatchingPair[] = Array.from(matches.entries()).map(([left, right]) => ({
      left,
      right
    }));
    
    onSubmitAnswer(JSON.stringify(matchArray));
  };

  // Check if a specific match is correct (for display purposes)
  const isMatchCorrect = (left: string, right: string): boolean => {
    if (!hasAnswer) return false;
    try {
      const correctPairs = JSON.parse(question.latestVersion?.correctAnswer || "[]") as MatchingPair[];
      return correctPairs.some(pair => pair.left === left && pair.right === right);
    } catch {
      return false;
    }
  };

  return (
    <div className="space-y-4">
      <div className="mb-2">
        <Badge variant="secondary" className="w-fit bg-accent text-accent-foreground border text-sm">
          Question {(question.questionIndex || 0) + 1} - Matching
        </Badge>
      </div>

      <div className="mb-4">
        <p className="text-base text-foreground leading-relaxed">
          {question.latestVersion?.questionText}
        </p>
        {!hasAnswer && (
          <p className="text-sm text-muted-foreground mt-2">
            Drag items from the left column to match with items in the right column.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Left Column */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm mb-2">Items</h4>
          {leftItems.map((item) => {
            const matchedRight = matches.get(item);
            const isMatched = !!matchedRight;
            const isThisCorrect = hasAnswer && matchedRight ? isMatchCorrect(item, matchedRight) : false;

            return (
              <div
                key={item}
                draggable={!hasAnswer && !isMatched}
                onDragStart={() => handleDragStart(item, "left")}
                className={cn(
                  "p-3 rounded-lg border transition-all",
                  !hasAnswer && !isMatched && "cursor-move hover:bg-accent hover:border-primary",
                  isMatched && !hasAnswer && "bg-primary/10 border-primary",
                  hasAnswer && isMatched && isThisCorrect && "bg-green-50 dark:bg-green-900/20 border-green-500",
                  hasAnswer && isMatched && !isThisCorrect && "bg-red-50 dark:bg-red-900/20 border-red-500",
                  hasAnswer && !isMatched && "bg-gray-100 dark:bg-gray-800"
                )}
              >
                <div className="flex items-center">
                  {!hasAnswer && !isMatched && <GripVertical className="h-4 w-4 mr-2 text-muted-foreground" />}
                  <span className="text-sm flex-1">{item}</span>
                  {isMatched && !hasAnswer && (
                    <button
                      onClick={() => handleRemoveMatch(item)}
                      className="ml-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      ✕
                    </button>
                  )}
                  {hasAnswer && isMatched && isThisCorrect && (
                    <CheckCircle className="h-4 w-4 text-success ml-2" />
                  )}
                  {hasAnswer && isMatched && !isThisCorrect && (
                    <XCircle className="h-4 w-4 text-error ml-2" />
                  )}
                </div>
                {isMatched && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    → {matchedRight}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right Column */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm mb-2">Matches</h4>
          {rightItems.map((item) => {
            const isTarget = Array.from(matches.values()).includes(item);

            return (
              <div
                key={item}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(item, "right")}
                className={cn(
                  "p-3 rounded-lg border transition-all min-h-[48px]",
                  !hasAnswer && "hover:bg-accent hover:border-primary",
                  isTarget && !hasAnswer && "bg-primary/10 border-primary"
                )}
              >
                <div className="flex items-center">
                  <span className="text-sm">{item}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

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
                  <span className="font-medium text-success text-sm">Correct! All matches are right.</span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-error mr-2" />
                  <span className="font-medium text-error text-sm">
                    Incorrect. Some matches are wrong.
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
            disabled={matches.size !== leftItems.length || isSubmitting}
            className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isSubmitting ? "Submitting..." : 
             matches.size === leftItems.length ? "Submit Answer" : 
             `Match all ${leftItems.length} items`}
          </Button>
        </div>
      )}
    </div>
  );
}