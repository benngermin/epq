import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    
    // Use the modern addEventListener API
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    
    // Modern cleanup using removeEventListener (not the deprecated removeListener)
    return () => {
      // Try-catch to handle older browsers that might not support removeEventListener
      try {
        mql.removeEventListener("change", onChange)
      } catch (e) {
        // Fallback for older browsers (though unlikely in modern React apps)
        if ('removeListener' in mql) {
          (mql as any).removeListener(onChange)
        }
      }
    }
  }, [])

  return !!isMobile
}
