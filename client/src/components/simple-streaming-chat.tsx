import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Send, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { HtmlLinkRenderer } from "@/components/html-link-renderer";
import { FeedbackButtons } from "@/components/feedback-buttons";
import { useSSEStream } from "@/hooks/use-sse-stream";
import { useLocation } from "wouter";
import { useKeyboardHeight } from "@/hooks/use-keyboard-height";
import { useIsMobile } from "@/hooks/use-mobile";

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
  const [messages, setMessages] = useState<Array<{id: string, content: string, role: "user" | "assistant", questionVersionId?: number}>>([]);
  const [hasInitialResponse, setHasInitialResponse] = useState(false);
  // Store server conversation history to maintain system message context
  const [serverConversationHistory, setServerConversationHistory] = useState<Array<{role: string, content: string}> | null>(null);

  const { toast } = useToast();
  const [location] = useLocation();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const currentMessageIdRef = useRef<string>("");
  const prevQuestionIdRef = useRef<number | undefined>(undefined);
  
  // Check if we're on mobile view
  const isMobileView = location.startsWith("/mobile-view");
  const isMobile = useIsMobile();
  const { isVisible: isKeyboardVisible, height: keyboardHeight } = useKeyboardHeight();

  // Set up SSE streaming hook
  const { isStreaming, startStream, stopStream } = useSSEStream({
    onChunk: (content) => {
      // Update message with ID matching currentMessageIdRef
      // content is already full accumulated response
      setMessages(prev => {
        const updatedMessages = prev.map(msg =>
          msg.id === currentMessageIdRef.current && msg.role === "assistant"
            ? { ...msg, content: content }
            : msg
        );
        
        // Debug: Check if we found and updated the message
        const foundMessage = updatedMessages.find(msg => msg.id === currentMessageIdRef.current);
        if (!foundMessage) {
          console.error('Could not find message to update with ID:', currentMessageIdRef.current);
          console.log('Current messages:', prev.map(m => ({ id: m.id, role: m.role })));
        }
        
        return updatedMessages;
      });
      
      // Auto-scroll to bottom when new content arrives (disabled on mobile view)
      if (!isMobileView) {
        requestAnimationFrame(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
          }
        });
      }
    },
    onComplete: (history) => {
      // Mark message complete, update conversation history
      setServerConversationHistory(history);
      console.log("Stored server conversation history with", history.length, "messages");
      
      // Mark initial response as received if this is the first response
      if (!hasInitialResponse) {
        setHasInitialResponse(true);
      }
    },
    onError: (error) => {
      // Remove message, show toast
      setMessages(prev => prev.filter(msg => msg.id !== currentMessageIdRef.current));
      toast({
        variant: "destructive",
        title: "Error",
        description: error || "Failed to get AI response"
      });
    }
  });

  // Keep a *stable* reference to the learner's first submitted answer
  useEffect(() => {
    if (chosenAnswer) {
      originalChosenAnswerRef.current = chosenAnswer;
    }
  }, [chosenAnswer]);

  // Auto-scroll to bottom when messages change (disabled on mobile view)
  useEffect(() => {
    if (!isMobileView && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, isMobileView]);

  const loadAiResponse = async (userMessage?: string, existingMessageId?: string) => {
    // Prevent concurrent requests
    if (isStreaming) {
      console.log('Request already in progress, skipping');
      return;
    }
    
    /* Guard against accidental empty submissions */
    const finalChosenAnswer = originalChosenAnswerRef.current || chosenAnswer || "";
    // Check for both empty and whitespace-only strings
    if ((!finalChosenAnswer || finalChosenAnswer.trim() === "") && !userMessage) {
      console.log('Skipping AI response - no answer provided');
      return;
    }
    
    // Use existing message ID if provided (for follow-ups), otherwise generate new one
    const messageId = existingMessageId || (Date.now().toString() + '_' + Math.random().toString(36).substring(2, 9));
    currentMessageIdRef.current = messageId;
    
    console.log('LoadAiResponse called:', {
      userMessage,
      existingMessageId,
      messageId,
      currentMessagesCount: messages.length,
      isFollowUp: !!existingMessageId
    });
    
    // Only add placeholder message if we don't have an existing one (initial response)
    if (!existingMessageId) {
      // Append message to the end for proper chronological order
      setMessages(prev => {
        console.log('Adding new assistant placeholder, current messages:', prev.length);
        return [...prev, {
          id: messageId,
          role: "assistant",
          content: "",
          questionVersionId
        }];
      });
    } else {
      console.log('Using existing message ID, not adding new placeholder');
    }
    
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
    
    // Start SSE stream
    await startStream(questionVersionId, finalChosenAnswer, userMessage, conversationToSend);
  };

  /* -----------------------------------------------------------
   * Trigger the assistant when:
   * 1. Component mounts with a chosenAnswer (initial mount)
   * 2. Question changes with a chosenAnswer
   * 3. chosenAnswer changes from empty to non-empty
   * --------------------------------------------------------- */
  useEffect(() => {
    const isNewQuestion = questionVersionId !== prevQuestionIdRef.current;
    const hasAnswer = chosenAnswer && chosenAnswer.trim() !== "";
    
    // Skip if we're already streaming or have an initial response for this question
    if (isStreaming || (hasInitialResponse && !isNewQuestion)) {
      return;
    }
    
    // If question changed, clear previous state
    if (isNewQuestion && prevQuestionIdRef.current !== undefined) {
      console.log('Question changed, clearing previous state');
      setMessages([]);
      setHasInitialResponse(false);
      setUserInput("");
      setServerConversationHistory(null);
      stopStream();
    }
    
    // Update the previous question ID
    prevQuestionIdRef.current = questionVersionId;
    
    // Start loading AI response if we have an answer and haven't requested it yet
    if (hasAnswer && !hasInitialResponse && messages.length === 0) {
      console.log('Triggering initial AI response for question', questionVersionId);
      // Add a small delay to prevent race conditions
      const timer = setTimeout(() => {
        if (!isStreaming && !hasInitialResponse) {
          loadAiResponse();
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionVersionId, chosenAnswer, isStreaming, hasInitialResponse]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Stop any ongoing SSE stream when component unmounts
      stopStream();
    };
  }, [stopStream]);

  const handleSendMessage = () => {
    const msg = userInput.trim();
    if (!msg) return;
    
    // Double check streaming state to prevent race conditions
    if (isStreaming) {
      console.log('Cannot send message while streaming');
      return;
    }
    
    setUserInput("");

    // Generate IDs for both messages
    const userMessageId = Date.now().toString();
    const assistantMessageId = (Date.now() + 1).toString() + '_' + Math.random().toString(36).substring(2, 9);

    // Add user message and AI placeholder in sequence
    setMessages(prev => [
      ...prev,
      {
        id: userMessageId,
        content: msg,
        role: "user",
        questionVersionId: questionVersionId
      },
      {
        id: assistantMessageId,
        content: "",
        role: "assistant",
        questionVersionId: questionVersionId
      }
    ]);
    
    // Pass the assistant message ID to loadAiResponse so it updates the correct message
    loadAiResponse(msg, assistantMessageId);  // stream the assistant's reply
    
    // Auto-scroll after adding user message (disabled on mobile view)
    if (!isMobileView) {
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
      }, 100);
    }
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
      <div 
        className="sticky bottom-0 bg-white dark:bg-gray-950 border-t z-10"
        style={{
          // In mobile-view mode on mobile, adjust position when keyboard is visible
          ...(isMobileView && isMobile && isKeyboardVisible ? {
            bottom: `${keyboardHeight}px`,
            position: 'fixed' as const,
            left: 0,
            right: 0,
            transition: 'bottom 0.3s ease-in-out'
          } : {})
        }}
      >
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