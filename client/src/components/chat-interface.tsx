import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Bot, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

  // Get initial explanation when component mounts
  useState(() => {
    chatMutation.mutate();
  });

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
    <Card className="bg-muted/30">
      <CardContent className="p-6">
        <div className="flex items-center mb-4">
          <Bot className="h-5 w-5 text-primary mr-2" />
          <span className="font-medium text-foreground">AI Tutor</span>
        </div>

        <div className="space-y-3 h-64 overflow-y-auto mb-4">
          {chatMutation.isPending && messages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <div className="flex items-center space-x-2">
                <Bot className="h-4 w-4 animate-pulse text-primary" />
                <span className="text-sm text-muted-foreground">AI is thinking...</span>
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={cn(
                "p-3 rounded-lg shadow-sm max-w-[90%]",
                message.role === "assistant" 
                  ? "bg-card text-foreground mr-auto" 
                  : "bg-primary text-primary-foreground ml-auto"
              )}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            </div>
          ))}

          {chatMutation.isPending && messages.length > 0 && (
            <div className="bg-card p-3 rounded-lg shadow-sm mr-auto max-w-[90%]">
              <div className="flex items-center space-x-2">
                <Bot className="h-4 w-4 animate-pulse text-primary" />
                <span className="text-sm text-muted-foreground">Typing...</span>
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
