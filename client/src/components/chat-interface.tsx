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
}

export function ChatInterface({ questionVersionId, chosenAnswer, correctAnswer }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState("");
  const { toast } = useToast();
  const hasInitialized = useRef<string | null>(null);

  const chatMutation = useMutation({
    mutationFn: async (userMessage?: string) => {
      const res = await apiRequest("POST", "/api/chatbot", {
        questionVersionId,
        chosenAnswer,
        userMessage,
      });
      return await res.json();
    },
    onSuccess: (data) => {
      setMessages(prev => [{ role: "assistant", content: data.response }, ...prev]);
    },
    onError: (error: Error) => {
      toast({
        title: "Chat error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Get initial explanation when component mounts or question changes
  useEffect(() => {
    const currentKey = `${questionVersionId}-${chosenAnswer}-${correctAnswer}`;
    if (hasInitialized.current !== currentKey) {
      hasInitialized.current = currentKey;
      setMessages([]); // Clear previous messages
      chatMutation.mutate(undefined);
    }
  }, [questionVersionId, chosenAnswer, correctAnswer]);

  const handleSendMessage = () => {
    if (!userInput.trim()) return;

    const newUserMessage = { role: "user" as const, content: userInput };
    setMessages(prev => [newUserMessage, ...prev]);
    
    chatMutation.mutate(userInput);
    setUserInput("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Card className="bg-background w-full h-full">
      <CardContent className="p-3 sm:p-4 lg:p-6 h-full flex flex-col">
        <div className="flex items-center mb-3 sm:mb-4">
          <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-primary mr-2" />
          <span className="font-medium text-foreground text-sm sm:text-base">AI Assistant</span>
        </div>

        <div className="space-y-2 sm:space-y-3 flex-1 overflow-y-auto mb-3 sm:mb-4 pr-1 sm:pr-2 min-h-0" style={{ scrollbarWidth: 'thin' }}>
          {chatMutation.isPending && messages.length === 0 && (
            <div className="flex items-center justify-center h-full min-h-[120px]">
              <div className="flex items-center space-x-2">
                <Bot className="h-4 w-4 animate-pulse text-primary" />
                <span className="text-xs sm:text-sm text-muted-foreground">Assistant is thinking...</span>
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
                  "max-w-[90%] sm:max-w-[85%] rounded-lg px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base break-words",
                  message.role === "assistant"
                    ? "bg-muted text-foreground rounded-tl-none"
                    : "bg-primary text-primary-foreground rounded-tr-none"
                )}
              >
                <div className="flex items-start gap-1 sm:gap-2">
                  {message.role === "assistant" && (
                    <Bot className="h-3 w-3 sm:h-4 sm:w-4 mt-0.5 sm:mt-1 flex-shrink-0 text-primary" />
                  )}
                  <p className="whitespace-pre-wrap leading-relaxed flex-1 min-w-0">{message.content}</p>
                </div>
              </div>
            </div>
          ))}

          {chatMutation.isPending && messages.length > 0 && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg rounded-tl-none px-3 py-2 max-w-[90%] sm:max-w-[85%]">
                <div className="flex items-center space-x-2">
                  <Bot className="h-3 w-3 sm:h-4 sm:w-4 animate-pulse text-primary" />
                  <span className="text-xs sm:text-sm text-muted-foreground">Typing...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex space-x-2 flex-shrink-0">
          <Input
            placeholder="Ask a follow-up question..."
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1 text-sm sm:text-base min-w-0"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!userInput.trim() || chatMutation.isPending}
            size="sm"
            className="flex-shrink-0"
          >
            <Send className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
