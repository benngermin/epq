import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface FisheyeNavigationItem {
  id: number;
  label: string;
  isActive?: boolean;
  hasEdits?: boolean;
  type?: string;
  mode?: "ai" | "static";
}

interface FisheyeNavigationProps {
  items: FisheyeNavigationItem[];
  onItemClick: (id: number) => void;
  currentItemId?: number;
}

export function FisheyeNavigation({ 
  items, 
  onItemClick, 
  currentItemId 
}: FisheyeNavigationProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };
  
  const getItemScale = (index: number) => {
    if (hoveredIndex === null) return 1;
    
    const distance = Math.abs(index - hoveredIndex);
    
    if (distance === 0) return 1.3;
    if (distance === 1) return 1.15;
    if (distance === 2) return 1.05;
    return 1;
  };
  
  const getItemOpacity = (index: number) => {
    if (hoveredIndex === null) return 0.8;
    
    const distance = Math.abs(index - hoveredIndex);
    
    if (distance === 0) return 1;
    if (distance <= 2) return 0.9;
    return 0.7;
  };
  
  const getItemWidth = (index: number) => {
    const scale = getItemScale(index);
    const baseWidth = 60;
    return baseWidth * scale;
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent, itemId: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onItemClick(itemId);
    }
  };

  // Auto-scroll to current item when it changes
  useEffect(() => {
    if (currentItemId && scrollContainerRef.current) {
      const currentButton = scrollContainerRef.current.querySelector(
        `[data-fisheye-id="${currentItemId}"]`
      ) as HTMLElement;
      
      if (currentButton) {
        currentButton.scrollIntoView({ 
          behavior: 'smooth', 
          inline: 'center',
          block: 'nearest' 
        });
      }
    }
  }, [currentItemId]);
  
  return (
    <div
      ref={containerRef}
      className="relative w-full border-b bg-muted/5"
      onMouseLeave={handleMouseLeave}
    >
      <div 
        ref={scrollContainerRef}
        className="flex items-center gap-1 px-4 py-2 overflow-x-auto overflow-y-hidden scrollbar-thin"
        style={{ scrollbarWidth: 'thin' }}
      >
        {items.map((item, index) => {
          const scale = getItemScale(index);
          const opacity = getItemOpacity(index);
          const width = getItemWidth(index);
          const isHovered = hoveredIndex === index;
          const isCurrent = currentItemId === item.id;
          
          return (
            <button
              key={item.id}
              data-fisheye-id={item.id}
              className={cn(
                "relative flex items-center justify-center cursor-pointer transition-all duration-200 ease-out",
                "px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap",
                "hover:bg-muted/50 hover:ring-2 hover:ring-inset hover:ring-muted-foreground/20",
                isCurrent && "bg-primary/10 ring-2 ring-inset ring-primary/50 text-primary",
                !isCurrent && "text-muted-foreground hover:text-foreground",
                isHovered && "z-10",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
              )}
              style={{
                minWidth: `${width}px`,
                transform: `scaleY(${scale})`,
                opacity,
                transformOrigin: 'center'
              }}
              onMouseEnter={() => setHoveredIndex(index)}
              onClick={() => onItemClick(item.id)}
              onKeyDown={(e) => handleKeyDown(e, item.id)}
              data-testid={`fisheye-item-${item.id}`}
              title={`Question ${index + 1}: ${item.label.substring(0, 50)}...`}
            >
              <div className="flex items-center gap-1.5">
                {/* Question Number */}
                <span className="font-semibold">
                  Q{index + 1}
                </span>
                
                {/* Status Indicators */}
                <div className="flex items-center gap-0.5">
                  {item.hasEdits && (
                    <div className="w-2 h-2 rounded-full bg-yellow-500" title="Modified" />
                  )}
                  {item.mode === "static" && (
                    <div className="w-2 h-2 rounded-full bg-blue-500" title="Static" />
                  )}
                  {(!item.mode || item.mode === "ai") && (
                    <div className="w-2 h-2 rounded-full bg-green-500" title="AI" />
                  )}
                </div>
                
                {/* Type badge for hovered items */}
                {isHovered && item.type && (
                  <span className="text-xs opacity-80">
                    {item.type.split("_").map(w => w[0].toUpperCase()).join("")}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}