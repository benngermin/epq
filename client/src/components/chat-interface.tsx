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
  const [streamingContent, setStreamingContent] = useState<string>("");
  const [forceRender, setForceRender] = useState(0);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamingDisplayRef = useRef<HTMLParagraphElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingMessageIdRef = useRef<string>("");
  const isStreamingRef = useRef<boolean>(false);
  const streamingContentRef = useRef<string>("");
  const currentStreamIdRef = useRef<string>("");



  const currentQuestionKey = `${questionVersionId}-${chosenAnswer}-${correctAnswer}`;

  // Stream chat response function using WebSocket-style approach
  const streamChatResponse = async (userMessage?: string) => {
    // Prevent multiple concurrent streams
    if (isStreamingRef.current) {
      console.log("Stream already in progress, ignoring request");
      return;
    }
    
    console.log("Starting stream chat response...");
    
    // Generate unique ID for this streaming message
    const messageId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    streamingMessageIdRef.current = messageId;
    
    // Reset and initialize streaming state
    setStreamingContent("");
    streamingContentRef.current = "";
    setIsStreaming(true);
    isStreamingRef.current = true;
    setForceRender(0);
    
    // Clear DOM display
    const streamingDiv = document.getElementById('streaming-content-display');
    if (streamingDiv) {
      streamingDiv.textContent = "";
    }

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
      currentStreamIdRef.current = streamId;

      // Poll for chunks
      let done = false;
      while (!done && isStreamingRef.current) {
        try {

          const chunkResponse = await fetch(`/api/chatbot/stream-chunk/${streamId}`, {
            credentials: 'include',
          });

          if (!chunkResponse.ok) {
            throw new Error('Failed to fetch chunk');
          }

          const chunkData = await chunkResponse.json();
          
          if (chunkData.done && isStreamingRef.current) {
            done = true;
            console.log("🟢 Stream completed, moving to final message");
            
            // Move streaming content to final message
            const finalContent = streamingContentRef.current;
            setMessages(prev => {
              return prev.map(msg => 
                msg.id === streamingMessageIdRef.current && msg.isStreaming
                  ? { ...msg, content: finalContent, isStreaming: false }
                  : msg
              );
            });
            
            // Clean up streaming state after completion
            currentStreamIdRef.current = "";
            isStreamingRef.current = false;
            setIsStreaming(false);
            setStreamingContent("");
            streamingContentRef.current = "";
            setForceRender(0);
            break;
          }

          if (chunkData.content && isStreamingRef.current) {
            // Only append new content if it's different from what we already have
            if (chunkData.content !== streamingContentRef.current) {
              streamingContentRef.current = chunkData.content;
              setStreamingContent(chunkData.content);
              
              // Update the streaming message in the list
              setMessages(prev => {
                return prev.map(msg => 
                  msg.id === streamingMessageIdRef.current && msg.isStreaming
                    ? { ...msg, content: chunkData.content }
                    : msg
                );
              });
              
              setForceRender(prev => prev + 1);
              setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 10);
            }
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
        await new Promise(resolve => setTimeout(resolve, 150));
      }

    } catch (error: any) {
      console.error("Streaming error:", error);
      
      // Remove the streaming message and show error
      setMessages(prev => prev.filter(msg => msg.id !== streamingMessageIdRef.current));
      
      toast({
        title: "Error",
        description: "Failed to get response from AI assistant",
        variant: "destructive",
      });
    } finally {
      // Always clean up streaming state
      isStreamingRef.current = false;
      currentStreamIdRef.current = "";
      setIsStreaming(false);
      setStreamingContent("");
      streamingContentRef.current = "";
      streamingMessageIdRef.current = "";
      setForceRender(0);
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
    if (!hasRequestedInitial && !isStreamingRef.current) {
      setHasRequestedInitial(true);
      setMessages([]); // Clear previous messages
      
      // Use a delay to prevent multiple calls
      const timer = setTimeout(() => {
        if (!isStreamingRef.current) {
          streamChatResponse(undefined);
        }
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [currentQuestionKey]);

  // Reset when question changes
  useEffect(() => {
    // Abort any ongoing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Force cleanup of streaming state
    isStreamingRef.current = false;
    currentStreamIdRef.current = "";
    setIsStreaming(false);
    setStreamingContent("");
    streamingContentRef.current = "";
    streamingMessageIdRef.current = "";
    
    // Reset messages and initial request flag
    setHasRequestedInitial(false);
    setMessages([]);
  }, [currentQuestionKey]);

  const handleSendMessage = () => {
    if (!userInput.trim() || isStreaming || isStreamingRef.current) return;

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

        <div className="flex-1 overflow-y-auto mb-2 min-h-0">
          <div className="space-y-3 p-2">
            {isStreaming && !streamingContent && (
              <div className="flex items-center justify-center h-32">
                <div className="flex items-center space-x-2">
                  <Bot className="h-5 w-5 animate-pulse text-primary" />
                  <span className="text-sm text-muted-foreground">Assistant is thinking...</span>
                </div>
              </div>
            )}

            {/* Show streaming content as a live message - Always render when streaming */}
            <div className="flex w-full justify-start" style={{ display: isStreaming ? 'flex' : 'none' }}>
              <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm break-words bg-yellow-50 dark:bg-yellow-900 border-2 border-yellow-300 text-foreground rounded-tl-none">
                <div className="flex items-start gap-2">
                  <Bot className="h-4 w-4 mt-0.5 flex-shrink-0 text-yellow-600 animate-pulse" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-yellow-700 mb-1 font-bold">🔴 LIVE STREAMING</div>
                    <div 
                      id="streaming-content-display"
                      className="whitespace-pre-wrap leading-relaxed text-yellow-900 dark:text-yellow-100 min-h-[20px]"
                    >
                      {isStreaming ? (streamingContent || "Waiting for content...") : "Not streaming"}
                    </div>
                    <div className="text-xs text-yellow-600 mt-1 font-mono">
                      Content length: {streamingContent?.length || 0} | Streaming: {isStreaming ? 'YES' : 'NO'} | Render: {forceRender}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {messages.slice().reverse().map((message, index) => {
              // Skip streaming messages since we handle them separately above
              if (message.isStreaming) return null;
              
              return (
                <div
                  key={message.id || index}
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
              );
            })}
            
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="flex space-x-2 flex-shrink-0">
          <Input
            placeholder="Ask a follow-up question..."
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1 text-sm min-w-0 h-11 border-2 border-border hover:border-primary/50 focus-visible:border-primary focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!userInput.trim() || isStreaming || isStreamingRef.current}
            size="sm"
            className="flex-shrink-0 h-11 px-6"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
