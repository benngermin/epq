import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Bot, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ChatInterfaceProps {
  questionVersionId: number;
  chosenAnswer: string;
  correctAnswer: string;
}

interface ChatMessage {
  role: "assistant" | "user";
  content: string;
  isStreaming?: boolean;
  id?: string;
}

export function ChatInterface({ questionVersionId, chosenAnswer, correctAnswer }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState("");
  const [hasRequestedInitial, setHasRequestedInitial] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingContentRef = useRef<string>("");
  const streamingMessageIdRef = useRef<string>("");

  const currentQuestionKey = `${questionVersionId}-${chosenAnswer}-${correctAnswer}`;

  // Stream chat response function using WebSocket-style approach
  const streamChatResponse = async (userMessage?: string) => {
    console.log("Starting stream chat response...");
    setIsStreaming(true);
    
    // Generate unique ID for this streaming message
    const messageId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    streamingMessageIdRef.current = messageId;
    streamingContentRef.current = "";

    // Add initial assistant message
    setMessages(prev => [{
      role: "assistant",
      content: "",
      isStreaming: true,
      id: messageId
    }, ...prev]);
    
    try {
      // Use a polling approach for reliable streaming
      const response = await fetch('/api/chatbot/stream-init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          questionVersionId,
          chosenAnswer,
          userMessage,
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const { streamId } = await response.json();
      console.log("Stream initialized with ID:", streamId);

      // Poll for chunks
      let done = false;
      while (!done) {
        try {
          const chunkResponse = await fetch(`/api/chatbot/stream-chunk/${streamId}`, {
            credentials: 'include',
          });

          if (!chunkResponse.ok) {
            throw new Error('Failed to fetch chunk');
          }

          const chunkData = await chunkResponse.json();
          console.log("Chunk data received:", chunkData);
          
          if (chunkData.done) {
            done = true;
            console.log("Stream completed, final content length:", streamingContentRef.current.length);
            setMessages(prev => {
              return prev.map(msg => 
                msg.id === streamingMessageIdRef.current && msg.isStreaming
                  ? { ...msg, isStreaming: false }
                  : msg
              );
            });
            setIsStreaming(false);
            break;
          }

          if (chunkData.content) {
            streamingContentRef.current += chunkData.content;
            console.log("Received content:", chunkData.content.substring(0, 50), "Total length:", streamingContentRef.current.length);
            
            // Update the streaming message using the message ID
            setMessages(prev => {
              return prev.map(msg => 
                msg.id === streamingMessageIdRef.current && msg.isStreaming
                  ? { ...msg, content: streamingContentRef.current }
                  : msg
              );
            });
            
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 10);
          }

          if (chunkData.error) {
            throw new Error(chunkData.error);
          }

        } catch (pollError) {
          console.error("Polling error:", pollError);
          // Continue polling on minor errors
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Small delay between polls
        await new Promise(resolve => setTimeout(resolve, 50));
      }

    } catch (error: any) {
      console.error("Streaming error:", error);
      
      // Remove the streaming message and show error
      setMessages(prev => prev.filter(msg => !msg.isStreaming));
      
      toast({
        title: "Error",
        description: "Failed to get response from AI assistant",
        variant: "destructive",
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const chatMutation = useMutation({
    mutationFn: streamChatResponse,
    onError: (error: Error) => {
      console.error("Chat error:", error.message);
      toast({
        title: "Error",
        description: "Failed to get response from AI assistant",
        variant: "destructive",
      });
    },
  });

  // Get initial explanation only once per question
  useEffect(() => {
    if (!hasRequestedInitial && !isStreaming) {
      setHasRequestedInitial(true);
      setMessages([]); // Clear previous messages
      streamChatResponse(undefined);
    }
  }, [currentQuestionKey]);

  // Reset when question changes
  useEffect(() => {
    // Abort any ongoing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setHasRequestedInitial(false);
    setMessages([]);
    setIsStreaming(false);
  }, [currentQuestionKey]);

  const handleSendMessage = () => {
    if (!userInput.trim() || isStreaming) return;

    const newUserMessage = { 
      role: "user" as const, 
      content: userInput, 
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
    };
    setMessages(prev => [newUserMessage, ...prev]);
    
    streamChatResponse(userInput);
    setUserInput("");
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
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
            {isStreaming && messages.length === 0 && (
              <div className="flex items-center justify-center h-32">
                <div className="flex items-center space-x-2">
                  <Bot className="h-5 w-5 animate-pulse text-primary" />
                  <span className="text-sm text-muted-foreground">Assistant is thinking...</span>
                </div>
              </div>
            )}

            {messages.slice().reverse().map((message, index) => (
              <div
                key={index}
                className={cn(
                  "flex w-full",
                  message.role === "assistant" ? "justify-start" : "justify-end"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm break-words",
                    message.role === "assistant"
                      ? "bg-muted text-foreground rounded-tl-none"
                      : "bg-primary text-primary-foreground rounded-tr-none"
                  )}
                >
                  <div className="flex items-start gap-2">
                    {message.role === "assistant" && (
                      <Bot className={cn(
                        "h-4 w-4 mt-0.5 flex-shrink-0 text-primary",
                        message.isStreaming && "animate-pulse"
                      )} />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="whitespace-pre-wrap leading-relaxed">
                        {message.content}
                        {message.isStreaming && (
                          <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="flex space-x-2 flex-shrink-0">
          <Input
            placeholder="Ask a follow-up question..."
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyPress={handleKeyPress}
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
