import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    
    // Define handler function
    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches)
    }
    
    // Set initial value
    setIsMobile(mql.matches)
    
    // Add event listener using modern API
    // The 'change' event is the standard for MediaQueryList
    mql.addEventListener("change", handleChange)
    
    // Cleanup function to prevent memory leaks
    return () => {
      // Remove event listener using the same function reference
      mql.removeEventListener("change", handleChange)
    }
  }, [])

  return !!isMobile
}
