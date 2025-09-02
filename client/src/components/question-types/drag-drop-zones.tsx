import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { GripVertical } from "lucide-react";

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
  const [dragOverZone, setDragOverZone] = useState<number | null>(null);
  const [zoneContents, setZoneContents] = useState<Record<number, string[]>>(() => {
    if (typeof value === 'string' && value) {
      try {
        const parsed = JSON.parse(value);
        // Ensure all values are arrays
        const sanitized: Record<number, string[]> = {};
        for (const key in parsed) {
          // Handle both "zone_1" format (from DB) and numeric "1" format
          let zoneId: number;
          if (key.startsWith('zone_')) {
            zoneId = parseInt(key.replace('zone_', ''));
          } else {
            zoneId = parseInt(key);
          }
          if (!isNaN(zoneId)) {
            sanitized[zoneId] = Array.isArray(parsed[key]) ? parsed[key] : [];
          }
        }
        return sanitized;
      } catch {
        return {};
      }
    } else if (typeof value === 'object' && value) {
      // If value is already an object, ensure all values are arrays
      const sanitized: Record<number, string[]> = {};
      for (const key in value) {
        // Handle both "zone_1" format (from DB) and numeric "1" format
        let zoneId: number;
        if (key.startsWith('zone_')) {
          zoneId = parseInt(key.replace('zone_', ''));
        } else {
          zoneId = parseInt(key);
        }
        if (!isNaN(zoneId)) {
          sanitized[zoneId] = Array.isArray(value[key]) ? value[key] : [];
        }
      }
      return sanitized;
    }
    return {};
  });

  const [availableItems, setAvailableItems] = useState<string[]>(() => {
    const used = new Set(Object.values(zoneContents).flat());
    return answerChoices.filter(item => !used.has(item));
  });

  useEffect(() => {
    // Ensure all zone contents are arrays before stringifying
    // Convert numeric zone IDs to string format "zone_1", "zone_2" for database compatibility
    const sanitizedContents: Record<string, string[]> = {};
    for (const key in zoneContents) {
      const zoneId = parseInt(key);
      if (!isNaN(zoneId) && Array.isArray(zoneContents[zoneId])) {
        // Use string key format "zone_1", "zone_2" etc. for database compatibility
        sanitizedContents[`zone_${zoneId}`] = zoneContents[zoneId];
      }
    }
    onChange(JSON.stringify(sanitizedContents));
  }, [zoneContents, onChange]);

  const handleDragStart = (item: string) => {
    if (!disabled) {
      setDraggingItem(item);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragEnterZone = (zoneId: number, e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && draggingItem) {
      setDragOverZone(zoneId);
    }
  };

  const handleDragLeaveZone = (e: React.DragEvent) => {
    e.preventDefault();
    // Only clear if we're leaving the zone entirely (not just hovering over a child)
    if (e.currentTarget === e.target) {
      setDragOverZone(null);
    }
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
    setDragOverZone(null);
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
    setDragOverZone(null);
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
                "flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-md cursor-move",
                "border border-border",
                "hover:bg-primary/20 hover:shadow-md hover:-translate-y-0.5",
                "transition-all duration-200 ease-in-out",
                disabled && "cursor-not-allowed opacity-50"
              )}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Drop zones */}
      <div className="grid gap-4 md:grid-cols-2">
        {dropZones.map((zone) => (
          <div
            key={zone.zone_id}
            className={cn(
              "p-4 rounded-lg border-2 border-dashed border-muted-foreground/30",
              "transition-all duration-200",
              draggingItem && "border-primary/50 bg-primary/5",
              dragOverZone === zone.zone_id && "border-primary bg-primary/10 scale-[1.02] shadow-lg"
            )}
            onDragOver={handleDragOver}
            onDragEnter={(e) => handleDragEnterZone(zone.zone_id, e)}
            onDragLeave={handleDragLeaveZone}
            onDrop={(e) => handleDropToZone(zone.zone_id, e)}
          >
            <h4 className="font-medium text-center mb-3 text-muted-foreground uppercase text-sm tracking-wider">{zone.zone_label}</h4>
            <div className="flex flex-wrap gap-2 min-h-[34px]">
              {Array.isArray(zoneContents[zone.zone_id]) ? zoneContents[zone.zone_id].map((item) => (
                <div
                  key={item}
                  draggable={!disabled}
                  onDragStart={() => handleDragStart(item)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 bg-background rounded-md cursor-move",
                    "border border-border",
                    "hover:bg-accent hover:shadow-md hover:-translate-y-0.5",
                    "transition-all duration-200 ease-in-out",
                    disabled && "cursor-not-allowed opacity-50"
                  )}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span>{item}</span>
                </div>
              )) : []}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}