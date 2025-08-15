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
      const response = await fetch(`/api/admin/logs/feedback/${feedbackId}`);
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
    // Simple HTML-like link rendering if needed
    return content.split('\n').map((line, i) => (
      <div key={i} className="mb-1">
        {line || '\u00A0'}
      </div>
    ));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Conversation View</span>
            {feedback && (
              <div className="flex items-center gap-2">
                <Badge variant={feedback.feedbackType === "positive" ? "default" : "destructive"}>
                  {feedback.feedbackType}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {format(new Date(feedback.createdAt), "MMM dd, yyyy h:mm a")}
                </span>
              </div>
            )}
          </DialogTitle>
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
          <div className="flex-1 flex flex-col gap-4 overflow-hidden">
            {/* User Info */}
            <div className="bg-muted/50 rounded-lg p-3">
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
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-3">
                {feedback.conversation && feedback.conversation.length > 0 ? (
                  feedback.conversation.map((message) => {
                    const isFlagged = message.id === messageId;
                    return (
                      <div
                        key={message.id}
                        className={`flex ${message.role === "assistant" ? "justify-start" : "justify-end"}`}
                      >
                        <div className={`max-w-[85%] ${isFlagged ? "ring-2 ring-offset-2" : ""} ${
                          isFlagged && feedback.feedbackType === "positive" 
                            ? "ring-green-500" 
                            : isFlagged 
                            ? "ring-red-500" 
                            : ""
                        }`}>
                          <div className={`rounded-lg px-4 py-3 ${
                            message.role === "assistant"
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
                              <div className="flex-1 text-sm">
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