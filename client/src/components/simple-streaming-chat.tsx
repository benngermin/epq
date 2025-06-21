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
  const [aiResponse, setAiResponse] = useState("");
  const [hasResponse, setHasResponse] = useState(false);

  const { toast } = useToast();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const currentQuestionKey = useRef<string>("");
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadAiResponse = async (userMessage?: string) => {
    if (isStreaming) return;
    
    console.log("Starting AI response load...", { questionVersionId, chosenAnswer, userMessage });
    
    setIsStreaming(true);
    setHasResponse(true);
    setAiResponse("Loading AI response...");
    
    try {
      // Use a simple POST request to get the AI response
      const response = await fetch('/api/chatbot/simple-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionVersionId, chosenAnswer, userMessage }),
        credentials: 'include',
      });

      console.log("Response status:", response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Response error:", errorText);
        throw new Error(`Failed to get AI response: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log("AI response data:", data);
      
      const responseText = data.response || "AI response received but no content available.";
      console.log("Setting AI response:", responseText.substring(0, 100) + "...");
      
      // Force state updates to happen together
      setAiResponse(responseText);
      setHasResponse(true);
      
      // Auto-scroll to bottom
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
      }, 100);
      
    } catch (error: any) {
      console.error("AI response error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to get response from AI assistant",
        variant: "destructive",
      });
      setHasResponse(true);
      setAiResponse("Error loading response. Please try again.");
    } finally {
      setIsStreaming(false);
    }
  };

  // Initialize/reset when question changes
  useEffect(() => {
    console.log("SimpleStreamingChat useEffect triggered", { questionVersionId, chosenAnswer, correctAnswer });
    
    const questionKey = `${questionVersionId}-${chosenAnswer}-${correctAnswer}`;
    
    // Always process new questions
    if (currentQuestionKey.current !== questionKey) {
      console.log("New question detected, resetting chat", { oldKey: currentQuestionKey.current, newKey: questionKey });
      
      // Cancel any existing operations
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
        initTimeoutRef.current = null;
      }
      
      // Update tracking
      currentQuestionKey.current = questionKey;
      
      // Reset state immediately
      setMessages([]);
      setUserInput("");
      setIsStreaming(false);
      setAiResponse("");
      setHasResponse(false);
      
      // Load AI response with a small delay to ensure state is reset
      initTimeoutRef.current = setTimeout(() => {
        console.log("Loading AI response after delay");
        loadAiResponse();
        initTimeoutRef.current = null;
      }, 300);
    } else {
      console.log("Same question key, not reloading", questionKey);
    }
    
    // Cleanup function
    return () => {
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
        initTimeoutRef.current = null;
      }
    };
  }, [questionVersionId, chosenAnswer, correctAnswer]);

  // Cleanup on unmount
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
    
    loadAiResponse(userInput);
    setUserInput("");
    
    // Auto-scroll after adding user message
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      }
    }, 100);
  };

  console.log("SimpleStreamingChat render", { questionVersionId, chosenAnswer, correctAnswer, hasResponse, aiResponse: aiResponse.substring(0, 50) + "..." });

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
            
            {/* AI Response Display */}
            {hasResponse && (
              <div className="flex w-full justify-start">
                <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm break-words bg-muted text-foreground rounded-tl-none">
                  <div className="flex items-start gap-2">
                    <Bot className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                    <div className="flex-1 min-w-0">
                      <div className="whitespace-pre-wrap leading-relaxed">
                        {aiResponse}
                      </div>
                    </div>
                  </div>
                </div>
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