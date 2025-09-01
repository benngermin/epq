import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GripVertical, RotateCcw } from "lucide-react";

interface OrderingProps {
  answerChoices: string[];
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  correctAnswer?: string;
  correctOrder?: number[];
}

export function Ordering({
  answerChoices,
  value,
  onChange,
  disabled,
  correctAnswer,
  correctOrder,
}: OrderingProps) {
  const [items, setItems] = useState<string[]>(value.length > 0 ? value : [...answerChoices].sort(() => Math.random() - 0.5));
  const [draggedItem, setDraggedItem] = useState<number | null>(null);

  useEffect(() => {
    onChange(items);
  }, [items, onChange]);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedItem === null || draggedItem === dropIndex) return;

    const draggedContent = items[draggedItem];
    const newItems = [...items];
    
    // Remove dragged item
    newItems.splice(draggedItem, 1);
    
    // Insert at new position
    newItems.splice(dropIndex, 0, draggedContent);
    
    setItems(newItems);
    setDraggedItem(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const resetOrder = () => {
    setItems([...answerChoices].sort(() => Math.random() - 0.5));
  };

  const getCorrectOrder = () => {
    if (correctAnswer) {
      try {
        return JSON.parse(correctAnswer) as string[];
      } catch {
        return null;
      }
    }
    return null;
  };

  const isInCorrectPosition = (item: string, index: number) => {
    if (!disabled) return false;
    const correct = getCorrectOrder();
    if (correct) {
      return correct[index] === item;
    }
    return false;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-muted-foreground">
          Drag items to arrange them in the correct order
        </span>
        {!disabled && (
          <Button
            variant="outline"
            size="sm"
            onClick={resetOrder}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-3 w-3" />
            Shuffle
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {items.map((item, index) => {
          const isCorrect = isInCorrectPosition(item, index);
          
          return (
            <Card
              key={item}
              draggable={!disabled}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={cn(
                "p-3 transition-all duration-200",
                !disabled && "cursor-move hover:border-primary",
                draggedItem === index && "opacity-50",
                disabled && isCorrect && "border-green-500 bg-green-50",
                disabled && !isCorrect && "border-red-500 bg-red-50"
              )}
            >
              <div className="flex items-center gap-3">
                {!disabled && (
                  <GripVertical className="h-5 w-5 text-muted-foreground" />
                )}
                <div className="flex items-center gap-3 flex-1">
                  <span className="font-medium text-muted-foreground">
                    {index + 1}.
                  </span>
                  <span className="text-sm">{item}</span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

    </div>
  );
}