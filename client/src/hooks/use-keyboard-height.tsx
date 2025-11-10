import { useState, useEffect } from "react";

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

  useEffect(() => {
    // Check if Visual Viewport API is available
    if (typeof window === 'undefined' || !window.visualViewport) {
      return;
    }

    // Store initial viewport height
    const initialHeight = window.visualViewport.height;
    const windowHeight = window.innerHeight;

    const handleViewportChange = () => {
      const currentHeight = window.visualViewport?.height || windowHeight;
      const heightDifference = windowHeight - currentHeight;
      
      // Consider keyboard visible if viewport height reduces by more than 100px
      // This threshold helps avoid false positives from browser UI changes
      const keyboardVisible = heightDifference > 100;
      
      setKeyboardState({
        isVisible: keyboardVisible,
        height: keyboardVisible ? heightDifference : 0
      });
    };

    // Listen to viewport resize events
    window.visualViewport.addEventListener('resize', handleViewportChange);
    window.visualViewport.addEventListener('scroll', handleViewportChange);
    
    // Also listen to window resize as fallback
    window.addEventListener('resize', handleViewportChange);
    
    // Initial check
    handleViewportChange();

    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('scroll', handleViewportChange);
      window.removeEventListener('resize', handleViewportChange);
    };
  }, []);

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