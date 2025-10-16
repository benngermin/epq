import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Send, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { HtmlLinkRenderer } from "@/components/html-link-renderer";
import { FeedbackButtons } from "@/components/feedback-buttons";
import { useSSEStream } from "@/hooks/use-sse-stream";

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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const currentMessageIdRef = useRef<string>("");
  const prevQuestionIdRef = useRef<number | undefined>(undefined);

  // Set up SSE streaming hook
  const { isStreaming, startStream, stopStream } = useSSEStream({
    onChunk: (content) => {
      // Update message with ID matching currentMessageIdRef
      // content is already full accumulated response
      setMessages(prev => prev.map(msg =>
        msg.id === currentMessageIdRef.current && msg.role === "assistant"
          ? { ...msg, content: content }
          : msg
      ));
      
      // Auto-scroll to bottom when new content arrives
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
      });
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
    
    /* Guard against accidental empty submissions */
    const finalChosenAnswer = originalChosenAnswerRef.current || chosenAnswer || "";
    // Check for both empty and whitespace-only strings
    if ((!finalChosenAnswer || finalChosenAnswer.trim() === "") && !userMessage) {
      console.log('Skipping AI response - no answer provided');
      return;
    }
    
    // Generate unique ID for this streaming message
    const messageId = Date.now().toString() + '_' + Math.random().toString(36).substring(2, 9);
    currentMessageIdRef.current = messageId;
    
    // Add placeholder message to state with ID
    setMessages(prev => [{
      id: messageId,
      role: "assistant",
      content: "",
      questionVersionId
    }, ...prev]);
    
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
      
      // Stop any ongoing SSE stream
      stopStream();
      
      prevQuestionIdRef.current = questionVersionId;
      
      // If we have a chosen answer for the new question, start loading AI response
      // Make sure chosenAnswer is not just an empty string
      if (chosenAnswer && chosenAnswer.trim() !== "") {
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