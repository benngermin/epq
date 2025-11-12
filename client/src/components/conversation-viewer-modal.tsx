import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Bot, User, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ConversationViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  feedbackId: number;
  messageId: string;
}

interface FeedbackWithConversation {
  id: number;
  userName: string;
  userEmail: string;
  feedbackType: string;
  feedbackMessage: string | null;
  messageId: string;
  conversation: Array<{
    id: string;
    content: string;
    role: "user" | "assistant";
  }> | null;
  createdAt: string;
}

export function ConversationViewerModal({
  isOpen,
  onClose,
  feedbackId,
  messageId,
}: ConversationViewerModalProps) {
  const [feedback, setFeedback] = useState<FeedbackWithConversation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && feedbackId) {
      fetchFeedback();
    }
  }, [isOpen, feedbackId]);

  const fetchFeedback = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/metrics/feedback/${feedbackId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch conversation");
      }
      const data = await response.json();
      setFeedback(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const renderMessageContent = (content: string) => {
    // Process HTML tags and convert to React elements
    // Handle basic HTML tags like <ul>, <li>, <b>, <i>, etc.
    const processHtml = (text: string) => {
      // Replace HTML entities
      text = text
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      
      // Simple HTML to JSX conversion
      // Handle nested tags by replacing them with markdown-like syntax first
      text = text
        .replace(/<b>(.*?)<\/b>/g, '**$1**')
        .replace(/<i>(.*?)<\/i>/g, '*$1*')
        .replace(/<ul>/g, '\n')
        .replace(/<\/ul>/g, '')
        .replace(/<li>/g, '• ')
        .replace(/<\/li>/g, '\n')
        .replace(/<br\s*\/?>/g, '\n')
        .replace(/<p>/g, '')
        .replace(/<\/p>/g, '\n\n');
      
      return text;
    };
    
    const processed = processHtml(content);
    
    return (
      <div className="whitespace-pre-wrap break-words">
        {processed.split('\n').map((line, i) => {
          // Handle bold text
          const parts = line.split(/\*\*(.*?)\*\*/g);
          return (
            <div key={i} className="mb-1">
              {parts.map((part, j) => {
                if (j % 2 === 1) {
                  return <strong key={j}>{part}</strong>;
                }
                // Handle italic text
                const italicParts = part.split(/\*(.*?)\*/g);
                return italicParts.map((italicPart, k) => {
                  if (k % 2 === 1) {
                    return <em key={`${j}-${k}`}>{italicPart}</em>;
                  }
                  return <span key={`${j}-${k}`}>{italicPart || '\u00A0'}</span>;
                });
              })}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            <span>Conversation View</span>
          </DialogTitle>
          {feedback && (
            <div className="flex items-center gap-2 mt-2">
              <Badge variant={feedback.feedbackType === "positive" ? "default" : "destructive"}>
                {feedback.feedbackType}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {format(new Date(feedback.createdAt), "MMM dd, yyyy h:mm a")}
              </span>
            </div>
          )}
        </DialogHeader>

        {loading && (
          <div className="space-y-4 p-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {feedback && !loading && (
          <div className="flex flex-col gap-4 flex-1 min-h-0">
            {/* User Info */}
            <div className="bg-muted/50 rounded-lg p-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{feedback.userName}</span>
                <span className="text-sm text-muted-foreground">({feedback.userEmail})</span>
              </div>
              {feedback.feedbackMessage && (
                <div className="mt-2 text-sm">
                  <span className="font-medium">Feedback: </span>
                  {feedback.feedbackMessage}
                </div>
              )}
            </div>

            {/* Conversation */}
            <ScrollArea className="flex-1 overflow-auto">
              <div className="space-y-3 pr-4 pb-4">
                {feedback.conversation && feedback.conversation.length > 0 ? (
                  feedback.conversation.map((message) => {
                    const isFlagged = message.id === messageId;
                    return (
                      <div
                        key={message.id}
                        className={`flex ${message.role === "assistant" ? "justify-start" : "justify-end"}`}
                      >
                        <div className="max-w-[85%]">
                          <div className={`rounded-lg px-4 py-3 ${
                            isFlagged 
                              ? "bg-yellow-100 dark:bg-yellow-900/30"
                              : message.role === "assistant"
                              ? "bg-muted"
                              : "bg-primary text-primary-foreground"
                          }`}>
                            <div className="flex items-start gap-2">
                              {message.role === "assistant" && (
                                <Bot className="h-4 w-4 mt-0.5 flex-shrink-0" />
                              )}
                              {message.role === "user" && (
                                <User className="h-4 w-4 mt-0.5 flex-shrink-0" />
                              )}
                              <div className="flex-1 text-sm overflow-hidden">
                                {renderMessageContent(message.content)}
                              </div>
                            </div>
                          </div>
                          {isFlagged && (
                            <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              This message received {feedback.feedbackType} feedback
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No conversation data available</p>
                    <p className="text-sm mt-2">This feedback was submitted before conversation tracking was enabled.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}