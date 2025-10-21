import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { GripVertical } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  MouseSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragStartEvent,
  DragEndEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

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

// Draggable Item Component
function DraggableItem({ 
  id, 
  item, 
  disabled 
}: { 
  id: string; 
  item: string; 
  disabled?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging
  } = useDraggable({
    id,
    disabled
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-md cursor-move",
        "border border-border bg-primary/10",
        "hover:bg-primary/20 hover:shadow-md hover:-translate-y-0.5",
        "transition-all duration-200 ease-in-out",
        disabled && "cursor-not-allowed opacity-50",
        isDragging && "opacity-50 z-50"
      )}
    >
      <button
        type="button"
        className="drag-handle touch-none select-none flex-shrink-0"
        aria-label="Drag"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      <span>{item}</span>
    </div>
  );
}

// Droppable Zone Component
function DroppableZone({ 
  id, 
  zone,
  items, 
  disabled,
  isDragging
}: { 
  id: string; 
  zone: { zone_id: number; zone_label: string };
  items: string[];
  disabled?: boolean;
  isDragging: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id,
    disabled
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
        {items.map((item) => (
          <DraggableItem
            key={`zone-${zone.zone_id}-${item}`}
            id={`zone-${zone.zone_id}-${item}`}
            item={item}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}

// Available Items Area Component
function AvailableItemsArea({ 
  items, 
  disabled,
  isDragging 
}: { 
  items: string[]; 
  disabled?: boolean;
  isDragging: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: "available",
    disabled
  });

  return (
    <Card 
      ref={setNodeRef}
      className={cn(
        "p-4",
        isOver && "bg-accent/50"
      )}
    >
      <h4 className="font-medium mb-2">Available Items</h4>
      <div className="flex flex-wrap gap-2 min-h-[60px]">
        {items.map((item) => (
          <DraggableItem
            key={`available-${item}`}
            id={`available-${item}`}
            item={item}
            disabled={disabled}
          />
        ))}
      </div>
    </Card>
  );
}

export function DragDropZones({
  answerChoices,
  dropZones = [],
  value,
  onChange,
  disabled,
  correctAnswer,
}: DragDropZonesProps) {
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

  const [activeId, setActiveId] = useState<string | null>(null);

  // Configure sensors for cross-platform support
  const supportsPointer = typeof window !== 'undefined' && 'PointerEvent' in window;
  const isTouchEnv = typeof window !== 'undefined' && 
    (navigator.maxTouchPoints > 0 || 'ontouchstart' in window);

  const sensors = useSensors(
    // Primary: Use PointerSensor with appropriate constraints
    useSensor(PointerSensor, {
      activationConstraint: isTouchEnv
        ? { delay: 180, tolerance: 6 }   // mobile-friendly with press delay
        : { distance: 6 },                // desktop-friendly with distance
    }),
    // Fallback: TouchSensor for environments where PointerEvents might not fire properly
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 6 }
    }),
    // Additional fallback: MouseSensor for older browsers
    useSensor(MouseSensor, { 
      activationConstraint: { distance: 6 } 
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

  // Extract item from drag id
  const getItemFromId = (id: string): string => {
    if (id.startsWith('available-')) {
      return id.replace('available-', '');
    }
    const match = id.match(/^zone-\d+-(.+)$/);
    return match ? match[1] : id;
  };

  // Get zone id from drag id
  const getZoneFromId = (id: string): number | null => {
    const match = id.match(/^zone-(\d+)-/);
    return match ? parseInt(match[1]) : null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    if (!disabled) {
      setActiveId(event.active.id as string);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (!event.active || disabled) return;

    const { active, over } = event;
    const draggedItem = getItemFromId(active.id as string);
    
    if (!over) {
      setActiveId(null);
      return;
    }

    const overId = over.id as string;
    const sourceZone = getZoneFromId(active.id as string);
    
    // Handle drop to zone
    if (overId.startsWith('zone-')) {
      const targetZone = parseInt(overId.replace('zone-', ''));
      
      const newZoneContents = { ...zoneContents };
      const newAvailableItems = [...availableItems];

      // Remove from source
      if (sourceZone !== null) {
        newZoneContents[sourceZone] = (newZoneContents[sourceZone] || []).filter(
          item => item !== draggedItem
        );
      } else {
        const idx = newAvailableItems.indexOf(draggedItem);
        if (idx > -1) newAvailableItems.splice(idx, 1);
      }

      // Add to target zone
      if (!newZoneContents[targetZone]) {
        newZoneContents[targetZone] = [];
      }
      if (!newZoneContents[targetZone].includes(draggedItem)) {
        newZoneContents[targetZone].push(draggedItem);
      }

      setZoneContents(newZoneContents);
      setAvailableItems(newAvailableItems);
    } 
    // Handle drop to available area
    else if (overId === 'available') {
      const newZoneContents = { ...zoneContents };
      
      // Remove from source zone
      if (sourceZone !== null) {
        newZoneContents[sourceZone] = (newZoneContents[sourceZone] || []).filter(
          item => item !== draggedItem
        );
      }

      // Add back to available
      if (!availableItems.includes(draggedItem)) {
        setAvailableItems([...availableItems, draggedItem]);
      }

      setZoneContents(newZoneContents);
    }

    setActiveId(null);
  };

  const activeItem = activeId ? getItemFromId(activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4 dnd-scroll-container">
        {/* Available items */}
        <AvailableItemsArea
          items={availableItems}
          disabled={disabled}
          isDragging={!!activeId}
        />

        {/* Drop zones */}
        <div className="grid gap-4 md:grid-cols-2">
          {dropZones.map((zone) => (
            <DroppableZone
              key={zone.zone_id}
              id={`zone-${zone.zone_id}`}
              zone={zone}
              items={zoneContents[zone.zone_id] || []}
              disabled={disabled}
              isDragging={!!activeId}
            />
          ))}
        </div>
      </div>

      {/* Drag Overlay - Keep it clean without offset modifiers */}
      <DragOverlay>
        {activeItem ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-primary/20 rounded-md shadow-lg border border-primary">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            <span>{activeItem}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}