import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Bot, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { HtmlLinkRenderer } from "@/components/html-link-renderer";
import { useSSEStream } from "@/hooks/use-sse-stream";

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

interface ConversationMessage {
  role: "system" | "assistant" | "user";
  content: string;
}

export function ChatInterface({ questionVersionId, chosenAnswer, correctAnswer }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const [userInput, setUserInput] = useState("");
  const [hasRequestedInitial, setHasRequestedInitial] = useState(false);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentMessageIdRef = useRef<string>("");



  const currentQuestionKey = `${questionVersionId}-${chosenAnswer}-${correctAnswer}`;

  // Replace polling with SSE hook
  const { isStreaming, startStream, stopStream } = useSSEStream({
    onChunk: (content) => {
      setMessages(prev => prev.map(msg =>
        msg.id === currentMessageIdRef.current && msg.isStreaming
          ? { ...msg, content: msg.content + content }
          : msg
      ));
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 10);
    },
    onComplete: (newConversationHistory) => {
      setMessages(prev => prev.map(msg =>
        msg.id === currentMessageIdRef.current && msg.isStreaming
          ? { ...msg, isStreaming: false }
          : msg
      ));
      if (newConversationHistory) {
        setConversationHistory(newConversationHistory);
      }
      currentMessageIdRef.current = "";
    },
    onError: (error) => {
      setMessages(prev => prev.filter(msg => msg.id !== currentMessageIdRef.current));
      currentMessageIdRef.current = "";
      toast({
        title: "Error",
        description: "Failed to get response from AI assistant",
        variant: "destructive",
      });
    }
  });

  // Replace old streamChatResponse with new SSE version
  const streamChatResponse = async (userMessage?: string) => {
    if (isStreaming) return;

    const messageId = Date.now().toString() + '_' + Math.random().toString(36).substring(2, 9);
    currentMessageIdRef.current = messageId;

    setMessages(prev => [{
      role: "assistant",
      content: "",
      isStreaming: true,
      id: messageId
    }, ...prev]);
    
    await startStream(questionVersionId, chosenAnswer, userMessage, conversationHistory);
  };

  // Get initial explanation only once per question
  useEffect(() => {
    if (!hasRequestedInitial && !isStreaming) {
      setHasRequestedInitial(true);
      setMessages([]); // Clear previous messages
      
      // Use a delay to prevent multiple calls
      const timer = setTimeout(() => {
        if (!isStreaming) {
          streamChatResponse(undefined);
        }
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [currentQuestionKey]);

  // Reset when question changes
  useEffect(() => {
    // Stop any ongoing stream
    stopStream();
    
    // Reset messages, conversation history, and initial request flag
    setHasRequestedInitial(false);
    setMessages([]);
    setConversationHistory([]);
  }, [currentQuestionKey]);

  const handleSendMessage = () => {
    if (!userInput.trim() || isStreaming) return;

    const newUserMessage = { 
      role: "user" as const, 
      content: userInput, 
      id: Date.now().toString() + '_' + Math.random().toString(36).substring(2, 9)
    };
    setMessages(prev => [newUserMessage, ...prev]);
    
    // Store the user input for conversation history update
    const currentUserInput = userInput;
    streamChatResponse(currentUserInput);
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
        <div className="flex-1 overflow-y-auto mb-2 min-h-0">
          <div className="space-y-3 p-2 pt-4">

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
                      message.role === "assistant" 
                        ? "w-[98%] rounded-lg px-3 py-2 text-base break-words"
                        : "max-w-[85%] rounded-lg px-3 py-2 text-base break-words",
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
                        <HtmlLinkRenderer content={message.content} />
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
      </CardContent>
    </Card>
  );
}
