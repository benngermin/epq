import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Send, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { HtmlLinkRenderer } from "@/components/html-link-renderer";
import { FeedbackButtons } from "@/components/feedback-buttons";

interface SimpleStreamingChatProps {
  questionVersionId: number;
  chosenAnswer: string;
  correctAnswer: string;
  onReviewQuestion?: () => void;
}

export function SimpleStreamingChat({ questionVersionId, chosenAnswer, correctAnswer, onReviewQuestion }: SimpleStreamingChatProps) {
  // Store the original chosen answer to use for follow-up questions
  const originalChosenAnswerRef = useRef(chosenAnswer);
  const [userInput, setUserInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [messages, setMessages] = useState<Array<{id: string, content: string, role: "user" | "assistant", questionVersionId?: number}>>([]);
  const [hasInitialResponse, setHasInitialResponse] = useState(false);
  // Store server conversation history to maintain system message context
  const [serverConversationHistory, setServerConversationHistory] = useState<Array<{role: string, content: string}> | null>(null);

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

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const loadAiResponse = async (userMessage?: string) => {
    // Prevent concurrent requests
    if (isStreaming) {
      console.log('Request already in progress, skipping');
      return;
    }
    
    // Cancel any ongoing requests with a reason
    if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
      abortControllerRef.current.abort(new DOMException('Starting new request', 'AbortError'));
      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();
    
    /* Guard against accidental empty submissions */
    const finalChosenAnswer = originalChosenAnswerRef.current || chosenAnswer || "";
    if (!finalChosenAnswer && !userMessage) {
      return;
    }
    
    setIsStreaming(true);
    
    // Detect if screen is mobile (less than 768px)
    const isMobile = window.innerWidth < 768;
    
    // Check if we're in demo mode
    const isDemo = window.location.pathname.startsWith('/demo');
    
    try {
      // Initialize streaming - pass server conversation history for follow-up messages
      // Use server conversation history if available (for follow-ups), otherwise undefined (for initial)
      const conversationToSend = userMessage && serverConversationHistory ? serverConversationHistory : undefined;
      
      // Debug logging for conversation history
      if (userMessage && serverConversationHistory) {
        console.log("=== CLIENT CONVERSATION HISTORY ===");
        console.log("Current Question Version ID:", questionVersionId);
        console.log("Server conversation history length:", serverConversationHistory.length);
        console.log("Conversation roles:", serverConversationHistory.map(m => m.role));
        console.log("Has system message:", serverConversationHistory.some(m => m.role === "system"));
        console.log("===================================");
      }
      
      const response = await fetch(isDemo ? '/api/demo/chatbot/stream-init' : '/api/chatbot/stream-init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          questionVersionId, 
          chosenAnswer: finalChosenAnswer, 
          userMessage, 
          isMobile,
          conversationHistory: conversationToSend // Pass server conversation history for follow-ups
        }),
        credentials: 'include',
        signal: abortControllerRef.current.signal,
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
      let retries = 0; // Add retry counter
      
      while (!done && !(abortControllerRef.current?.signal?.aborted ?? false)) {
        try {
          const chunkResponse = await fetch(isDemo ? `/api/demo/chatbot/stream-chunk/${streamId}?cursor=${cursor}` : `/api/chatbot/stream-chunk/${streamId}?cursor=${cursor}`, {
            credentials: 'include',
            signal: abortControllerRef.current?.signal,
          });

          if (!chunkResponse.ok) {
            if (chunkResponse.status === 404) {
              // Stream not found - likely cleaned up
              break;
            }
            // For other errors, retry with backoff
            retries++;
            if (retries > 10) {
              throw new Error('Failed to fetch stream after multiple retries');
            }
            await new Promise(resolve => setTimeout(resolve, Math.min(500 * retries, 3000)));
            continue;
          }
          
          // Reset retries on successful response
          retries = 0;

          const chunkData = await chunkResponse.json();
          
          if (chunkData.done) {
            // Make sure to update with final content before marking as done
            if (chunkData.content && chunkData.content.length > accumulatedContent.length) {
              accumulatedContent = chunkData.content;
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
            }
            
            // Store the server's conversation history for future follow-ups
            if (chunkData.conversationHistory && !chunkData.error) {
              setServerConversationHistory(chunkData.conversationHistory);
              console.log("Stored server conversation history with", chunkData.conversationHistory.length, "messages");
            }
            
            done = true;
            break;
          }
          
          if (chunkData.content) {
            // Always use the full content from server, don't rely on accumulation
            const serverContent = chunkData.content;
            
            if (serverContent.length > accumulatedContent.length) {
              // New content available
              accumulatedContent = serverContent;
              cursor = serverContent.length;
              
              // Update the last assistant message with full server content
              setMessages(prev => {
                const updated = [...prev];
                for (let i = updated.length - 1; i >= 0; i--) {
                  if (updated[i].role === "assistant") {
                    updated[i] = { ...updated[i], content: serverContent };
                    break;
                  }
                }
                return updated;
              });
              
              // Auto-scroll to bottom when new content arrives
              requestAnimationFrame(() => {
                if (scrollContainerRef.current) {
                  scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
                }
              });
            }
            
            // Mark initial response as received if this is the first response
            if (!userMessage && !hasInitialResponse) {
              setHasInitialResponse(true);
            }
            
            // Shrink delay when we get new content (faster polling for active streams)
            pollDelay = Math.max(minDelay, pollDelay * 0.8);
            

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
          // Break the loop if stream is not found (404 error) or aborted
          const errorMessage = pollError instanceof Error ? pollError.message : String(pollError);
          if (errorMessage.includes('404') || errorMessage.includes('not found') || errorMessage.includes('aborted')) {
            break;
          }
          // Don't retry if aborted
          if (abortControllerRef.current?.signal?.aborted) {
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
    } catch (error: any) {
      // Clean up abort controller reference
      if (abortControllerRef.current?.signal.aborted) {
        abortControllerRef.current = null;
      }
      
      // Don't show error toast for aborted requests
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        return;
      }
      
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
      // Ensure abort controller is cleaned up
      if (abortControllerRef.current?.signal.aborted) {
        abortControllerRef.current = null;
      }
    }
  };

  /* -----------------------------------------------------------
   * Trigger the assistant *only when we actually have an answer*,
   * or when the question itself changes.
   * --------------------------------------------------------- */
  useEffect(() => {
    const isNewQuestion = questionVersionId !== prevQuestionIdRef.current;
    
    if (isNewQuestion) {
      // Question changed - always clear messages and server history to prevent contamination
      setMessages([]);
      setHasInitialResponse(false);
      setUserInput(""); // Also clear any pending user input
      setServerConversationHistory(null); // Clear server conversation history
      
      // Abort any ongoing request with a simple reason
      if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
        try {
          // Provide a simple string reason to avoid "aborted without reason" error
          abortControllerRef.current.abort("Question changed");
        } catch (e) {
          // Ignore abort errors
        }
      }
      abortControllerRef.current = null;
      prevQuestionIdRef.current = questionVersionId;
      
      // If we have a chosen answer for the new question, start loading AI response
      if (chosenAnswer) {
        // Start fresh with initial assistant message
        setMessages([{
          id: "initial-response",
          content: "",
          role: "assistant",
          questionVersionId: questionVersionId
        }]);
        loadAiResponse();                       // kick off first answer
        
        // Auto-scroll when initial message is added
        requestAnimationFrame(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
          }
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionVersionId, chosenAnswer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
        initTimeoutRef.current = null;
      }
      if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
        // Simply abort with a reason to prevent "aborted without reason" errors
        try {
          abortControllerRef.current.abort("Component unmounting");
        } catch (e) {
          // Ignore abort errors
        }
        abortControllerRef.current = null;
      }
      // Abort any active stream on server
      if (currentStreamIdRef.current) {
        const streamId = currentStreamIdRef.current;
        currentStreamIdRef.current = "";
        const isDemo = window.location.pathname.startsWith('/demo');
        fetch(isDemo ? `/api/demo/chatbot/stream-abort/${streamId}` : `/api/chatbot/stream-abort/${streamId}`, {
          method: 'POST',
          credentials: 'include',
        }).catch(() => {
          // Ignore abort errors on cleanup
        });
      }
    };
  }, []);

  const handleSendMessage = () => {
    const msg = userInput.trim();
    if (!msg) return;
    
    // Double check streaming state to prevent race conditions
    if (isStreaming) {
      console.log('Cannot send message while streaming');
      return;
    }
    
    setUserInput("");

    // Add user message and AI placeholder in sequence
    setMessages(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        content: msg,
        role: "user",
        questionVersionId: questionVersionId
      },
      {
        id: (Date.now() + 1).toString(),
        content: "Loading response...",
        role: "assistant",
        questionVersionId: questionVersionId
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
    <div className="w-full h-full flex flex-col bg-gray-50 dark:bg-gray-900 relative">
      {/* Messages area - scrollable with padding for footer */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-y-auto"
      >
        <div className="p-4 space-y-3 pb-4">
          {/* Show placeholder when no messages */}
          {messages.length === 0 && (
            <div className="flex w-full justify-center items-center min-h-[200px]">
              <div className="text-muted-foreground text-sm">
                Answer the question to see AI explanation
              </div>
            </div>
          )}
          {/* All conversation messages */}
          {messages.map((message, index) => (
            <div
              key={message.id}
              className={`flex w-full ${message.role === "assistant" ? "justify-start" : "justify-end"}`}
            >
              <div className={message.role === "assistant" ? "w-[98%]" : "max-w-[85%]"}>
                <div className={`rounded-lg px-3 py-2 text-base break-words ${
                  message.role === "assistant"
                    ? "bg-gray-100 dark:bg-gray-800 text-foreground rounded-tl-none"
                    : "bg-primary text-primary-foreground rounded-tr-none"
                }`}>
                  <div className="flex items-start gap-2">
                    {message.role === "assistant" && (
                      <Bot className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                    )}
                    <div className="flex-1 min-w-0">
                      {message.role === "assistant" && !message.content && (
                        <div className="flex items-center justify-center space-x-2 py-2">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      )}
                      {message.content && <HtmlLinkRenderer content={message.content} />}
                    </div>
                  </div>
                </div>
                {/* Add feedback buttons for assistant messages with content */}
                {message.role === "assistant" && message.content && !isStreaming && (
                  <FeedbackButtons 
                    messageId={message.id} 
                    questionVersionId={questionVersionId}
                    conversation={messages}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer with composer and Review Question button */}
      <div className="sticky bottom-0 bg-white dark:bg-gray-950 border-t z-10">
        <div className="p-3 md:p-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] space-y-2">
          <div className="flex space-x-2">
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
              className="flex-1 text-base min-w-0 h-11 border-2 border-border hover:border-primary/50 focus-visible:border-primary focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors"
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
          {onReviewQuestion && (
            <Button 
              onClick={onReviewQuestion} 
              variant="outline" 
              className="w-full py-2 md:py-3 text-sm md:text-base border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Review Question
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}