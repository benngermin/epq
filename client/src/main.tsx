import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Clear any potentially cached queries before app starts
if (typeof window !== 'undefined') {
  // Override fetch immediately to block optimized endpoint requests
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = args[0];
    if (typeof url === 'string' && url.includes('/optimized')) {
      console.error('BLOCKING optimized endpoint request at startup:', url);
      // Return a failed response that won't be retried
      return Promise.resolve(new Response(
        JSON.stringify({ message: 'Optimized endpoint does not exist' }), 
        { 
          status: 404, 
          headers: { 'Content-Type': 'application/json' }
        }
      ));
    }
    return originalFetch.apply(this, args);
  };
  
  // Only clear storage items related to optimized endpoints
  try {
    // Clear specific localStorage items
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes('optimized')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch (e) {
    console.error('Failed to clear storage:', e);
  }
}

createRoot(document.getElementById("root")!).render(<App />);
