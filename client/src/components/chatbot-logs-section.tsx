import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { Clock, User, Bot, Settings, MessageSquare, Zap } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

interface ChatbotLog {
  id: number;
  userId: number | null;
  modelName: string;
  systemMessage: string | null;
  userMessage: string;
  aiResponse: string;
  temperature: number;
  maxTokens: number;
  responseTime: number | null;
  createdAt: string;
}

export function ChatbotLogsSection() {
  const [expandedLog, setExpandedLog] = useState<number | null>(null);

  const { data: logs = [], isLoading } = useQuery<ChatbotLog[]>({
    queryKey: ['/api/admin/chatbot-logs'],
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Loading Chatbot Logs...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-20 bg-muted rounded-lg"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Chatbot Interaction Logs
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Total interactions: {logs.length}
        </p>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] pr-4">
          <div className="space-y-4">
            {logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No chatbot interactions logged yet</p>
              </div>
            ) : (
              logs.map((log: ChatbotLog) => (
                <Card key={log.id} className="border-l-4 border-l-primary/20">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {format(new Date(log.createdAt), 'MMM dd, yyyy HH:mm:ss')}
                        {log.userId && (
                          <>
                            <Separator orientation="vertical" className="h-4" />
                            <User className="h-4 w-4" />
                            User ID: {log.userId}
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {log.responseTime && (
                          <Badge variant="outline" className="text-xs">
                            <Zap className="h-3 w-3 mr-1" />
                            {log.responseTime}ms
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                        >
                          {expandedLog === log.id ? 'Collapse' : 'Expand'}
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm">
                      <Badge variant="secondary" className="font-mono">
                        <Bot className="h-3 w-3 mr-1" />
                        {log.modelName}
                      </Badge>
                      <Badge variant="outline">
                        <Settings className="h-3 w-3 mr-1" />
                        Temp: {log.temperature}%
                      </Badge>
                      <Badge variant="outline">
                        Max Tokens: {log.maxTokens}
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <User className="h-4 w-4" />
                        User Message
                      </h4>
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-sm whitespace-pre-wrap">
                          {log.userMessage.length > 200 && expandedLog !== log.id
                            ? `${log.userMessage.substring(0, 200)}...`
                            : log.userMessage}
                        </p>
                      </div>
                    </div>

                    {expandedLog === log.id && log.systemMessage && (
                      <div>
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                          <Settings className="h-4 w-4" />
                          System Message
                        </h4>
                        <Textarea
                          value={log.systemMessage}
                          readOnly
                          className="min-h-[100px] text-xs font-mono"
                        />
                      </div>
                    )}

                    <div>
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <Bot className="h-4 w-4" />
                        AI Response
                      </h4>
                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                        <p className="text-sm whitespace-pre-wrap">
                          {log.aiResponse.length > 300 && expandedLog !== log.id
                            ? `${log.aiResponse.substring(0, 300)}...`
                            : log.aiResponse}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}