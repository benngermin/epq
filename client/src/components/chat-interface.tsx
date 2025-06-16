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
      setMessages(prev => [...prev, { role: "assistant", content: data.response }]);
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
    setMessages(prev => [...prev, newUserMessage]);
    
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
    <Card className="bg-background border">
      <CardContent className="p-4">
        <div className="flex items-center mb-4">
          <Bot className="h-5 w-5 text-primary mr-2" />
          <span className="font-medium text-foreground">AI Assistant</span>
        </div>

        <div className="space-y-4 h-[60vh] sm:h-80 lg:h-[60vh] overflow-y-auto mb-4 pr-2" style={{ scrollbarWidth: 'thin' }}>
          {chatMutation.isPending && messages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <div className="flex items-center space-x-2">
                <Bot className="h-4 w-4 animate-pulse text-primary" />
                <span className="text-sm text-muted-foreground">Assistant is thinking...</span>
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={cn(
                "flex w-full",
                message.role === "assistant" ? "justify-start" : "justify-end"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-lg px-4 py-3 text-base",
                  message.role === "assistant"
                    ? "bg-muted text-foreground rounded-tl-none"
                    : "bg-primary text-primary-foreground rounded-tr-none"
                )}
              >
                <div className="flex items-start gap-2">
                  {message.role === "assistant" && (
                    <Bot className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                  )}
                  <p className="whitespace-pre-wrap leading-relaxed flex-1">{message.content}</p>
                </div>
              </div>
            </div>
          ))}

          {chatMutation.isPending && messages.length > 0 && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg rounded-tl-none px-3 py-2 max-w-[85%]">
                <div className="flex items-center space-x-2">
                  <Bot className="h-4 w-4 animate-pulse text-primary" />
                  <span className="text-sm text-muted-foreground">Typing...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex space-x-2">
          <Input
            placeholder="Ask a follow-up question..."
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!userInput.trim() || chatMutation.isPending}
            size="sm"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
