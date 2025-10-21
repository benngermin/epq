import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  Modifier,
} from "@dnd-kit/core";
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
  isInZone = false 
}: { 
  id: string; 
  item: string; 
  disabled?: boolean; 
  isInZone?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useDraggable({
    id,
    disabled,
  });

  const style = {
    opacity: isDragging ? 0 : 1,
    touchAction: "none" as const,
    userSelect: "none" as const,
    WebkitUserSelect: "none" as const,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-md cursor-move",
        "border border-border",
        "transition-all duration-200 ease-in-out",
        isInZone 
          ? "bg-background hover:bg-accent hover:shadow-md hover:-translate-y-0.5"
          : "bg-primary/10 hover:bg-primary/20 hover:shadow-md hover:-translate-y-0.5",
        disabled && "cursor-not-allowed opacity-50",
        isDragging && "z-50"
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
  // Add this ref to measure container position
  const containerRef = useRef<HTMLDivElement>(null);

  // Add this modifier to align ghost with cursor
  const alignToContainer: Modifier = ({ transform }) => {
    if (!containerRef.current) return transform;

    const rect = containerRef.current.getBoundingClientRect();

    return {
      ...transform,
      x: transform.x - rect.left,
      y: transform.y - rect.top,
    };
  };

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

  // Configure sensors with activation constraint to prevent accidental drags
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Minimum drag distance to activate
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
    <div ref={containerRef}>
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
        modifiers={[alignToContainer]}
        dropAnimation={null}
      >
        {draggedItem ? (
          <div className="pointer-events-none flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-background shadow-lg">
            <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span>{draggedItem}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
    </div>
  );
}