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
  const [hoveredY, setHoveredY] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      setHoveredY(y);
    }
  };
  
  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };
  
  const getItemScale = (index: number) => {
    if (hoveredIndex === null) return 1;
    
    const distance = Math.abs(index - hoveredIndex);
    
    if (distance === 0) return 1.8;
    if (distance === 1) return 1.4;
    if (distance === 2) return 1.15;
    return 1;
  };
  
  const getItemOpacity = (index: number) => {
    if (hoveredIndex === null) return 0.7;
    
    const distance = Math.abs(index - hoveredIndex);
    
    if (distance === 0) return 1;
    if (distance <= 2) return 0.9;
    return 0.6;
  };
  
  const getItemHeight = (index: number) => {
    const scale = getItemScale(index);
    const baseHeight = 20;
    return baseHeight * scale;
  };
  
  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto overflow-x-hidden"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="py-1 space-y-0.5">
        {items.map((item, index) => {
          const scale = getItemScale(index);
          const opacity = getItemOpacity(index);
          const height = getItemHeight(index);
          const isHovered = hoveredIndex === index;
          const isCurrent = currentItemId === item.id;
          
          return (
            <button
              key={item.id}
              className={cn(
                "relative w-full px-2 cursor-pointer transition-all duration-200 ease-out flex items-center rounded-sm",
                "hover:bg-muted/50 hover:ring-2 hover:ring-inset hover:ring-muted-foreground/20",
                isCurrent && "bg-muted ring-2 ring-inset ring-primary/20",
                isHovered && "z-10",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0"
              )}
              style={{
                height: `${height}px`,
                transform: `scale(${scale})`,
                opacity,
                transformOrigin: 'left center'
              }}
              onMouseEnter={() => setHoveredIndex(index)}
              onClick={() => onItemClick(item.id)}
              data-testid={`fisheye-item-${item.id}`}
            >
              <div className="flex items-center gap-1 w-full min-w-0">
                {/* Question Number */}
                <span className={cn(
                  "text-xs font-semibold whitespace-nowrap",
                  isHovered ? "text-primary" : "text-muted-foreground",
                  isCurrent && "text-primary"
                )}>
                  Q{index + 1}
                </span>
                
                {/* Status Indicators */}
                {isHovered && (
                  <div className="flex items-center gap-0.5">
                    {item.hasEdits && (
                      <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" title="Modified" />
                    )}
                    {item.mode === "static" && (
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500" title="Static" />
                    )}
                    {item.mode === "ai" && (
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500" title="AI" />
                    )}
                  </div>
                )}
              </div>
              
              {/* Hover Details Tooltip */}
              {isHovered && (
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 pointer-events-none">
                  <div className="bg-popover text-popover-foreground rounded-md shadow-md px-3 py-2 max-w-xs">
                    <div className="text-sm font-medium">{item.label}</div>
                    {item.type && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {item.type.split("_").map(word => 
                          word.charAt(0).toUpperCase() + word.slice(1)
                        ).join(" ")}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}