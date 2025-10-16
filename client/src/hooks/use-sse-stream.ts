import { useState, useRef, useCallback } from "react";

// SSE Hook for streaming chat responses
interface UseSSEStreamOptions {
  onChunk: (content: string) => void;
  onComplete: (conversationHistory: Array<{ role: string; content: string }>) => void;
  onError: (error: string) => void;
}

export function useSSEStream(options: UseSSEStreamOptions) {
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const stopStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const startStream = useCallback(async (
    questionVersionId: number,
    chosenAnswer: string,
    userMessage: string | undefined,
    conversationHistory?: Array<{ role: string; content: string }>
  ) => {
    // Abort previous streams
    stopStream();
    
    // Set streaming state
    setIsStreaming(true);
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();
    
    try {
      // Determine endpoint based on URL path
      const isDemo = window.location.pathname.startsWith('/demo');
      const isMobileView = window.location.pathname.startsWith('/mobile-view');
      const apiPrefix = isDemo ? '/api/demo' : (isMobileView ? '/api/mobile-view' : '/api');
      const endpoint = `${apiPrefix}/chatbot/stream-sse`;
      
      // Detect if screen is mobile
      const isMobile = window.innerWidth < 768;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          questionVersionId,
          chosenAnswer,
          userMessage,
          isMobile,
          conversationHistory
        }),
        signal: abortControllerRef.current.signal
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("SSE Response error:", errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body reader available");
      }
      
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          const trimmed = line.trim();
          
          if (!trimmed) continue;
          
          if (trimmed.startsWith('data: ')) {
            const data = trimmed.slice(6);
            
            try {
              const message = JSON.parse(data);
              
              switch (message.type) {
                case 'connected':
                  // Stream connected
                  break;
                  
                case 'chunk':
                  // Call onChunk with full accumulated content
                  options.onChunk(message.content);
                  break;
                  
                case 'done':
                  options.onComplete(message.conversationHistory || []);
                  setIsStreaming(false);
                  break;
                  
                case 'error':
                  console.error("SSE Stream error:", message.message);
                  options.onError(message.message || 'Unknown error');
                  setIsStreaming(false);
                  break;
                  
                default:
                  // Unknown message type
                  break;
              }
            } catch (e) {
              console.error("Failed to parse SSE message:", e);
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error("SSE Stream error:", error);
        options.onError(error.message || 'Failed to connect to stream');
      }
      setIsStreaming(false);
    }
  }, [stopStream, options]);

  return {
    isStreaming,
    startStream,
    stopStream
  };
}