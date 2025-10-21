import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { GripVertical } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useLocation } from "wouter";

interface DragDropZonesTouchProps {
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

// Draggable item component
function DraggableItem({ 
  id, 
  children, 
  disabled,
  isOverlay = false
}: { 
  id: string; 
  children: React.ReactNode; 
  disabled?: boolean;
  isOverlay?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging && !isOverlay ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-md cursor-move",
        "border border-border",
        isOverlay ? "bg-primary/20 shadow-lg" : "bg-primary/10",
        "hover:bg-primary/20 hover:shadow-md hover:-translate-y-0.5",
        "transition-all duration-200 ease-in-out",
        disabled && "cursor-not-allowed opacity-50"
      )}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <span>{children}</span>
    </div>
  );
}

// Droppable zone component
function DroppableZone({
  id,
  items,
  label,
  disabled,
  isDraggingOver,
  onItemClick,
}: {
  id: string;
  items: string[];
  label: string;
  disabled?: boolean;
  isDraggingOver: boolean;
  onItemClick?: (item: string) => void;
}) {
  return (
    <div
      className={cn(
        "p-4 rounded-lg border-2 border-dashed border-muted-foreground/30",
        "transition-all duration-200",
        isDraggingOver && "border-primary bg-primary/10 scale-[1.02] shadow-lg"
      )}
    >
      <h4 className="font-medium text-center mb-3 text-muted-foreground uppercase text-sm tracking-wider">
        {label}
      </h4>
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <div className="flex flex-wrap gap-2 min-h-[34px]">
          {items.map((item) => (
            <DraggableItem
              key={item}
              id={`${id}-${item}`}
              disabled={disabled}
            >
              {item}
            </DraggableItem>
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

export function DragDropZonesTouch({
  answerChoices,
  dropZones = [],
  value,
  onChange,
  disabled,
  correctAnswer,
}: DragDropZonesTouchProps) {
  const [location] = useLocation();
  
  // Route gating: Check if we're on a mobile route
  const isMobileRoute = location.startsWith('/mobile-view');

  // Configure sensors based on route
  const sensors = useSensors(
    useSensor(isMobileRoute ? TouchSensor : PointerSensor, isMobileRoute
      ? { activationConstraint: { delay: 160, tolerance: 8 } } // mobile/WebView settings
      : { activationConstraint: { distance: 4 } }              // desktop/web settings
    )
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragOverZone, setDragOverZone] = useState<string | null>(null);
  
  // Parse and initialize zone contents
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

  // Available items not in any zone
  const [availableItems, setAvailableItems] = useState<string[]>(() => {
    const used = new Set(Object.values(zoneContents).flat());
    return answerChoices.filter(item => !used.has(item));
  });

  // Update parent when zone contents change
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
    if (disabled) return;
    setActiveId(String(event.active.id));
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (disabled) return;
    const overId = event.over?.id ? String(event.over.id) : null;
    
    // Check if we're over a zone
    if (overId) {
      const zoneMatch = overId.match(/^zone-(\d+)/);
      if (zoneMatch) {
        setDragOverZone(overId);
      } else if (overId === 'available') {
        setDragOverZone('available');
      } else {
        // We're over an item, find its parent zone
        for (const [zoneId, items] of Object.entries(zoneContents)) {
          if (items.some(item => overId.includes(item))) {
            setDragOverZone(`zone-${zoneId}`);
            return;
          }
        }
        // Check if it's in available items
        if (availableItems.some(item => overId.includes(item))) {
          setDragOverZone('available');
        }
      }
    } else {
      setDragOverZone(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (disabled || !activeId) return;
    
    const overId = event.over?.id ? String(event.over.id) : null;
    
    if (!overId || activeId === overId) {
      setActiveId(null);
      setDragOverZone(null);
      return;
    }

    // Extract the actual item ID from the drag ID
    const draggedItem = activeId.includes('-') 
      ? activeId.split('-').slice(1).join('-')
      : activeId;

    // Determine source and destination
    let sourceZone: 'available' | number | null = null;
    let destZone: 'available' | number | null = null;

    // Find source zone
    if (availableItems.includes(draggedItem)) {
      sourceZone = 'available';
    } else {
      for (const [zoneId, items] of Object.entries(zoneContents)) {
        if (items.includes(draggedItem)) {
          sourceZone = parseInt(zoneId);
          break;
        }
      }
    }

    // Determine destination zone
    const destZoneMatch = overId.match(/^zone-(\d+)/);
    if (destZoneMatch) {
      destZone = parseInt(destZoneMatch[1]);
    } else if (overId === 'available' || overId.startsWith('available-')) {
      destZone = 'available';
    } else {
      // Check if dropped on an item in a zone
      for (const [zoneId, items] of Object.entries(zoneContents)) {
        if (items.some(item => overId.includes(item))) {
          destZone = parseInt(zoneId);
          break;
        }
      }
      // Check if dropped on an item in available
      if (destZone === null && availableItems.some(item => overId.includes(item))) {
        destZone = 'available';
      }
    }

    if (destZone === null) {
      setActiveId(null);
      setDragOverZone(null);
      return;
    }

    // Perform the move
    const newZoneContents = { ...zoneContents };
    let newAvailableItems = [...availableItems];

    // Remove from source
    if (sourceZone === 'available') {
      newAvailableItems = newAvailableItems.filter(item => item !== draggedItem);
    } else if (typeof sourceZone === 'number') {
      newZoneContents[sourceZone] = (newZoneContents[sourceZone] || []).filter(
        item => item !== draggedItem
      );
    }

    // Add to destination
    if (destZone === 'available') {
      if (!newAvailableItems.includes(draggedItem)) {
        newAvailableItems.push(draggedItem);
      }
    } else {
      if (!newZoneContents[destZone]) {
        newZoneContents[destZone] = [];
      }
      if (!newZoneContents[destZone].includes(draggedItem)) {
        newZoneContents[destZone].push(draggedItem);
      }
    }

    setZoneContents(newZoneContents);
    setAvailableItems(newAvailableItems);
    setActiveId(null);
    setDragOverZone(null);
  };

  // Get the actual item being dragged
  const activeItem = activeId
    ? activeId.includes('-') 
      ? activeId.split('-').slice(1).join('-')
      : activeId
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4">
        {/* Available items */}
        <Card className="p-4">
          <h4 className="font-medium mb-2">Available Items</h4>
          <SortableContext 
            items={availableItems.map(item => `available-${item}`)} 
            strategy={verticalListSortingStrategy}
          >
            <div 
              id="available"
              className={cn(
                "flex flex-wrap gap-2 min-h-[60px]",
                dragOverZone === 'available' && "bg-primary/5 rounded-md"
              )}
            >
              {availableItems.map((item) => (
                <DraggableItem
                  key={item}
                  id={`available-${item}`}
                  disabled={disabled}
                >
                  {item}
                </DraggableItem>
              ))}
            </div>
          </SortableContext>
        </Card>

        {/* Drop zones */}
        <div className="grid gap-4 md:grid-cols-2">
          {dropZones.map((zone) => (
            <DroppableZone
              key={zone.zone_id}
              id={`zone-${zone.zone_id}`}
              items={(zoneContents[zone.zone_id] || []).map(item => `zone-${zone.zone_id}-${item}`)}
              label={zone.zone_label}
              disabled={disabled}
              isDraggingOver={dragOverZone === `zone-${zone.zone_id}`}
            />
          ))}
        </div>
      </div>

      {/* Keep overlay clean - no modifiers */}
      <DragOverlay dropAnimation={null}>
        {activeItem ? (
          <div
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-md",
              "bg-primary/30 border border-primary shadow-lg",
              "cursor-move"
            )}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span>{activeItem}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}