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
      console.log("[SSE Hook] Aborting stream");
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
    console.log("[SSE Hook] Starting stream for questionVersionId:", questionVersionId);
    
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
      
      console.log("[SSE Hook] Fetching SSE endpoint:", endpoint);
      console.log("[SSE Hook] With data:", { 
        questionVersionId, 
        chosenAnswer, 
        hasUserMessage: !!userMessage,
        historyLength: conversationHistory?.length || 0
      });
      
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
      
      console.log("[SSE Hook] Response received, status:", response.status);
      console.log("[SSE Hook] Response headers:", response.headers.get('content-type'));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[SSE Hook] Response not OK:", errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body reader available");
      }
      
      console.log("[SSE Hook] Reader obtained, starting to read chunks");
      
      const decoder = new TextDecoder();
      let buffer = '';
      let chunkCount = 0;
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log("[SSE Hook] Stream complete");
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
              chunkCount++;
              
              console.log(`[SSE Hook] Reading chunk ${chunkCount}, type: ${message.type}`);
              
              switch (message.type) {
                case 'connected':
                  console.log("[SSE Hook] Connected to SSE stream");
                  break;
                  
                case 'chunk':
                  // Call onChunk with full accumulated content
                  options.onChunk(message.content);
                  break;
                  
                case 'done':
                  console.log("[SSE Hook] Stream done, history length:", message.conversationHistory?.length || 0);
                  options.onComplete(message.conversationHistory || []);
                  setIsStreaming(false);
                  break;
                  
                case 'error':
                  console.error("[SSE Hook] Stream error:", message.message);
                  options.onError(message.message || 'Unknown error');
                  setIsStreaming(false);
                  break;
                  
                default:
                  console.warn("[SSE Hook] Unknown message type:", message.type);
              }
            } catch (e) {
              console.error("[SSE Hook] Failed to parse SSE message:", e);
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log("[SSE Hook] Stream aborted by user");
      } else {
        console.error("[SSE Hook] Stream error:", error);
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