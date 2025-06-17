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
      console.error("Chat error:", error.message);
      toast({
        title: "Error",
        description: "Failed to get response from AI assistant",
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
      <CardContent className="p-2 sm:p-3 md:p-4 lg:p-5 xl:p-6 2xl:p-8 h-full flex flex-col">
        <div className="flex items-center mb-2 sm:mb-3 md:mb-4">
          <Bot className="h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5 lg:h-6 lg:w-6 text-primary mr-1 sm:mr-2 md:mr-3" />
          <span className="font-medium text-foreground text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl">AI Assistant</span>
        </div>

        <div className="space-y-1.5 sm:space-y-2 md:space-y-3 lg:space-y-4 flex-1 overflow-y-auto scrollbar-thin mb-2 sm:mb-3 md:mb-4 pr-1 sm:pr-2 min-h-0">
          {chatMutation.isPending && messages.length === 0 && (
            <div className="flex items-center justify-center h-full min-h-[80px] sm:min-h-[100px] md:min-h-[120px] lg:min-h-[140px]">
              <div className="flex items-center space-x-1 sm:space-x-2 md:space-x-3">
                <Bot className="h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5 animate-pulse text-primary" />
                <span className="text-xs sm:text-sm md:text-base lg:text-lg text-muted-foreground">Assistant is thinking...</span>
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
                  "max-w-[90%] sm:max-w-[85%] md:max-w-[80%] lg:max-w-[75%] xl:max-w-[70%] rounded-lg px-2 sm:px-3 md:px-4 lg:px-5 py-1.5 sm:py-2 md:py-3 lg:py-4 text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl break-words",
                  message.role === "assistant"
                    ? "bg-muted text-foreground rounded-tl-none"
                    : "bg-primary text-primary-foreground rounded-tr-none"
                )}
              >
                <div className="flex items-start gap-1 sm:gap-2 md:gap-3">
                  {message.role === "assistant" && (
                    <Bot className="h-2.5 w-2.5 sm:h-3 sm:w-3 md:h-4 md:w-4 lg:h-5 lg:w-5 mt-0.5 sm:mt-1 md:mt-1.5 flex-shrink-0 text-primary" />
                  )}
                  <p className="whitespace-pre-wrap leading-relaxed flex-1 min-w-0">{message.content}</p>
                </div>
              </div>
            </div>
          ))}

          {chatMutation.isPending && messages.length > 0 && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg rounded-tl-none px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-3 max-w-[90%] sm:max-w-[85%] md:max-w-[80%]">
                <div className="flex items-center space-x-1 sm:space-x-2 md:space-x-3">
                  <Bot className="h-2.5 w-2.5 sm:h-3 sm:w-3 md:h-4 md:w-4 animate-pulse text-primary" />
                  <span className="text-xs sm:text-sm md:text-base lg:text-lg text-muted-foreground">Typing...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex space-x-1 sm:space-x-2 md:space-x-3 flex-shrink-0">
          <Input
            placeholder="Ask a follow-up question..."
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1 text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl min-w-0 h-8 sm:h-9 md:h-10 lg:h-11 xl:h-12"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!userInput.trim() || chatMutation.isPending}
            size="sm"
            className="flex-shrink-0 h-8 sm:h-9 md:h-10 lg:h-11 xl:h-12 px-2 sm:px-3 md:px-4"
          >
            <Send className="h-2.5 w-2.5 sm:h-3 sm:w-3 md:h-4 md:w-4 lg:h-5 lg:w-5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
