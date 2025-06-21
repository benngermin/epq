import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Bot, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SimpleStreamingChatProps {
  questionVersionId: number;
  chosenAnswer: string;
  correctAnswer: string;
}

export function SimpleStreamingChat({ questionVersionId, chosenAnswer, correctAnswer }: SimpleStreamingChatProps) {
  const [userInput, setUserInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [messages, setMessages] = useState<Array<{id: string, content: string, role: "user" | "assistant"}>>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [showStreaming, setShowStreaming] = useState(false);
  const { toast } = useToast();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isInitializedRef = useRef(false);
  const currentStreamRef = useRef<string>("");
  const currentQuestionKey = useRef<string>("");
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const startStream = async (userMessage?: string) => {
    if (isStreaming) return;
    
    // Cancel any existing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();
    
    setIsStreaming(true);
    currentStreamRef.current = "";
    
    // Clear and show streaming container
    setStreamingContent("Starting response...");
    setShowStreaming(true);

    try {
      console.log('Starting stream initialization...');
      // Initialize stream
      const response = await fetch('/api/chatbot/stream-init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionVersionId, chosenAnswer, userMessage }),
        credentials: 'include',
        signal: abortControllerRef.current.signal,
      });

      console.log('Stream init response status:', response.status);
      if (!response.ok) throw new Error('Failed to initialize stream');
      
      const { streamId } = await response.json();
      console.log('Stream ID received:', streamId);
      
      // Poll for chunks
      let done = false;
      let accumulatedContent = "";
      let consecutiveErrors = 0;
      const maxErrors = 3;
      
      console.log('Starting polling loop...');
      while (!done && consecutiveErrors < maxErrors) {
        try {
          console.log(`Fetching chunk ${streamId}...`);
          const chunkResponse = await fetch(`/api/chatbot/stream-chunk/${streamId}`, {
            credentials: 'include',
            signal: abortControllerRef.current.signal,
          });
          
          console.log('Chunk response status:', chunkResponse.status);
          if (!chunkResponse.ok) {
            if (chunkResponse.status === 404) {
              console.log('Stream ended (404)');
              // Stream ended or not found, treat as done
              done = true;
              break;
            }
            throw new Error(`HTTP ${chunkResponse.status}: Failed to fetch chunk`);
          }
          
          const chunkData = await chunkResponse.json();
          console.log('Chunk data:', chunkData);
          
          // Reset error counter on successful response
          consecutiveErrors = 0;
          
          if (chunkData.error) {
            throw new Error(chunkData.error);
          }
          
          if (chunkData.done) {
            console.log('Stream marked as done');
            done = true;
            // Keep the content in streaming container - don't move to messages
          } else if (chunkData.content) {
            accumulatedContent += chunkData.content;
            currentStreamRef.current = accumulatedContent;
            
            // Update streaming content with React state
            console.log('Setting streaming content:', accumulatedContent.substring(0, 100) + '...');
            setStreamingContent(accumulatedContent);
            setShowStreaming(true);
            
            // Auto-scroll to bottom
            setTimeout(() => {
              if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
              }
            }, 10);
          }
          
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (chunkError: any) {
          if (chunkError.name === 'AbortError') {
            // Request was cancelled, exit gracefully
            return;
          }
          
          consecutiveErrors++;
          console.warn(`Chunk fetch error (${consecutiveErrors}/${maxErrors}):`, chunkError);
          
          if (consecutiveErrors >= maxErrors) {
            throw chunkError;
          }
          
          // Wait a bit longer before retrying
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // Request was cancelled, don't show error
        return;
      }
      
      console.error("Streaming error:", error);
      
      // Only show error toast if we don't have any content to display
      if (!currentStreamRef.current) {
        toast({
          title: "Error",
          description: "Failed to get response from AI assistant",
          variant: "destructive",
        });
        
        setStreamingContent("Error loading response. Please try again.");
        setShowStreaming(true);
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  // Reset and initialize when question changes
  useEffect(() => {
    const questionKey = `${questionVersionId}-${chosenAnswer}-${correctAnswer}`;
    
    // If this is a new question, reset everything
    if (currentQuestionKey.current !== questionKey) {
      currentQuestionKey.current = questionKey;
      
      // Clear any pending initialization timeout
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
        initTimeoutRef.current = null;
      }
      
      // Cancel any ongoing requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      // Reset state
      setMessages([]);
      setUserInput("");
      setIsStreaming(false);
      setStreamingContent("");
      setShowStreaming(false);
      currentStreamRef.current = "";
      
      // Initialize new stream after a short delay
      initTimeoutRef.current = setTimeout(() => {
        startStream();
        initTimeoutRef.current = null;
      }, 500);
    }
  }, [questionVersionId, chosenAnswer, correctAnswer]);

  // Cleanup timeout and abort controller on unmount
  useEffect(() => {
    return () => {
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleSendMessage = () => {
    if (!userInput.trim() || isStreaming) return;

    // Add user message to regular messages
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      content: userInput,
      role: "user"
    }]);
    
    startStream(userInput);
    setUserInput("");
    
    // Auto-scroll after adding user message
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      }
    }, 100);
  };

  return (
    <Card className="bg-background w-full h-full">
      <CardContent className="p-3 md:p-4 h-full flex flex-col">
        <div className="flex items-center mb-3">
          <Bot className="h-5 w-5 text-primary mr-2" />
          <span className="font-medium text-foreground text-base">AI Assistant</span>
        </div>

        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto mb-3 min-h-0" 
          style={{ maxHeight: 'calc(100% - 120px)' }}
        >
          <div className="space-y-3 p-2">
            
            {/* Live streaming display */}
            {showStreaming && (
              <div className="flex w-full justify-start">
                <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm break-words bg-muted text-foreground rounded-tl-none">
                  <div className="flex items-start gap-2">
                    <Bot className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                    <div className="flex-1 min-w-0">
                      <div className="whitespace-pre-wrap leading-relaxed">
                        {streamingContent}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Debug info */}
            {process.env.NODE_ENV === 'development' && (
              <div className="text-xs text-muted-foreground p-2 border rounded">
                <div>Show Streaming: {showStreaming ? 'true' : 'false'}</div>
                <div>Content Length: {streamingContent.length}</div>
                <div>Is Streaming: {isStreaming ? 'true' : 'false'}</div>
              </div>
            )}

            {/* Regular messages */}
            {messages.slice().reverse().map((message) => (
              <div
                key={message.id}
                className={`flex w-full ${message.role === "assistant" ? "justify-start" : "justify-end"}`}
              >
                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm break-words ${
                  message.role === "assistant"
                    ? "bg-muted text-foreground rounded-tl-none"
                    : "bg-primary text-primary-foreground rounded-tr-none"
                }`}>
                  <div className="flex items-start gap-2">
                    {message.role === "assistant" && (
                      <Bot className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="whitespace-pre-wrap leading-relaxed">
                        {message.content}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex space-x-2 flex-shrink-0">
          <Input
            placeholder="Ask a follow-up question..."
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            className="flex-1 text-sm min-w-0 h-9"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!userInput.trim() || isStreaming}
            size="sm"
            className="flex-shrink-0 h-9 px-3"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}