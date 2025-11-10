import { useState, useEffect, useRef } from "react";

interface KeyboardState {
  isVisible: boolean;
  height: number;
}

/**
 * Hook to detect keyboard visibility and height on mobile devices
 * Uses the Visual Viewport API for accurate detection
 */
export function useKeyboardHeight(): KeyboardState {
  const [keyboardState, setKeyboardState] = useState<KeyboardState>({
    isVisible: false,
    height: 0
  });
  
  // Use refs to track dynamic baseline height
  const baselineHeightRef = useRef<number>(0);
  const lastOrientationRef = useRef<string>("");

  useEffect(() => {
    // Check if Visual Viewport API is available
    if (typeof window === 'undefined' || !window.visualViewport) {
      return;
    }

    // Initialize baseline height
    baselineHeightRef.current = window.innerHeight;
    lastOrientationRef.current = window.screen.orientation?.type || "";

    const handleViewportChange = () => {
      const visualViewport = window.visualViewport;
      if (!visualViewport) return;
      
      const currentOrientation = window.screen.orientation?.type || "";
      const currentWindowHeight = window.innerHeight;
      
      // Reset baseline if orientation changed
      if (currentOrientation !== lastOrientationRef.current) {
        baselineHeightRef.current = currentWindowHeight;
        lastOrientationRef.current = currentOrientation;
      }
      
      // Calculate height difference from current baseline
      const currentViewportHeight = visualViewport.height;
      const heightDifference = baselineHeightRef.current - currentViewportHeight;
      
      // Use multiple signals to detect keyboard:
      // 1. Viewport height reduces by more than 100px
      // 2. Visual viewport is offset from top (indicates keyboard push)
      const hasSignificantReduction = heightDifference > 100;
      const hasViewportOffset = visualViewport.offsetTop > 0;
      
      const keyboardVisible = hasSignificantReduction || hasViewportOffset;
      
      // If keyboard just became hidden, reset baseline
      if (!keyboardVisible && keyboardState.isVisible) {
        baselineHeightRef.current = currentWindowHeight;
      }
      
      setKeyboardState({
        isVisible: keyboardVisible,
        height: keyboardVisible ? Math.max(heightDifference, 0) : 0
      });
    };

    // Listen to viewport resize events
    window.visualViewport.addEventListener('resize', handleViewportChange);
    window.visualViewport.addEventListener('scroll', handleViewportChange);
    
    // Listen to orientation changes
    window.addEventListener('orientationchange', handleViewportChange);
    // Also listen to window resize as fallback
    window.addEventListener('resize', handleViewportChange);
    
    // Initial check
    handleViewportChange();

    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('scroll', handleViewportChange);
      window.removeEventListener('orientationchange', handleViewportChange);
      window.removeEventListener('resize', handleViewportChange);
    };
  }, [keyboardState.isVisible]);

  return keyboardState;
}

/**
 * Hook to detect if the keyboard is currently visible
 * Simpler alternative when you only need to know visibility
 */
export function useIsKeyboardVisible(): boolean {
  const { isVisible } = useKeyboardHeight();
  return isVisible;
}