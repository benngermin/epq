import { useState, useEffect, useCallback, useRef } from 'react';

interface KeyboardState {
  isVisible: boolean;
  height: number;
  source?: 'visualViewport' | 'innerHeight' | 'flutter';
}

// Expose global function for Flutter to communicate keyboard height
declare global {
  interface Window {
    __flutterKeyboardHeightUpdate?: (height: number) => void;
  }
}

/**
 * Hook to detect keyboard visibility and height on mobile devices
 * Works with both standard browsers and Flutter WebView environments
 */
export function useKeyboardHeight(): KeyboardState {
  const [keyboardState, setKeyboardState] = useState<KeyboardState>({
    isVisible: false,
    height: 0,
    source: undefined
  });

  // Track baseline viewport height (the height when keyboard is not showing)
  const baselineHeightRef = useRef<number>(0);
  
  // Track if input is focused for webview fallback
  const isInputFocusedRef = useRef<boolean>(false);
  
  // Track last known orientation
  const lastOrientationRef = useRef<string>("");
  
  // Ref to store the callback for Flutter bridge
  const flutterCallbackRef = useRef<(height: number) => void>();

  // Detect if we're in a webview/mobile-view environment
  const isInWebView = useCallback(() => {
    const userAgent = navigator.userAgent || navigator.vendor || '';
    // Check for common webview indicators or mobile-view path
    return /WebView|wv|Android.*Version\/\d+\.\d+/i.test(userAgent) || 
           window.location.pathname.includes('/mobile-view');
  }, []);

  useEffect(() => {
    const inWebView = isInWebView();
    
    // If Visual Viewport API is available and we're NOT in a webview, use it
    if (!inWebView && window.visualViewport) {
      console.log('Using Visual Viewport API for keyboard detection');
      
      // Initialize baseline
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
        
        // Calculate height difference from baseline
        const currentViewportHeight = visualViewport.height;
        const heightDifference = baselineHeightRef.current - currentViewportHeight;
        
        // Detect keyboard with multiple signals
        const hasSignificantReduction = heightDifference > 100;
        const hasViewportOffset = visualViewport.offsetTop > 0;
        
        const keyboardVisible = hasSignificantReduction || hasViewportOffset;
        
        // Reset baseline when keyboard hides
        if (!keyboardVisible && keyboardState.isVisible) {
          baselineHeightRef.current = currentWindowHeight;
        }
        
        setKeyboardState({
          isVisible: keyboardVisible,
          height: keyboardVisible ? Math.max(heightDifference, 0) : 0,
          source: 'visualViewport'
        });
      };

      window.visualViewport.addEventListener('resize', handleViewportChange);
      window.visualViewport.addEventListener('scroll', handleViewportChange);
      window.addEventListener('orientationchange', handleViewportChange);
      window.addEventListener('resize', handleViewportChange);
      
      handleViewportChange();

      return () => {
        window.visualViewport?.removeEventListener('resize', handleViewportChange);
        window.visualViewport?.removeEventListener('scroll', handleViewportChange);
        window.removeEventListener('orientationchange', handleViewportChange);
        window.removeEventListener('resize', handleViewportChange);
      };
    } else {
      // Fallback for WebView environments (Flutter, etc.)
      console.log('Using fallback keyboard detection for WebView/mobile-view environment');
      
      // Initialize baseline with current window height
      baselineHeightRef.current = window.innerHeight;
      console.log('Initial baseline height (innerHeight):', window.innerHeight);

      // Track focus/blur events on inputs
      const handleFocus = (e: FocusEvent) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          console.log('Input focused in webview');
          isInputFocusedRef.current = true;
          
          // Wait for keyboard animation
          setTimeout(() => {
            const currentHeight = window.innerHeight;
            const heightDiff = baselineHeightRef.current - currentHeight;
            
            // Consider keyboard visible if height reduced by more than 100px
            if (heightDiff > 100) {
              setKeyboardState({
                isVisible: true,
                height: heightDiff,
                source: 'innerHeight'
              });
              console.log('Keyboard detected via focus (innerHeight):', heightDiff);
            }
          }, 300);
        }
      };

      const handleBlur = (e: FocusEvent) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          console.log('Input blurred in webview');
          isInputFocusedRef.current = false;
          
          // Wait to see if focus moves to another input
          setTimeout(() => {
            const activeEl = document.activeElement;
            if (!activeEl || 
                (activeEl.tagName !== 'INPUT' && 
                 activeEl.tagName !== 'TEXTAREA')) {
              setKeyboardState({
                isVisible: false,
                height: 0,
                source: 'innerHeight'
              });
              console.log('Keyboard hidden via blur');
              
              // Update baseline after keyboard is hidden
              setTimeout(() => {
                baselineHeightRef.current = window.innerHeight;
                console.log('Updated baseline after keyboard hidden:', window.innerHeight);
              }, 500);
            }
          }, 100);
        }
      };

      const handleResize = () => {
        // Only process resize if an input is focused
        if (isInputFocusedRef.current) {
          const currentHeight = window.innerHeight;
          const heightDiff = baselineHeightRef.current - currentHeight;
          
          setKeyboardState({
            isVisible: heightDiff > 100,
            height: Math.max(heightDiff, 0),
            source: 'innerHeight'
          });
          
          console.log('Window resized while input focused:', { 
            currentHeight, 
            heightDiff, 
            baseline: baselineHeightRef.current 
          });
        }
      };

      // Setup Flutter bridge callback
      flutterCallbackRef.current = (height: number) => {
        console.log('Received keyboard height from Flutter:', height);
        setKeyboardState({
          isVisible: height > 0,
          height: height,
          source: 'flutter'
        });
      };
      
      // Expose global function for Flutter to call
      window.__flutterKeyboardHeightUpdate = flutterCallbackRef.current;

      // Add event listeners with capture phase for better detection
      document.addEventListener('focusin', handleFocus, true);
      document.addEventListener('focusout', handleBlur, true);
      window.addEventListener('resize', handleResize);

      return () => {
        document.removeEventListener('focusin', handleFocus, true);
        document.removeEventListener('focusout', handleBlur, true);
        window.removeEventListener('resize', handleResize);
        delete window.__flutterKeyboardHeightUpdate;
      };
    }
  }, [isInWebView, keyboardState.isVisible]);

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