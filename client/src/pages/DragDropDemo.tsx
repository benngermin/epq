import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GripVertical, Shuffle } from "lucide-react";

interface DemoItem {
  id: number;
  title: string;
  content: string;
}

export default function DragDropDemo() {
  const [items, setItems] = useState<DemoItem[]>([
    { id: 1, title: "Question 1", content: "What is the primary goal of risk management?" },
    { id: 2, title: "Question 2", content: "Describe different types of insurance coverage." },
    { id: 3, title: "Question 3", content: "How do deductibles affect insurance premiums?" },
    { id: 4, title: "Question 4", content: "What factors influence claim settlement time?" },
    { id: 5, title: "Question 5", content: "Explain the concept of underwriting in insurance." },
  ]);

  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const [dragOverItem, setDragOverItem] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<"before" | "after" | null>(null);

  const handleDragStart = (e: React.DragEvent, itemId: number) => {
    setDraggedItem(itemId);
    e.dataTransfer.effectAllowed = "move";
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = "0.5";
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = "1";
    setDraggedItem(null);
    setDragOverItem(null);
    setDropPosition(null);
  };

  const handleDragOver = (e: React.DragEvent, itemId: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    
    if (draggedItem === null || draggedItem === itemId) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;
    const position = y < height / 2 ? "before" : "after";
    
    if (dragOverItem !== itemId || dropPosition !== position) {
      setDragOverItem(itemId);
      setDropPosition(position);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverItem(null);
      setDropPosition(null);
    }
  };

  const handleDrop = (e: React.DragEvent, dropItemId: number) => {
    e.preventDefault();
    if (draggedItem === null || draggedItem === dropItemId) {
      setDragOverItem(null);
      setDropPosition(null);
      return;
    }

    const dragIndex = items.findIndex(item => item.id === draggedItem);
    const dropIndex = items.findIndex(item => item.id === dropItemId);
    
    const newOrder = [...items];
    const [removed] = newOrder.splice(dragIndex, 1);
    
    let adjustedDropIndex = dropIndex;
    if (dropPosition === "after") {
      adjustedDropIndex = dragIndex < dropIndex ? dropIndex : dropIndex + 1;
    } else {
      adjustedDropIndex = dragIndex < dropIndex ? dropIndex - 1 : dropIndex;
    }
    
    newOrder.splice(adjustedDropIndex, 0, removed);
    setItems(newOrder);
    
    setDraggedItem(null);
    setDragOverItem(null);
    setDropPosition(null);
  };

  const shuffleItems = () => {
    const shuffled = [...items].sort(() => Math.random() - 0.5);
    setItems(shuffled);
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Enhanced Drag & Drop Demo</h1>
          <p className="text-muted-foreground mt-1">
            Drag questions to reorder them. Visual indicators show where items will be dropped.
          </p>
        </div>
        <Button onClick={shuffleItems} variant="outline">
          <Shuffle className="h-4 w-4 mr-2" />
          Shuffle Order
        </Button>
      </div>

      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.id} className="relative">
            {/* Drop zone indicator - appears above the card */}
            {dragOverItem === item.id && dropPosition === "before" && (
              <div className="absolute -top-1 left-0 right-0 h-1 bg-blue-500 rounded-full z-10 animate-pulse" />
            )}
            
            <Card
              className={`
                ${draggedItem === item.id ? "opacity-50 scale-[0.98]" : ""}
                ${dragOverItem === item.id ? "shadow-lg ring-2 ring-blue-200" : ""}
                transition-all duration-200 ease-in-out cursor-move hover:shadow-md
              `}
              draggable
              onDragStart={(e) => handleDragStart(e, item.id)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, item.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, item.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 px-1 py-1 rounded hover:bg-gray-100 transition-colors">
                    <GripVertical className="h-4 w-4 text-gray-400" />
                    <GripVertical className="h-4 w-4 text-gray-400 -ml-2" />
                  </div>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{item.content}</p>
              </CardContent>
            </Card>
            
            {/* Drop zone indicator - appears below the card */}
            {dragOverItem === item.id && dropPosition === "after" && (
              <div className="absolute -bottom-1 left-0 right-0 h-1 bg-blue-500 rounded-full z-10 animate-pulse" />
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 bg-muted rounded-lg">
        <h3 className="font-semibold mb-2">Features of this Enhanced Drag & Drop:</h3>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>✓ Visual grip handles that highlight on hover</li>
          <li>✓ Dragged items become semi-transparent</li>
          <li>✓ Drop zones show blue animated lines indicating where the item will land</li>
          <li>✓ Cards show shadow and border when hovering over them</li>
          <li>✓ Smooth transitions for all visual changes</li>
          <li>✓ Clear visual feedback throughout the drag operation</li>
        </ul>
      </div>
    </div>
  );
}// Adding comment to trigger reload
