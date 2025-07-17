import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowRight, RotateCcw } from "lucide-react";

interface MatchingPair {
  left: string;
  right: string;
}

interface MatchingProps {
  answerChoices: MatchingPair[];
  value: MatchingPair[];
  onChange: (value: MatchingPair[]) => void;
  disabled?: boolean;
  correctAnswer?: string;
}

export function Matching({
  answerChoices,
  value,
  onChange,
  disabled,
  correctAnswer,
}: MatchingProps) {
  const [leftItems, setLeftItems] = useState<string[]>([]);
  const [rightItems, setRightItems] = useState<string[]>([]);
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchingPair[]>(value || []);

  useEffect(() => {
    // Extract and shuffle left and right items
    const left = answerChoices.map(pair => pair.left);
    const right = answerChoices.map(pair => pair.right).sort(() => Math.random() - 0.5);
    setLeftItems(left);
    setRightItems(right);
  }, [answerChoices]);

  useEffect(() => {
    // Update parent when matches change
    onChange(matches);
  }, [matches, onChange]);

  const handleLeftClick = (item: string) => {
    if (disabled) return;
    setSelectedLeft(item);
    
    // If right is also selected, create a match
    if (selectedRight) {
      const newMatch: MatchingPair = { left: item, right: selectedRight };
      setMatches([...matches.filter(m => m.left !== item), newMatch]);
      setSelectedLeft(null);
      setSelectedRight(null);
    }
  };

  const handleRightClick = (item: string) => {
    if (disabled) return;
    setSelectedRight(item);
    
    // If left is also selected, create a match
    if (selectedLeft) {
      const newMatch: MatchingPair = { left: selectedLeft, right: item };
      setMatches([...matches.filter(m => m.left !== selectedLeft), newMatch]);
      setSelectedLeft(null);
      setSelectedRight(null);
    }
  };

  const resetMatches = () => {
    setMatches([]);
    setSelectedLeft(null);
    setSelectedRight(null);
  };

  const getMatchForLeft = (leftItem: string) => {
    return matches.find(m => m.left === leftItem)?.right;
  };

  const isCorrectMatch = (leftItem: string, rightItem: string) => {
    if (!correctAnswer || !disabled) return false;
    try {
      const correct = JSON.parse(correctAnswer) as MatchingPair[];
      return correct.some(pair => pair.left === leftItem && pair.right === rightItem);
    } catch {
      return false;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-muted-foreground">
          Match items from the left column with items on the right
        </span>
        {!disabled && (
          <Button
            variant="outline"
            size="sm"
            onClick={resetMatches}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Left column */}
        <div className="space-y-2">
          {leftItems.map((item, index) => {
            const matchedRight = getMatchForLeft(item);
            const isSelected = selectedLeft === item;
            const hasMatch = !!matchedRight;
            
            return (
              <Card
                key={index}
                className={cn(
                  "p-3 cursor-pointer transition-all duration-200",
                  isSelected && "border-primary bg-primary/10",
                  hasMatch && !disabled && "border-blue-500 bg-blue-50",
                  disabled && matchedRight && isCorrectMatch(item, matchedRight) && "border-green-500 bg-green-50",
                  disabled && matchedRight && !isCorrectMatch(item, matchedRight) && "border-red-500 bg-red-50",
                  !disabled && "hover:border-primary"
                )}
                onClick={() => handleLeftClick(item)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm">{item}</span>
                  {hasMatch && (
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {/* Right column */}
        <div className="space-y-2">
          {rightItems.map((item, index) => {
            const isSelected = selectedRight === item;
            const isMatched = matches.some(m => m.right === item);
            
            return (
              <Card
                key={index}
                className={cn(
                  "p-3 cursor-pointer transition-all duration-200",
                  isSelected && "border-primary bg-primary/10",
                  isMatched && !disabled && "border-blue-500 bg-blue-50",
                  !disabled && "hover:border-primary"
                )}
                onClick={() => handleRightClick(item)}
              >
                <span className="text-sm">{item}</span>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Show correct answers when disabled */}
      {disabled && correctAnswer && (
        <div className="mt-4 p-3 bg-muted rounded-lg">
          <p className="text-sm font-medium mb-2">Correct matches:</p>
          {(() => {
            try {
              const correct = JSON.parse(correctAnswer) as MatchingPair[];
              return (
                <div className="space-y-1">
                  {correct.map((pair, index) => (
                    <div key={index} className="text-sm text-muted-foreground">
                      {pair.left} → {pair.right}
                    </div>
                  ))}
                </div>
              );
            } catch {
              return <p className="text-sm text-muted-foreground">Unable to parse correct answer</p>;
            }
          })()}
        </div>
      )}
    </div>
  );
}