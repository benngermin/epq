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
  const { toast } = useToast();
  const streamingRef = useRef<HTMLDivElement>(null);
  const isInitializedRef = useRef(false);
  const currentStreamRef = useRef<string>("");

  const startStream = async (userMessage?: string) => {
    if (isStreaming) return;
    
    setIsStreaming(true);
    currentStreamRef.current = "";
    
    // Clear and show streaming container
    if (streamingRef.current) {
      streamingRef.current.innerHTML = "Starting response...";
      streamingRef.current.style.display = "block";
    }

    try {
      // Initialize stream
      const response = await fetch('/api/chatbot/stream-init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionVersionId, chosenAnswer, userMessage }),
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to initialize stream');
      
      const { streamId } = await response.json();
      
      // Poll for chunks
      let done = false;
      let accumulatedContent = "";
      
      while (!done) {
        const chunkResponse = await fetch(`/api/chatbot/stream-chunk/${streamId}`, {
          credentials: 'include',
        });
        
        if (!chunkResponse.ok) throw new Error('Failed to fetch chunk');
        
        const chunkData = await chunkResponse.json();
        
        if (chunkData.done) {
          done = true;
          // Move to final messages
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            content: accumulatedContent,
            role: "assistant"
          }]);
          
          // Hide streaming container
          if (streamingRef.current) {
            streamingRef.current.style.display = "none";
          }
        } else if (chunkData.content) {
          accumulatedContent += chunkData.content;
          currentStreamRef.current = accumulatedContent;
          
          // Update DOM directly
          if (streamingRef.current) {
            streamingRef.current.innerHTML = accumulatedContent.replace(/\n/g, '<br>');
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
    } catch (error) {
      console.error("Streaming error:", error);
      toast({
        title: "Error",
        description: "Failed to get response from AI assistant",
        variant: "destructive",
      });
      
      if (streamingRef.current) {
        streamingRef.current.style.display = "none";
      }
    } finally {
      setIsStreaming(false);
    }
  };

  // Initialize on mount
  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      setTimeout(() => startStream(), 500);
    }
  }, [questionVersionId, chosenAnswer, correctAnswer]);

  const handleSendMessage = () => {
    if (!userInput.trim() || isStreaming) return;

    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      content: userInput,
      role: "user"
    }]);
    
    startStream(userInput);
    setUserInput("");
  };

  return (
    <Card className="bg-background w-full h-full">
      <CardContent className="p-3 md:p-4 h-full flex flex-col">
        <div className="flex items-center mb-3">
          <Bot className="h-5 w-5 text-primary mr-2" />
          <span className="font-medium text-foreground text-base">AI Assistant</span>
        </div>

        <div className="flex-1 overflow-y-auto mb-3 min-h-0" style={{ maxHeight: 'calc(100% - 120px)' }}>
          <div className="space-y-3 p-2">
            
            {/* Live streaming display */}
            <div 
              ref={streamingRef}
              style={{ display: 'none' }}
              className="flex w-full justify-start"
            >
              <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm break-words bg-green-50 dark:bg-green-900 border-2 border-green-300 text-foreground rounded-tl-none">
                <div className="flex items-start gap-2">
                  <Bot className="h-4 w-4 mt-0.5 flex-shrink-0 text-green-600 animate-pulse" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-green-700 mb-1 font-bold">LIVE STREAMING</div>
                    <div className="whitespace-pre-wrap leading-relaxed text-green-900 dark:text-green-100">
                      Loading...
                    </div>
                  </div>
                </div>
              </div>
            </div>

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