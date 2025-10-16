import { useState, useRef } from 'react';

interface SSEMessage {
  type: 'connected' | 'chunk' | 'done' | 'error';
  content?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  message?: string;
}

interface UseSSEStreamOptions {
  onChunk?: (content: string) => void;
  onComplete?: (conversationHistory: any[]) => void;
  onError?: (error: string) => void;
}

export function useSSEStream(options: UseSSEStreamOptions = {}) {
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const startStream = async (
    questionVersionId: number,
    chosenAnswer: string,
    userMessage?: string,
    conversationHistory?: any[]
  ) => {
    console.log('[SSE Hook] startStream called with:', { questionVersionId, chosenAnswer, userMessage });
    stopStream();
    setIsStreaming(true);

    try {
      abortControllerRef.current = new AbortController();

      const isDemo = window.location.pathname.startsWith('/demo');
      const isMobileView = window.location.pathname.startsWith('/mobile-view');
      const endpoint = isDemo 
        ? '/api/demo/chatbot/stream-sse' 
        : isMobileView 
          ? '/api/mobile-view/chatbot/stream-sse'
          : '/api/chatbot/stream-sse';
      const isMobile = window.innerWidth < 768;

      console.log('[SSE Hook] Fetching SSE endpoint:', endpoint);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          questionVersionId,
          chosenAnswer,
          userMessage,
          isMobile,
          conversationHistory: conversationHistory || []
        }),
        signal: abortControllerRef.current.signal
      });

      console.log('[SSE Hook] Response received:', {
        status: response.status,
        ok: response.ok,
        headers: response.headers.get('content-type')
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[SSE Hook] Error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No response stream available');

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          setIsStreaming(false);
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;

          const data = line.slice(6).trim();

          try {
            const message: SSEMessage = JSON.parse(data);

            if (message.type === 'chunk' && message.content) {
              options.onChunk?.(message.content);
            } else if (message.type === 'done') {
              setIsStreaming(false);
              options.onComplete?.(message.conversationHistory || []);
            } else if (message.type === 'error') {
              setIsStreaming(false);
              options.onError?.(message.message || 'Stream error');
            }
          } catch (e) {
            console.warn('Failed to parse SSE message:', data);
          }
        }
      }

    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('SSE stream error:', error);
        setIsStreaming(false);
        options.onError?.(error.message || 'Failed to connect to stream');
      }
    }
  };

  const stopStream = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsStreaming(false);
  };

  return { isStreaming, startStream, stopStream };
}