import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, GripVertical, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrderingQuestionProps {
  question: any;
  onSubmitAnswer: (answer: string) => void;
  isSubmitting: boolean;
  hasAnswer: boolean;
  isCorrect?: boolean;
}

export function OrderingQuestion({ 
  question, 
  onSubmitAnswer, 
  isSubmitting,
  hasAnswer,
  isCorrect
}: OrderingQuestionProps) {
  const [orderedItems, setOrderedItems] = useState<string[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Initialize with shuffled items
  useEffect(() => {
    const items = question.latestVersion?.answerChoices || [];
    if (!hasAnswer) {
      // Shuffle items for initial display
      const shuffled = [...items].sort(() => Math.random() - 0.5);
      setOrderedItems(shuffled);
    } else {
      // Show user's submitted order
      try {
        const userOrder = JSON.parse(question.userAnswer?.chosenAnswer || "[]");
        setOrderedItems(userOrder);
      } catch {
        setOrderedItems(items);
      }
    }
  }, [question?.id, hasAnswer, question.userAnswer]);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || hasAnswer) return;

    const newItems = [...orderedItems];
    const draggedItem = newItems[draggedIndex];
    
    // Remove dragged item
    newItems.splice(draggedIndex, 1);
    
    // Insert at new position
    newItems.splice(dropIndex, 0, draggedItem);
    
    setOrderedItems(newItems);
    setDraggedIndex(null);
  };

  const moveItem = (index: number, direction: "up" | "down") => {
    if (hasAnswer) return;
    
    const newItems = [...orderedItems];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    
    if (newIndex < 0 || newIndex >= newItems.length) return;
    
    // Swap items
    [newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]];
    setOrderedItems(newItems);
  };

  const handleSubmit = () => {
    if (hasAnswer) return;
    onSubmitAnswer(JSON.stringify(orderedItems));
  };

  // Check if current order matches correct order
  const getCorrectOrder = (): string[] => {
    try {
      return JSON.parse(question.latestVersion?.correctAnswer || "[]");
    } catch {
      return [];
    }
  };

  const isItemInCorrectPosition = (item: string, index: number): boolean => {
    if (!hasAnswer) return false;
    const correctOrder = getCorrectOrder();
    return correctOrder[index] === item;
  };

  return (
    <div className="space-y-4">
      <div className="mb-2">
        <Badge variant="secondary" className="w-fit bg-accent text-accent-foreground border text-sm">
          Question {(question.questionIndex || 0) + 1} - Ordering
        </Badge>
      </div>

      <div className="mb-4">
        <p className="text-base text-foreground leading-relaxed">
          {question.latestVersion?.questionText}
        </p>
        {!hasAnswer && (
          <p className="text-sm text-muted-foreground mt-2">
            Drag and drop items or use arrow buttons to arrange them in the correct order.
          </p>
        )}
      </div>

      <div className="space-y-2">
        {orderedItems.map((item, index) => {
          const isCorrectPosition = hasAnswer && isItemInCorrectPosition(item, index);
          const isIncorrectPosition = hasAnswer && !isItemInCorrectPosition(item, index);

          return (
            <div
              key={`${item}-${index}`}
              draggable={!hasAnswer}
              onDragStart={() => handleDragStart(index)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
              className={cn(
                "p-3 rounded-lg border transition-all flex items-center",
                !hasAnswer && "cursor-move hover:bg-accent hover:border-primary",
                hasAnswer && isCorrectPosition && "bg-green-50 dark:bg-green-900/20 border-green-500",
                hasAnswer && isIncorrectPosition && "bg-red-50 dark:bg-red-900/20 border-red-500",
                draggedIndex === index && "opacity-50"
              )}
            >
              <div className="flex items-center flex-1">
                {!hasAnswer && <GripVertical className="h-4 w-4 mr-2 text-muted-foreground" />}
                <span className="font-medium text-sm mr-3 text-muted-foreground">
                  {index + 1}.
                </span>
                <span className="text-base flex-1">{item}</span>
              </div>
              
              {!hasAnswer && (
                <div className="flex gap-1 ml-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => moveItem(index, "up")}
                    disabled={index === 0}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => moveItem(index, "down")}
                    disabled={index === orderedItems.length - 1}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
              )}
              
              {hasAnswer && isCorrectPosition && (
                <CheckCircle className="h-4 w-4 text-success ml-2" />
              )}
              {hasAnswer && isIncorrectPosition && (
                <XCircle className="h-4 w-4 text-error ml-2" />
              )}
            </div>
          );
        })}
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
                  <span className="font-medium text-success text-sm">Correct! Perfect order.</span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-error mr-2" />
                  <span className="font-medium text-error text-sm">
                    Incorrect. The order is not quite right.
                  </span>
                </>
              )}
            </div>
          </div>
          
          {!isCorrect && (
            <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <p className="text-sm font-medium mb-2">Correct order:</p>
              <ol className="list-decimal list-inside space-y-1">
                {getCorrectOrder().map((item, idx) => (
                  <li key={idx} className="text-sm text-muted-foreground">
                    {item}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {!hasAnswer && (
        <div className="mt-4">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isSubmitting ? "Submitting..." : "Submit Answer"}
          </Button>
        </div>
      )}
    </div>
  );
}