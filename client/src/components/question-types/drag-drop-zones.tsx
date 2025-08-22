import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface DragDropZonesProps {
  answerChoices: string[];
  dropZones?: Array<{
    zone_id: number;
    zone_label: string;
  }>;
  value: any;
  onChange: (value: any) => void;
  disabled?: boolean;
  correctAnswer?: any;
}

export function DragDropZones({
  answerChoices,
  dropZones = [],
  value,
  onChange,
  disabled,
  correctAnswer,
}: DragDropZonesProps) {
  const [draggingItem, setDraggingItem] = useState<string | null>(null);
  const [zoneContents, setZoneContents] = useState<Record<number, string[]>>(() => {
    if (typeof value === 'string' && value) {
      try {
        return JSON.parse(value);
      } catch {
        return {};
      }
    }
    return {};
  });

  const [availableItems, setAvailableItems] = useState<string[]>(() => {
    const used = new Set(Object.values(zoneContents).flat());
    return answerChoices.filter(item => !used.has(item));
  });

  useEffect(() => {
    onChange(JSON.stringify(zoneContents));
  }, [zoneContents]);

  const handleDragStart = (item: string) => {
    if (!disabled) {
      setDraggingItem(item);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropToZone = (zoneId: number, e: React.DragEvent) => {
    e.preventDefault();
    if (!draggingItem || disabled) return;

    const newZoneContents = { ...zoneContents };

    // Remove item from its current location
    Object.keys(newZoneContents).forEach(key => {
      const zId = parseInt(key);
      newZoneContents[zId] = (newZoneContents[zId] || []).filter(
        item => item !== draggingItem
      );
    });

    // Remove from available items
    const newAvailable = availableItems.filter(item => item !== draggingItem);

    // Add to new zone
    if (!newZoneContents[zoneId]) {
      newZoneContents[zoneId] = [];
    }
    newZoneContents[zoneId].push(draggingItem);

    setZoneContents(newZoneContents);
    setAvailableItems(newAvailable);
    setDraggingItem(null);
  };

  const handleDropToAvailable = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggingItem || disabled) return;

    const newZoneContents = { ...zoneContents };

    // Remove from all zones
    Object.keys(newZoneContents).forEach(key => {
      const zoneId = parseInt(key);
      newZoneContents[zoneId] = (newZoneContents[zoneId] || []).filter(
        item => item !== draggingItem
      );
    });

    // Add back to available
    if (!availableItems.includes(draggingItem)) {
      setAvailableItems([...availableItems, draggingItem]);
    }

    setZoneContents(newZoneContents);
    setDraggingItem(null);
  };

  return (
    <div className="space-y-4">
      {/* Available items */}
      <Card 
        className="p-4"
        onDragOver={handleDragOver}
        onDrop={handleDropToAvailable}
      >
        <h4 className="font-medium mb-2">Available Items</h4>
        <div className="flex flex-wrap gap-2 min-h-[60px]">
          {availableItems.map((item) => (
            <div
              key={item}
              draggable={!disabled}
              onDragStart={() => handleDragStart(item)}
              className={cn(
                "px-3 py-2 bg-primary/10 rounded-md cursor-move",
                "hover:bg-primary/20 transition-colors",
                disabled && "cursor-not-allowed opacity-50"
              )}
            >
              {item}
            </div>
          ))}
        </div>
      </Card>

      {/* Drop zones */}
      <div className="grid gap-4 md:grid-cols-2">
        {dropZones.map((zone) => (
          <Card
            key={zone.zone_id}
            className={cn(
              "p-4",
              draggingItem && "border-dashed border-2 border-primary/50"
            )}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDropToZone(zone.zone_id, e)}
          >
            <h4 className="font-medium mb-2">{zone.zone_label}</h4>
            <div className="flex flex-wrap gap-2 min-h-[80px] bg-muted/50 rounded p-2">
              {(zoneContents[zone.zone_id] || []).map((item) => (
                <div
                  key={item}
                  draggable={!disabled}
                  onDragStart={() => handleDragStart(item)}
                  className={cn(
                    "px-3 py-2 bg-background rounded-md cursor-move",
                    "hover:bg-accent transition-colors",
                    disabled && "cursor-not-allowed opacity-50"
                  )}
                >
                  {item}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {/* Correct answer display */}
      {disabled && correctAnswer && (
        <div className="mt-4 p-3 bg-muted rounded-lg">
          <p className="text-sm font-medium">Correct arrangement:</p>
          {Object.entries(correctAnswer).map(([zone, items]) => (
            <p key={zone} className="text-sm text-muted-foreground mt-1">
              {zone}: {(items as string[]).join(", ")}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}