import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { HtmlLinkRenderer } from "@/components/html-link-renderer";

interface SimpleStreamingChatProps {
  questionVersionId: number;
  chosenAnswer: string;
  correctAnswer: string;
}

export function SimpleStreamingChat({ questionVersionId, chosenAnswer, correctAnswer }: SimpleStreamingChatProps) {
  // Store the original chosen answer to use for follow-up questions
  const originalChosenAnswerRef = useRef(chosenAnswer);
  const [userInput, setUserInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [messages, setMessages] = useState<Array<{id: string, content: string, role: "user" | "assistant"}>>([]);
  const [hasInitialResponse, setHasInitialResponse] = useState(false);

  const { toast } = useToast();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const currentQuestionKey = useRef<string>("");
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentStreamIdRef = useRef<string>("");
  const prevQuestionIdRef = useRef<number | string | undefined>(undefined);

  // Keep a *stable* reference to the learner's first submitted answer
  useEffect(() => {
    if (chosenAnswer) {
      originalChosenAnswerRef.current = chosenAnswer;
    }
  }, [chosenAnswer]);

  const loadAiResponse = async (userMessage?: string) => {
    if (isStreaming) return;
    

    
    /* Guard against accidental empty submissions */
    const finalChosenAnswer = originalChosenAnswerRef.current || chosenAnswer || "";
    if (!finalChosenAnswer && !userMessage) {
      return;
    }
    
    setIsStreaming(true);
    
    try {
      // Initialize streaming
      const response = await fetch('/api/chatbot/stream-init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionVersionId, chosenAnswer: finalChosenAnswer, userMessage }),
        credentials: 'include',
      });

      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get AI response: ${response.status} - ${errorText}`);
      }
      
      const { streamId } = await response.json();
      currentStreamIdRef.current = streamId;

      // Poll for streaming chunks with adaptive delay
      let done = false;
      let accumulatedContent = "";
      let cursor = 0; // Track position in stream
      let pollDelay = 150; // Start with 150ms delay
      const maxDelay = 1000;
      const minDelay = 100;
      
      while (!done && !(abortControllerRef.current?.signal?.aborted ?? false)) {
        try {
          const chunkResponse = await fetch(`/api/chatbot/stream-chunk/${streamId}?cursor=${cursor}`, {
            credentials: 'include',
          });

          if (!chunkResponse.ok) {
            if (chunkResponse.status === 404) {
              break;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
            continue;
          }

          const chunkData = await chunkResponse.json();
          
          if (chunkData.done) {
            done = true;
            break;
          }
          
          if (chunkData.content && chunkData.content.length > accumulatedContent.length) {
            // New content available - append only the new part
            const newContent = chunkData.content.slice(accumulatedContent.length);
            accumulatedContent = chunkData.content;
            cursor = accumulatedContent.length;
            
            // Update the last assistant message by appending new content
            setMessages(prev => {
              const updated = [...prev];
              for (let i = updated.length - 1; i >= 0; i--) {
                if (updated[i].role === "assistant") {
                  updated[i] = { ...updated[i], content: accumulatedContent };
                  break;
                }
              }
              return updated;
            });
            
            // Mark initial response as received if this is the first response
            if (!userMessage && !hasInitialResponse) {
              setHasInitialResponse(true);
            }
            
            // Shrink delay when we get new content (faster polling for active streams)
            pollDelay = Math.max(minDelay, pollDelay * 0.8);
            
            // Auto-scroll to bottom during streaming
            setTimeout(() => {
              if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
              }
            }, 10);
          } else {
            // No new content - grow delay to reduce polling frequency
            pollDelay = Math.min(maxDelay, pollDelay * 1.2);
          }

          if (chunkData.error) {
            throw new Error(chunkData.error);
          }

          // Adaptive delay before next poll
          if (!done) {
            await new Promise(resolve => setTimeout(resolve, pollDelay));
          }

        } catch (pollError) {
          // Break the loop if stream is not found (404 error)
          const errorMessage = pollError instanceof Error ? pollError.message : String(pollError);
          if (errorMessage.includes('404') || errorMessage.includes('not found')) {
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to get response from AI assistant",
        variant: "destructive",
      });
      
      // Update the last assistant message with error
      setMessages(prev => {
        const updated = [...prev];
        for (let i = updated.length - 1; i >= 0; i--) {
          if (updated[i].role === "assistant") {
            updated[i] = { ...updated[i], content: "Error loading response. Please try again." };
            break;
          }
        }
        return updated;
      });
    } finally {
      setIsStreaming(false);
      currentStreamIdRef.current = "";
    }
  };

  /* -----------------------------------------------------------
   * Trigger the assistant *only when we actually have an answer*,
   * or when the question itself changes.
   * --------------------------------------------------------- */
  useEffect(() => {
    const isNewQuestion = questionVersionId !== prevQuestionIdRef.current;
    if (isNewQuestion && chosenAnswer) {
      // Start fresh with initial assistant message
      setMessages([{
        id: "initial-response",
        content: "",
        role: "assistant"
      }]);
      setHasInitialResponse(false);
      abortControllerRef.current?.abort?.();
      abortControllerRef.current = null;
      prevQuestionIdRef.current = questionVersionId;
      loadAiResponse();                       // kick off first answer
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionVersionId, chosenAnswer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      // Abort any active stream on server
      if (currentStreamIdRef.current) {
        fetch(`/api/chatbot/stream-abort/${currentStreamIdRef.current}`, {
          method: 'POST',
          credentials: 'include',
        }).catch(() => {
          // Ignore abort errors
        });
      }
    };
  }, []);

  const handleSendMessage = () => {
    const msg = userInput.trim();
    if (!msg || isStreaming) return;
    
    setUserInput("");

    // Add user message and AI placeholder in sequence
    setMessages(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        content: msg,
        role: "user"
      },
      {
        id: (Date.now() + 1).toString(),
        content: "Loading response...",
        role: "assistant"
      }
    ]);
    
    loadAiResponse(msg);  // stream the assistant's reply
    
    // Auto-scroll after adding user message
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      }
    }, 100);
  };


  return (
    <div className="w-full h-full bg-gray-50 dark:bg-gray-900">
      <div className="p-3 md:p-4 h-full flex flex-col bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center mb-3">
          <Bot className="h-5 w-5 text-primary mr-2" />
          <span className="font-medium text-foreground text-base">AI Assistant</span>
        </div>

        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto mb-2 min-h-0 bg-transparent" 
        >
          <div className="space-y-3 p-2">
            {/* Show placeholder when no messages */}
            {messages.length === 0 && (
              <div className="flex w-full justify-center items-center min-h-[200px]">
                <div className="text-muted-foreground text-sm">
                  Answer the question to see AI explanation
                </div>
              </div>
            )}
            {/* All conversation messages */}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex w-full ${message.role === "assistant" ? "justify-start" : "justify-end"}`}
              >
                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm break-words ${
                  message.role === "assistant"
                    ? "bg-gray-100 dark:bg-gray-800 text-foreground rounded-tl-none min-h-[100px]"
                    : "bg-primary text-primary-foreground rounded-tr-none"
                }`}>
                  <div className="flex items-start gap-2">
                    {message.role === "assistant" && (
                      <Bot className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                    )}
                    <div className="flex-1 min-w-0">
                      {message.role === "assistant" && !message.content && (
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      )}
                      {message.content && <HtmlLinkRenderer content={message.content} />}
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
            className="flex-1 text-sm min-w-0 h-11 border-2 border-border hover:border-primary/50 focus-visible:border-primary focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!userInput.trim() || isStreaming}
            size="sm"
            className="flex-shrink-0 h-11 px-6"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}