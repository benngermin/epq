import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";
import {
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";

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

// Individual draggable item component
function DraggableItem({ 
  id, 
  item, 
  disabled, 
  isInZone = false,
  isOverlay = false 
}: { 
  id: string; 
  item: string; 
  disabled?: boolean; 
  isInZone?: boolean;
  isOverlay?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useDraggable({
    id,
    disabled: disabled || isOverlay,
  });

  const style = isOverlay 
    ? {
        margin: 0,
        transform: "none",
        pointerEvents: "none" as const,
      }
    : {
        opacity: isDragging ? 0 : 1,
        touchAction: "none" as const,
        userSelect: "none" as const,
        WebkitUserSelect: "none" as const,
      };

  return (
    <div
      ref={!isOverlay ? setNodeRef : undefined}
      style={style}
      {...(!isOverlay ? listeners : {})}
      {...(!isOverlay ? attributes : {})}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-md",
        !isOverlay && "cursor-move",
        "border border-border",
        !isOverlay && "transition-all duration-200 ease-in-out",
        isInZone 
          ? "bg-background"
          : "bg-primary/10",
        !isOverlay && isInZone && "hover:bg-accent hover:shadow-md hover:-translate-y-0.5",
        !isOverlay && !isInZone && "hover:bg-primary/20 hover:shadow-md hover:-translate-y-0.5",
        disabled && !isOverlay && "cursor-not-allowed opacity-50",
        isDragging && !isOverlay && "z-50",
        isOverlay && "drag-overlay-item shadow-lg"
      )}
    >
      <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <span>{item}</span>
    </div>
  );
}

// Droppable zone component
function DroppableZone({ 
  id, 
  zone, 
  children, 
  isDragging 
}: { 
  id: string; 
  zone: { zone_id: number; zone_label: string }; 
  children: React.ReactNode;
  isDragging: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "p-4 rounded-lg border-2 border-dashed border-muted-foreground/30",
        "transition-all duration-200",
        isDragging && "border-primary/50 bg-primary/5",
        isOver && "border-primary bg-primary/10 scale-[1.02] shadow-lg"
      )}
    >
      <h4 className="font-medium text-center mb-3 text-muted-foreground uppercase text-sm tracking-wider">
        {zone.zone_label}
      </h4>
      <div className="flex flex-wrap gap-2 min-h-[34px]">
        {children}
      </div>
    </div>
  );
}

// Available items area (also droppable)
function AvailableItemsArea({ 
  id, 
  children, 
  isDragging 
}: { 
  id: string; 
  children: React.ReactNode;
  isDragging: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id,
  });

  return (
    <Card 
      ref={setNodeRef}
      className={cn(
        "p-4",
        isOver && isDragging && "bg-primary/5"
      )}
    >
      <h4 className="font-medium mb-2">Available Items</h4>
      <div className="flex flex-wrap gap-2 min-h-[60px]">
        {children}
      </div>
    </Card>
  );
}


export function DragDropZonesTouch({
  answerChoices,
  dropZones = [],
  value,
  onChange,
  disabled,
  correctAnswer,
}: DragDropZonesProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [zoneContents, setZoneContents] = useState<Record<number, string[]>>(() => {
    if (typeof value === 'string' && value) {
      try {
        const parsed = JSON.parse(value);
        const sanitized: Record<number, string[]> = {};
        for (const key in parsed) {
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
      const sanitized: Record<number, string[]> = {};
      for (const key in value) {
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

  // Configure sensors for better cursor tracking
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Minimum drag distance to activate
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  useEffect(() => {
    const sanitizedContents: Record<string, string[]> = {};
    for (const key in zoneContents) {
      const zoneId = parseInt(key);
      if (!isNaN(zoneId) && Array.isArray(zoneContents[zoneId])) {
        sanitizedContents[`zone_${zoneId}`] = zoneContents[zoneId];
      }
    }
    onChange(JSON.stringify(sanitizedContents));
  }, [zoneContents, onChange]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || disabled) return;

    const draggedItem = String(active.id);
    const droppedOnId = String(over.id);

    // Find where the item is currently located
    let sourceLocation: 'available' | number | null = null;
    
    if (availableItems.includes(draggedItem)) {
      sourceLocation = 'available';
    } else {
      for (const [zoneId, items] of Object.entries(zoneContents)) {
        if (items.includes(draggedItem)) {
          sourceLocation = parseInt(zoneId);
          break;
        }
      }
    }

    // Determine target location
    let targetLocation: 'available' | number | null = null;
    
    if (droppedOnId === 'available-items') {
      targetLocation = 'available';
    } else if (droppedOnId.startsWith('zone-')) {
      targetLocation = parseInt(droppedOnId.replace('zone-', ''));
    } else {
      // Item was dropped on another item, find its container
      if (availableItems.includes(droppedOnId)) {
        targetLocation = 'available';
      } else {
        for (const [zoneId, items] of Object.entries(zoneContents)) {
          if (items.includes(droppedOnId)) {
            targetLocation = parseInt(zoneId);
            break;
          }
        }
      }
    }

    // If no valid target or same location, return
    if (targetLocation === null || sourceLocation === targetLocation) return;

    // Update state
    const newZoneContents = { ...zoneContents };
    const newAvailableItems = [...availableItems];

    // Remove from source
    if (sourceLocation === 'available') {
      const index = newAvailableItems.indexOf(draggedItem);
      if (index > -1) newAvailableItems.splice(index, 1);
    } else if (typeof sourceLocation === 'number') {
      newZoneContents[sourceLocation] = (newZoneContents[sourceLocation] || []).filter(
        item => item !== draggedItem
      );
    }

    // Add to target
    if (targetLocation === 'available') {
      if (!newAvailableItems.includes(draggedItem)) {
        newAvailableItems.push(draggedItem);
      }
    } else if (typeof targetLocation === 'number') {
      if (!newZoneContents[targetLocation]) {
        newZoneContents[targetLocation] = [];
      }
      if (!newZoneContents[targetLocation].includes(draggedItem)) {
        newZoneContents[targetLocation].push(draggedItem);
      }
    }

    setZoneContents(newZoneContents);
    setAvailableItems(newAvailableItems);
  };

  // Get the item being dragged for the overlay
  const getDraggedItem = () => {
    if (!activeId) return null;
    
    // Check if it's in available items
    if (availableItems.includes(activeId)) {
      return activeId;
    }
    
    // Check zones
    for (const items of Object.values(zoneContents)) {
      if (items.includes(activeId)) {
        return activeId;
      }
    }
    
    return null;
  };

  const draggedItem = getDraggedItem();

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4">
        {/* Available items */}
        <AvailableItemsArea id="available-items" isDragging={!!activeId}>
          {availableItems.map((item) => (
            <DraggableItem
              key={item}
              id={item}
              item={item}
              disabled={disabled}
              isInZone={false}
            />
          ))}
        </AvailableItemsArea>

        {/* Drop zones */}
        <div className="grid gap-4 md:grid-cols-2">
          {dropZones.map((zone) => (
            <DroppableZone
              key={zone.zone_id}
              id={`zone-${zone.zone_id}`}
              zone={zone}
              isDragging={!!activeId}
            >
              {Array.isArray(zoneContents[zone.zone_id]) && 
                zoneContents[zone.zone_id].map((item) => (
                  <DraggableItem
                    key={item}
                    id={item}
                    item={item}
                    disabled={disabled}
                    isInZone={true}
                  />
                ))
              }
            </DroppableZone>
          ))}
        </div>
      </div>

      {/* Drag overlay for visual feedback */}
      <DragOverlay 
        modifiers={[snapCenterToCursor]}
        dropAnimation={null}
      >
        {draggedItem ? (
          <DraggableItem
            id={draggedItem}
            item={draggedItem}
            disabled={disabled}
            isInZone={false}
            isOverlay={true}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}