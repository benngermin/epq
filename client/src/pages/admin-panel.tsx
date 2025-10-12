import { useState, useCallback, lazy, Suspense, useEffect } from "react";
import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Upload, Eye, LogOut, User, Shield, Download, CheckCircle, AlertCircle, RefreshCw, Loader2, XCircle, Edit2, Copy } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, Link } from "wouter";
import { AdminLayout } from "@/components/AdminLayout";

// Lazy load the AppLogsSection component to reduce initial bundle size
const AppLogsSection = lazy(() => import("@/components/app-logs-section").then(module => ({ default: module.AppLogsSection })));
import type { AiSettings, PromptVersion } from "@shared/schema";



const courseSchema = z.object({
  courseNumber: z.string().min(1, "Course number is required"),
  courseTitle: z.string().min(1, "Course title is required"),
});

const questionSetSchema = z.object({
  title: z.string().min(1, "Question set title is required"),
  description: z.string().optional(),
});

const courseQuestionSetSchema = z.object({
  courseId: z.number().min(1, "Course selection is required"),
  questionSetId: z.number().min(1, "Question set selection is required"),
  displayOrder: z.number().default(0),
});

const aiSettingsSchema = z.object({
  modelName: z.string().min(1, "Model is required"),
});

const promptSchema = z.object({
  promptText: z.string().min(1, "Prompt text is required"),
});

// AI Settings Component
function AISettingsSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Query for AI settings
  const { data: aiSettings, isLoading: aiSettingsLoading } = useQuery<AiSettings>({
    queryKey: ["/api/admin/ai-settings"],
  });

  // Query for active prompt
  const { data: activePrompt, isLoading: promptLoading } = useQuery<PromptVersion>({
    queryKey: ["/api/admin/active-prompt"],
  });

  const aiSettingsForm = useForm<z.infer<typeof aiSettingsSchema>>({
    resolver: zodResolver(aiSettingsSchema),
    defaultValues: {
      modelName: "google/gemini-2.0-flash-exp", // Updated to latest Gemini model
    },
  });

  const promptForm = useForm<z.infer<typeof promptSchema>>({
    resolver: zodResolver(promptSchema),
    defaultValues: {
      promptText: "",
    },
  });

  // Set form values when data loads
  React.useEffect(() => {
    if (aiSettings) {
      aiSettingsForm.reset({
        modelName: aiSettings.modelName || "google/gemini-2.0-flash-exp",
      });
    }
  }, [aiSettings, aiSettingsForm]);

  React.useEffect(() => {
    if (activePrompt) {
      promptForm.reset({
        promptText: activePrompt.promptText || "",
      });
    }
  }, [activePrompt, promptForm]);

  const updateAISettingsMutation = useMutation({
    mutationFn: async (data: z.infer<typeof aiSettingsSchema>) => {
      const res = await apiRequest("PUT", "/api/admin/ai-settings", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "AI settings updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai-settings"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update AI settings",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updatePromptMutation = useMutation({
    mutationFn: async (data: z.infer<typeof promptSchema>) => {
      const res = await apiRequest("PUT", "/api/admin/active-prompt", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Prompt updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/active-prompt"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update prompt",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmitAISettings = (data: z.infer<typeof aiSettingsSchema>) => {
    updateAISettingsMutation.mutate(data);
  };

  const onSubmitPrompt = (data: z.infer<typeof promptSchema>) => {
    updatePromptMutation.mutate(data);
  };

  if (aiSettingsLoading || promptLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Loading AI Settings...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* AI Model Settings */}
      <Card>
        <CardHeader>
          <CardTitle>AI Model Configuration</CardTitle>
          <CardDescription>
            Configure the AI model parameters for question generation and analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...aiSettingsForm}>
            <form onSubmit={aiSettingsForm.handleSubmit(onSubmitAISettings)} className="space-y-4">
              <FormField
                control={aiSettingsForm.control}
                name="modelName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>AI Model (OpenRouter Slug)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., google/gemini-2.0-flash-exp, openai/gpt-4o, anthropic/claude-3.5-sonnet"
                        {...field}
                      />
                    </FormControl>
                    <div className="text-xs text-muted-foreground mt-1">
                      Enter any valid OpenRouter model slug. You can find available models at{" "}
                      <a 
                        href="https://openrouter.ai/models" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        openrouter.ai/models
                      </a>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />



              <Button type="submit" disabled={updateAISettingsMutation.isPending}>
                {updateAISettingsMutation.isPending ? "Updating..." : "Update Model Settings"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* System Prompt */}
      <Card>
        <CardHeader>
          <CardTitle>System Prompt</CardTitle>
          <CardDescription>
            The current prompt being used by the AI chatbot to generate responses to student questions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...promptForm}>
            <form onSubmit={promptForm.handleSubmit(onSubmitPrompt)} className="space-y-4">
              <FormField
                control={promptForm.control}
                name="promptText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Active Prompt</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter the system prompt for the AI chatbot..."
                        className="resize-none font-mono text-sm"
                        rows={15}
                        {...field}
                      />
                    </FormControl>
                    <div className="text-xs text-muted-foreground">
                      This prompt guides how the AI responds to student questions. Use template variables: {"{"}{"{"} QUESTION_TEXT {"}"}{"}"},  {"{"}{"{"} ANSWER_CHOICES {"}"}{"}"},  {"{"}{"{"} SELECTED_ANSWER {"}"}{"}"},  {"{"}{"{"} CORRECT_ANSWER {"}"}{"}"},  {"{"}{"{"} COURSE_MATERIAL {"}"}{"}"} 
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={updatePromptMutation.isPending}>
                {updatePromptMutation.isPending ? "Updating..." : "Update Prompt"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

// OpenRouter Settings Component
function OpenRouterSettingsSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Define the OpenRouter config schema
  const openRouterConfigSchema = z.object({
    modelName: z.string().min(1, "Model is required"),
    systemMessage: z.string().min(1, "System message is required"),
  });
  
  // Query for OpenRouter config
  const { data: openRouterConfig, isLoading } = useQuery<{ modelName: string; systemMessage: string }>({
    queryKey: ["/api/admin/openrouter-config"],
  });

  // Form setup
  const form = useForm<z.infer<typeof openRouterConfigSchema>>({
    resolver: zodResolver(openRouterConfigSchema),
    defaultValues: {
      modelName: "anthropic/claude-3.5-sonnet",
      systemMessage: "You are an expert insurance instructor providing clear explanations for insurance exam questions.",
    },
  });

  // Set form values when data loads
  React.useEffect(() => {
    if (openRouterConfig) {
      form.reset({
        modelName: openRouterConfig.modelName || "anthropic/claude-3.5-sonnet",
        systemMessage: openRouterConfig.systemMessage || "You are an expert insurance instructor providing clear explanations for insurance exam questions.",
      });
    }
  }, [openRouterConfig, form]);

  // Update mutation
  const updateConfigMutation = useMutation({
    mutationFn: async (data: z.infer<typeof openRouterConfigSchema>) => {
      const res = await apiRequest("PUT", "/api/admin/openrouter-config", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({ 
        title: "OpenRouter settings updated successfully",
        description: "Static explanation generation will now use the updated configuration.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/openrouter-config"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update OpenRouter settings",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof openRouterConfigSchema>) => {
    updateConfigMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Loading OpenRouter Settings...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Static Explanation Generation Settings</CardTitle>
          <CardDescription>
            Configure the OpenRouter AI model and system message used for generating static explanations for questions.
            These settings are separate from the chatbot configuration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="modelName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>OpenRouter Model Slug</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., anthropic/claude-3.5-sonnet" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="systemMessage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>System Message</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter the system message for static explanation generation..."
                        className="resize-vertical font-mono text-sm min-h-[200px]"
                        rows={10}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                    
                    <div className="mt-3 space-y-2">
                      <div className="text-xs font-semibold text-muted-foreground">
                        Allowed Template Variables:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <div className="flex items-center gap-1 px-2 py-1 bg-muted rounded-md">
                          <code className="text-xs font-mono">{'{{QUESTION_TEXT}}'}</code>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0 hover:bg-transparent"
                            onClick={() => navigator.clipboard.writeText('{{QUESTION_TEXT}}')}
                          >
                            <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-1 px-2 py-1 bg-muted rounded-md">
                          <code className="text-xs font-mono">{'{{CORRECT_ANSWER}}'}</code>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0 hover:bg-transparent"
                            onClick={() => navigator.clipboard.writeText('{{CORRECT_ANSWER}}')}
                          >
                            <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-1 px-2 py-1 bg-muted rounded-md">
                          <code className="text-xs font-mono">{'{{LEARNING_CONTENT}}'}</code>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0 hover:bg-transparent"
                            onClick={() => navigator.clipboard.writeText('{{LEARNING_CONTENT}}')}
                          >
                            <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                          </Button>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-2">
                        These variables will be replaced with actual question data when generating explanations.
                      </div>
                    </div>
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={updateConfigMutation.isPending}>
                {updateConfigMutation.isPending ? "Saving..." : "Save OpenRouter Settings"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

// Bubble Import Section Component
function BubbleImportSection() {
  const [courseNumber, setCourseNumber] = useState("");
  const [questionSets, setQuestionSets] = useState<any[]>([]);
  const [selectedSets, setSelectedSets] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const fetchQuestionSets = async () => {
    setLoading(true);
    try {
      const params = courseNumber ? `?courseNumber=${courseNumber}` : '';
      const response = await apiRequest("GET", `/api/admin/bubble/question-sets${params}`);
      
      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        throw new Error("Invalid response format from server");
      }
      
      if (data.response && data.response.results) {
        setQuestionSets(data.response.results);
        if (courseNumber && data.response.results.length === 0) {
          toast({
            title: "No question sets found",
            description: `No question sets found for course ${courseNumber}`,
          });
        }
      } else if (Array.isArray(data)) {
        setQuestionSets(data);
      } else {
        setQuestionSets([]);
      }
    } catch (error) {
      toast({
        title: "Failed to fetch question sets",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const importSelectedSets = async () => {
    if (selectedSets.length === 0) {
      toast({
        title: "No question sets selected",
        description: "Please select at least one question set to import",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    try {
      const selectedQuestionSets = questionSets.filter(qs => selectedSets.includes(qs._id));
      const response = await apiRequest("POST", "/api/admin/bubble/import-question-sets", {
        questionSets: selectedQuestionSets
      });
      
      let result;
      try {
        result = await response.json();
      } catch (jsonError) {
        throw new Error("Invalid response format from server");
      }
      
      toast({
        title: "Import completed",
        description: result.message,
      });
      
      // Refresh the question sets list
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-question-sets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courses"] });
      
      // Reset selection
      setSelectedSets([]);
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedSets(prev => 
      prev.includes(id) 
        ? prev.filter(s => s !== id)
        : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedSets(questionSets.map(qs => qs._id));
  };

  const deselectAll = () => {
    setSelectedSets([]);
  };

  const updateAllQuestionSets = async () => {
    console.log("🚀 Update Question Set Data button clicked");
    setUpdating(true);
    try {
      console.log("📡 Sending request to /api/admin/bubble/update-all-question-sets");
      const body = courseNumber ? { courseNumber } : {};
      const response = await apiRequest("POST", "/api/admin/bubble/update-all-question-sets", body);
      
      console.log("📥 Response received:", response.status, response.statusText);
      
      let result;
      try {
        result = await response.json();
        console.log("✅ Response JSON parsed successfully:", result);
      } catch (jsonError) {
        console.error("❌ Failed to parse response JSON:", jsonError);
        throw new Error("Invalid response format from server");
      }
      
      // Show detailed toast with results
      const detailMessage = result.results ? 
        `Created: ${result.results.created}, Updated: ${result.results.updated}, Failed: ${result.results.failed}` : 
        result.message;
      
      toast({
        title: courseNumber ? `Update completed for ${courseNumber}` : "Update completed",
        description: detailMessage,
      });
      
      console.log("🔄 Invalidating caches...");
      // Refresh the question sets list
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-question-sets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courses"] });
      console.log("✅ Cache invalidation complete");
    } catch (error) {
      console.error("❌ Update failed:", error);
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
      console.log("🏁 Update process finished");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Click "Update Question Set Data" to sync all question sets with the latest data from the Bubble repository. This will check for new question sets and update existing ones without creating duplicates.
        </p>
        <Button 
          onClick={updateAllQuestionSets} 
          disabled={updating}
          className="w-full"
          variant="default"
        >
          {updating 
            ? (courseNumber ? `Updating ${courseNumber} Question Sets...` : "Updating All Question Sets...") 
            : (courseNumber ? `Update ${courseNumber} Question Set Data` : "Update All Question Set Data")}
        </Button>
      </div>
      
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or import specific question sets</span>
        </div>
      </div>
      
      <p className="text-sm text-muted-foreground">
        Search and select specific question sets to import from the Bubble repository.
      </p>
      <div className="flex gap-2">
        <Input
          placeholder="Course number (optional)"
          value={courseNumber}
          onChange={(e) => setCourseNumber(e.target.value)}
          className="flex-1"
        />
        <Button onClick={fetchQuestionSets} disabled={loading} variant="outline">
          {loading ? "Searching..." : "Search Question Sets"}
        </Button>
      </div>

      {questionSets.length > 0 ? (
        <>
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Found {questionSets.length} question sets
              {courseNumber && ` for course ${courseNumber}`}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAll}>
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAll}>
                Deselect All
              </Button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto border rounded-lg p-4 space-y-2">
            {questionSets.map((qs) => (
              <div key={qs._id} className="flex items-center space-x-2 p-2 hover:bg-muted rounded">
                <input
                  type="checkbox"
                  checked={selectedSets.includes(qs._id)}
                  onChange={() => toggleSelection(qs._id)}
                  className="h-4 w-4"
                />
                <div className="flex-1">
                  <p className="font-medium">{qs.title || `Question Set ${qs._id}`}</p>
                  <p className="text-sm text-muted-foreground">
                    Course: {qs.learning_object?.course?.course_number || 'Unknown'} | 
                    Questions: {qs.questions?.length || 0}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <Button 
            onClick={importSelectedSets} 
            disabled={importing || selectedSets.length === 0}
            className="w-full"
          >
            {importing ? "Importing..." : `Import ${selectedSets.length} Selected Question Sets`}
          </Button>
        </>
      ) : null}
    </div>
  );
}

export default function AdminPanel() {
  const { user, logoutMutation } = useAuth();
  const [, setLocation] = useLocation();
  
  // Check URL params for initial tab
  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = urlParams.get('tab') || "content";
  const [activeTab, setActiveTab] = useState(initialTab);
  
  // Handle URL parameters on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    const feedbackId = params.get('feedbackId');
    
    // If there's a feedbackId, make sure we're on the logs tab
    if (feedbackId) {
      setActiveTab('logs');
    } else if (tab) {
      setActiveTab(tab);
    }
  }, []);
  const [editingCourse, setEditingCourse] = useState<any>(null);
  const [editingQuestionSet, setEditingQuestionSet] = useState<any>(null);
  const [courseMaterialsDialogOpen, setCourseMaterialsDialogOpen] = useState(false);
  const [standaloneQuestionSetDialogOpen, setStandaloneQuestionSetDialogOpen] = useState(false);
  const [selectedQuestionSetForImport, setSelectedQuestionSetForImport] = useState<number | null>(null);
  const [bulkImportData, setBulkImportData] = useState({
    courseId: 0,
    questionSetTitle: "",
    jsonData: "",
  });
  const [isDragOver, setIsDragOver] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState<{
    current: number;
    total: number;
    errors: Array<{ 
      questionSetId: string; 
      title: string; 
      error: string;
      courseName?: string;
      details?: string;
    }>;
  } | null>(null);
  const [showRefreshConfirm, setShowRefreshConfirm] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Forms
  const courseForm = useForm<z.infer<typeof courseSchema>>({
    resolver: zodResolver(courseSchema),
    defaultValues: { courseNumber: "", courseTitle: "" },
  });

  const editCourseForm = useForm<z.infer<typeof courseSchema>>({
    resolver: zodResolver(courseSchema),
    defaultValues: { courseNumber: "", courseTitle: "" },
  });

  const standaloneQuestionSetForm = useForm<z.infer<typeof questionSetSchema>>({
    resolver: zodResolver(questionSetSchema),
    defaultValues: { title: "", description: "" },
  });

  const courseQuestionSetForm = useForm<z.infer<typeof courseQuestionSetSchema>>({
    resolver: zodResolver(courseQuestionSetSchema),
    defaultValues: { courseId: undefined as any, questionSetId: undefined as any, displayOrder: 0 },
  });

  // Queries
  const { data: courses, isLoading: coursesLoading } = useQuery({
    queryKey: ["/api/admin/courses"],
  });

  const { data: allQuestionSets, isLoading: questionSetsLoading } = useQuery({
    queryKey: ["/api/admin/all-question-sets"],
  });

  // Mutations
  const createCourseMutation = useMutation({
    mutationFn: async (data: z.infer<typeof courseSchema>) => {
      const res = await apiRequest("POST", "/api/admin/courses", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Course created successfully" });
      courseForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courses"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create course",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteCourseMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/courses/${id}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to delete course");
      }
      return res;
    },
    onSuccess: () => {
      toast({ title: "Course deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courses"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete course",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createQuestionSetMutation = useMutation({
    mutationFn: async (data: z.infer<typeof questionSetSchema>) => {
      const res = await apiRequest("POST", "/api/admin/question-sets", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Question set created successfully" });
      standaloneQuestionSetForm.reset();
      setStandaloneQuestionSetDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-question-sets"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create question set",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createCourseQuestionSetMappingMutation = useMutation({
    mutationFn: async ({ courseId, questionSetId, displayOrder = 0 }: { courseId: number; questionSetId: number; displayOrder?: number }) => {
      const res = await apiRequest("POST", `/api/admin/courses/${courseId}/question-sets/${questionSetId}`, { displayOrder });
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Question set linked to course successfully" });
      courseQuestionSetForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-question-sets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courses"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to link question set to course",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeCourseQuestionSetMappingMutation = useMutation({
    mutationFn: async ({ courseId, questionSetId }: { courseId: number; questionSetId: number }) => {
      const res = await apiRequest("DELETE", `/api/admin/courses/${courseId}/question-sets/${questionSetId}`);
      return res;
    },
    onSuccess: () => {
      toast({ title: "Question set unlinked from course successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-question-sets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courses"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to unlink question set from course",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const importLearningObjectsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/bubble/import-all-learning-objects");
      return await res.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Learning objects imported successfully", 
        description: data.message || 'Import completed'
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/course-materials"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to import learning objects",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const importCourseMaterialsMutation = useMutation({
    mutationFn: async (csvContent: string) => {
      // Use a proper CSV parsing approach that handles quoted multi-line content
      const materials = [];
      const lines = csvContent.split('\n');
      let i = 1; // Skip header
      
      while (i < lines.length) {
        const line = lines[i].trim();
        if (!line) {
          i++;
          continue;
        }
        
        // Check if this line starts a new record (begins with quote)
        if (line.startsWith('"')) {
          let recordText = line;
          let fieldCount = 0;
          let inQuotes = false;
          
          // Count fields and check if record is complete on this line
          for (let j = 0; j < line.length; j++) {
            if (line[j] === '"') {
              inQuotes = !inQuotes;
            } else if (line[j] === ',' && !inQuotes) {
              fieldCount++;
            }
          }
          
          // If we don't have 3 commas (4 fields) or still in quotes, collect more lines
          while ((fieldCount < 3 || inQuotes) && i + 1 < lines.length) {
            i++;
            recordText += '\n' + lines[i];
            
            // Recount fields in the combined record
            fieldCount = 0;
            inQuotes = false;
            for (let j = 0; j < recordText.length; j++) {
              if (recordText[j] === '"') {
                inQuotes = !inQuotes;
              } else if (recordText[j] === ',' && !inQuotes) {
                fieldCount++;
              }
            }
          }
          
          // Parse the complete record
          const fields = [];
          let currentField = '';
          inQuotes = false;
          
          for (let j = 0; j < recordText.length; j++) {
            const char = recordText[j];
            if (char === '"') {
              if (inQuotes && recordText[j + 1] === '"') {
                currentField += '"';
                j++; // Skip escaped quote
              } else {
                inQuotes = !inQuotes;
              }
            } else if (char === ',' && !inQuotes) {
              fields.push(currentField);
              currentField = '';
            } else {
              currentField += char;
            }
          }
          fields.push(currentField); // Add last field
          
          // Create material record if we have all required fields
          if (fields.length >= 4 && fields[0] && fields[2]) {
            materials.push({
              assignment: fields[0],
              course: fields[1] || '',
              loid: fields[2],
              content: fields[3] || ''
            });
          }
        }
        i++;
      }
      
      const res = await apiRequest("POST", "/api/admin/import-course-materials", { materials });
      return await res.json();
    },
    onSuccess: (data) => {
      toast({ title: `Course materials imported successfully: ${data.message || 'Import completed'}` });
      setCourseMaterialsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/course-materials"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to import course materials",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const importQuestionsMutation = useMutation({
    mutationFn: async ({ questionSetId, questions }: { questionSetId: number; questions: any[] }) => {
      const res = await apiRequest("POST", `/api/admin/question-sets/${questionSetId}/questions`, { questions });
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Questions imported successfully" });
      setBulkImportData({ courseId: 0, questionSetTitle: "", jsonData: "" });
      setSelectedQuestionSetForImport(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-question-sets"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to import questions",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle bulk refresh with SSE for real-time updates
  const handleBulkRefresh = useCallback(() => {
    setShowRefreshConfirm(false);
    setIsRefreshing(true);
    setRefreshProgress({ current: 0, total: 0, errors: [] });
    
    const eventSource = new EventSource('/api/admin/bubble/bulk-refresh-question-sets', {
      withCredentials: true
    });
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'start':
            console.log('Bulk refresh started:', data.message);
            break;
            
          case 'total':
            setRefreshProgress(prev => ({ ...prev!, total: data.total }));
            break;
            
          case 'progress':
            setRefreshProgress(prev => ({
              ...prev!,
              current: data.current,
              total: data.total
            }));
            break;
            
          case 'complete':
            eventSource.close();
            setIsRefreshing(false);
            
            const hasErrors = data.results?.errors?.length > 0;
            
            if (hasErrors) {
              setRefreshProgress({
                current: data.results.refreshed,
                total: data.results.totalSets,
                errors: data.results.errors
              });
              toast({
                title: "Bulk refresh completed with errors",
                description: `Refreshed: ${data.results.refreshed}, Failed: ${data.results.failed}`,
                variant: "default",
              });
            } else {
              setRefreshProgress(null);
              toast({
                title: "Bulk refresh completed successfully",
                description: `All ${data.results.refreshed} question sets refreshed`,
              });
            }
            
            // Refresh the question sets list
            queryClient.invalidateQueries({ queryKey: ["/api/admin/all-question-sets"] });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/courses"] });
            break;
            
          case 'error':
            eventSource.close();
            setIsRefreshing(false);
            setRefreshProgress(null);
            toast({
              title: "Failed to refresh question sets",
              description: data.message || data.error,
              variant: "destructive",
            });
            break;
        }
      } catch (error) {
        console.error('Error parsing SSE data:', error);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      eventSource.close();
      setIsRefreshing(false);
      setRefreshProgress(null);
      toast({
        title: "Connection error during refresh",
        description: "Please try again",
        variant: "destructive",
      });
    };
    
    return () => eventSource.close();
  }, [queryClient]);

  // Event handlers
  const onCreateCourse = (data: z.infer<typeof courseSchema>) => {
    createCourseMutation.mutate(data);
  };

  const onCreateStandaloneQuestionSet = (data: z.infer<typeof questionSetSchema>) => {
    createQuestionSetMutation.mutate(data);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type === "application/json") {
        const reader = new FileReader();
        reader.onload = (event) => {
          const jsonData = event.target?.result as string;
          setBulkImportData(prev => ({ ...prev, jsonData }));
        };
        reader.readAsText(file);
      }
    }
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const jsonData = event.target?.result as string;
        setBulkImportData(prev => ({ ...prev, jsonData }));
      };
      reader.readAsText(file);
    }
  }, []);

  return (
    <AdminLayout>
      <div className="py-4">

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="content">Content Management</TabsTrigger>
            <TabsTrigger value="settings">Chatbot</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>

          <div className="space-y-6">
            {/* Content Management Tab */}
            <TabsContent value="content">
              <div className="space-y-6">
                {/* Sub-tabs for Question Sets and Course Materials */}
                <Tabs defaultValue="question-sets" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="question-sets">Question Sets</TabsTrigger>
                    <TabsTrigger value="course-materials">Course Materials</TabsTrigger>
                    <TabsTrigger value="static-explanations">Static Explanations</TabsTrigger>
                  </TabsList>

                  {/* Question Sets Sub-tab */}
                  <TabsContent value="question-sets">
                    <div className="mt-6 mb-2">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="secondary">
                          <Plus className="h-4 w-4 mr-2" />
                          Create Course
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create New Course</DialogTitle>
                        <DialogDescription>Add a new course to organize your question sets</DialogDescription>
                      </DialogHeader>
                      <Form {...courseForm}>
                        <form onSubmit={courseForm.handleSubmit(onCreateCourse)} className="space-y-4">
                          <FormField
                            control={courseForm.control}
                            name="courseNumber"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Course Number</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g., CPCU 500" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={courseForm.control}
                            name="courseTitle"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Course Title</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g., Becoming a Leader in Risk Management and Insurance" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <DialogFooter>
                            <Button type="submit" disabled={createCourseMutation.isPending}>
                              {createCourseMutation.isPending ? "Creating..." : "Create Course"}
                            </Button>
                          </DialogFooter>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                  <Dialog open={standaloneQuestionSetDialogOpen} onOpenChange={setStandaloneQuestionSetDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="secondary">
                        <Plus className="h-4 w-4 mr-2" />
                        Create Question Set
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create New Question Set</DialogTitle>
                        <DialogDescription>Create a new shared question set. You can link it to courses after creation.</DialogDescription>
                      </DialogHeader>
                      <Form {...standaloneQuestionSetForm}>
                        <form onSubmit={standaloneQuestionSetForm.handleSubmit(onCreateStandaloneQuestionSet)} className="space-y-4">
                          <FormField
                            control={standaloneQuestionSetForm.control}
                            name="title"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Question Set Title</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g., Question Set 1" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={standaloneQuestionSetForm.control}
                            name="description"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Description (Optional)</FormLabel>
                                <FormControl>
                                  <Textarea placeholder="Enter question set description" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <DialogFooter>
                            <Button type="submit" disabled={createQuestionSetMutation.isPending}>
                              {createQuestionSetMutation.isPending ? "Creating..." : "Create Question Set"}
                            </Button>
                          </DialogFooter>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                  
                  {/* Bulk Refresh Button */}
                  <Button 
                    variant="secondary"
                    onClick={() => setShowRefreshConfirm(true)}
                    disabled={isRefreshing}
                  >
                    {isRefreshing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Refreshing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh All
                      </>
                    )}
                  </Button>
                  
                  </div>
                  </div>
                  
                  {/* Progress Indicator */}
                  {isRefreshing && refreshProgress && (
                    <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">
                          Refreshing question sets...
                        </span>
                        <span className="text-sm text-gray-600">
                          {refreshProgress.current}/{refreshProgress.total} complete
                        </span>
                      </div>
                      <Progress 
                        value={(refreshProgress.current / refreshProgress.total) * 100} 
                        className="h-2"
                      />
                    </div>
                  )}
                  
                  {/* Error Display */}
                  {refreshProgress?.errors && refreshProgress.errors.length > 0 && (
                    <Alert variant="destructive" className="mt-4">
                      <XCircle className="h-4 w-4" />
                      <AlertDescription>
                        <div className="font-medium mb-2">Failed to refresh {refreshProgress.errors.length} question set(s):</div>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {refreshProgress.errors.map((error, idx) => (
                            <div key={idx} className="text-sm border-l-2 border-red-300 pl-3 py-1">
                              <div className="font-semibold">
                                {error.title}
                                {error.courseName && (
                                  <span className="text-xs ml-2 text-red-600">
                                    (Course: {error.courseName})
                                  </span>
                                )}
                              </div>
                              <div className="text-red-700">{error.error}</div>
                              {error.details && (
                                <div className="text-xs text-red-600 italic mt-1">{error.details}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
                
                {/* Confirmation Dialog for Bulk Refresh */}
                <AlertDialog open={showRefreshConfirm} onOpenChange={setShowRefreshConfirm}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Refresh All Question Sets</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will refresh all existing question sets with the latest data from the Bubble repository. 
                        This operation will update question content while preserving analytics data.
                        
                        <div className="mt-2 font-medium">
                          This process may take several minutes depending on the number of question sets.
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleBulkRefresh}>
                        Start Refresh
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <div className="space-y-4">
                  {coursesLoading ? (
                    <div className="text-center py-8">Loading courses...</div>
                  ) : courses && Array.isArray(courses) && courses.length > 0 ? (
                    (courses as any[])
                      .sort((a: any, b: any) => {
                        // First, sort by whether the course has question sets (populated courses first)
                        const aHasQuestionSets = a.questionSetCount > 0 ? 1 : 0;
                        const bHasQuestionSets = b.questionSetCount > 0 ? 1 : 0;
                        
                        if (aHasQuestionSets !== bHasQuestionSets) {
                          return bHasQuestionSets - aHasQuestionSets;
                        }
                        
                        // Then sort alphabetically by course number
                        return a.courseNumber.localeCompare(b.courseNumber);
                      })
                      .map((course: any) => (
                      <Card key={course.id} className="shadow-sm hover:shadow-md transition-shadow duration-200">
                        <CardHeader className="pb-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <CardTitle className="text-xl">
                                {course.courseNumber}: {course.courseTitle}
                                <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${
                                  course.isAi 
                                    ? 'bg-blue-100 text-blue-700' 
                                    : 'bg-gray-100 text-gray-700'
                                }`}>
                                  {course.isAi ? 'AI' : 'Non-AI'}
                                </span>
                              </CardTitle>
                              <CardDescription className="mt-1">
                                {course.courseTitle}
                                {course.questionSetCount > 0 && (
                                  <span className="ml-2 text-green-600 text-sm font-medium">
                                    ({course.questionSetCount} question set{course.questionSetCount !== 1 ? 's' : ''})
                                  </span>
                                )}
                              </CardDescription>
                            </div>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Course</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{course.courseNumber}: {course.courseTitle}"? 
                                    This will also delete all associated question sets and questions. 
                                    This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => deleteCourseMutation.mutate(course.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <QuestionSetsSection 
                            courseId={course.id} 
                            isAiCourse={course.isAi}
                            refreshErrors={refreshProgress?.errors?.filter(
                              (e: any) => e.courseId === course.id
                            ) || []}
                          />
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No courses found.</p>
                      <p className="text-sm text-muted-foreground mt-2">Create your first course to get started.</p>
                    </div>
                  )}
                </div>
                  </TabsContent>

                  {/* Course Materials Sub-tab */}
                  <TabsContent value="course-materials">
                    <div className="bg-white rounded-lg p-6 shadow-sm">
                      <div className="flex justify-between items-center mb-6">
                        <div>
                          <h2 className="text-xl font-semibold text-gray-900">Course Materials</h2>
                          <p className="text-gray-600 text-sm mt-1">View and manage uploaded course materials</p>
                        </div>
                        <div className="flex gap-3">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button size="lg">
                                <Download className="w-5 h-5 mr-2" />
                                Import from Bubble.io
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Import Learning Objects from Bubble.io</DialogTitle>
                                <DialogDescription>
                                  Import course materials (learning objects) from the Bubble.io repository
                                </DialogDescription>
                              </DialogHeader>
                              <div className="grid gap-4 py-4">
                                <Button
                                  onClick={() => {
                                    importLearningObjectsMutation.mutate();
                                  }}
                                  disabled={importLearningObjectsMutation.isPending}
                                  className="w-full justify-start"
                                  size="lg"
                                >
                                  <Download className="w-5 h-5 mr-2" />
                                  {importLearningObjectsMutation.isPending ? "Importing..." : "Import All Learning Objects"}
                                </Button>
                              </div>
                              {importLearningObjectsMutation.isSuccess && (
                                <Alert>
                                  <CheckCircle className="h-4 w-4" />
                                  <AlertDescription>
                                    {importLearningObjectsMutation.data?.message}
                                  </AlertDescription>
                                </Alert>
                              )}
                              {importLearningObjectsMutation.isError && (
                                <Alert variant="destructive">
                                  <AlertCircle className="h-4 w-4" />
                                  <AlertDescription>
                                    Failed to import learning objects. Please try again.
                                  </AlertDescription>
                                </Alert>
                              )}
                            </DialogContent>
                          </Dialog>
                          <Button 
                            onClick={() => setCourseMaterialsDialogOpen(true)}
                            variant="outline"
                            className="shadow-sm"
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            Import CSV
                          </Button>
                        </div>
                      </div>
                      <CourseMaterialsSection />
                    </div>
                  </TabsContent>

                  {/* Static Explanations Sub-tab */}
                  <TabsContent value="static-explanations">
                    <div className="mt-6">
                      <OpenRouterSettingsSection />
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </TabsContent>
          </div>

            {/* AI & Settings Tab */}
            <TabsContent value="settings">
              <div className="space-y-6">
                <AISettingsSection />
              </div>
            </TabsContent>

            {/* Logs Tab */}
            <TabsContent value="logs">
              <div className="space-y-6">
                <Suspense fallback={
                  <Card>
                    <CardHeader>
                      <CardTitle>Loading Logs...</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="animate-pulse space-y-4">
                        <div className="h-32 bg-muted rounded"></div>
                        <div className="h-32 bg-muted rounded"></div>
                        <div className="h-32 bg-muted rounded"></div>
                      </div>
                    </CardContent>
                  </Card>
                }>
                  <AppLogsSection />
                </Suspense>
              </div>
            </TabsContent>
        </Tabs>
        
        {/* Course Materials Import Dialog */}
        <Dialog open={courseMaterialsDialogOpen} onOpenChange={setCourseMaterialsDialogOpen}>
          <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Course Materials</DialogTitle>
            <DialogDescription>
              Upload a CSV file containing course materials with LOID mapping
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="csv-file">CSV File</Label>
              <input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      const csvContent = event.target?.result as string;
                      importCourseMaterialsMutation.mutate(csvContent);
                    };
                    reader.readAsText(file);
                  }
                }}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/80"
              />
            </div>
            <div className="text-sm text-muted-foreground bg-blue-50 p-3 rounded border">
              <strong>CSV Format:</strong>
              <ul className="mt-2 space-y-1 list-disc list-inside">
                <li>assignment: The assignment/chapter name</li>
                <li>course: Course identifier (e.g., CPCU 500)</li>
                <li>loid: Learning Objective ID (links to questions)</li>
                <li>value: The course material content</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setCourseMaterialsDialogOpen(false)}
              variant="outline"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </AdminLayout>
  );
}

function EditMaterialDialog({ material, onClose }: { material: any; onClose: () => void }) {
  const [editedMaterial, setEditedMaterial] = useState(material);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  React.useEffect(() => {
    setEditedMaterial(material);
  }, [material]);

  const updateMaterialMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PUT", `/api/admin/course-materials/${data.id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Course material updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/course-materials"] });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update course material",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!editedMaterial.assignment || !editedMaterial.course || !editedMaterial.loid || !editedMaterial.content) {
      toast({
        title: "Validation Error",
        description: "All fields are required",
        variant: "destructive",
      });
      return;
    }
    updateMaterialMutation.mutate(editedMaterial);
  };

  if (!material) return null;

  return (
    <Dialog open={!!material} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Course Material</DialogTitle>
          <DialogDescription>
            Update course material information
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Assignment</Label>
              <Input 
                value={editedMaterial?.assignment || ''} 
                onChange={(e) => setEditedMaterial((prev: any) => ({ ...prev, assignment: e.target.value }))}
              />
            </div>
            <div>
              <Label>Course</Label>
              <Input 
                value={editedMaterial?.course || ''} 
                onChange={(e) => setEditedMaterial((prev: any) => ({ ...prev, course: e.target.value }))}
              />
            </div>
            <div>
              <Label>LOID</Label>
              <Input 
                value={editedMaterial?.loid || ''} 
                onChange={(e) => setEditedMaterial((prev: any) => ({ ...prev, loid: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label>Content</Label>
            <Textarea 
              value={editedMaterial?.content || ''} 
              onChange={(e) => setEditedMaterial((prev: any) => ({ ...prev, content: e.target.value }))}
              rows={15}
              className="font-mono text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={updateMaterialMutation.isPending}
          >
            {updateMaterialMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CourseMaterialsSection() {
  const { data: materials, isLoading } = useQuery({
    queryKey: ["/api/admin/course-materials"],
  });
  
  const [editingMaterial, setEditingMaterial] = useState<any>(null);
  const [viewingMaterial, setViewingMaterial] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteMaterialMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/course-materials/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Course material deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/course-materials"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete course material",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <>
      <div className="space-y-4">
        {isLoading ? (
            <div className="text-center py-4 text-gray-500">Loading course materials...</div>
          ) : materials && Array.isArray(materials) && materials.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-blue-50 rounded-lg p-3">
                <span className="text-sm font-medium text-blue-900">
                  Total: {materials.length} course materials
                </span>
                <span className="text-sm text-blue-700">
                  {new Set(materials.map((m: any) => m.loid)).size} unique LOIDs
                </span>
              </div>
              <div className="h-[calc(100vh-24rem)] overflow-y-auto space-y-3 pr-2">
                {materials.map((material: any) => (
                  <div key={material.id} className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 truncate">{material.assignment}</h4>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-gray-600 bg-white px-2 py-1 rounded">
                            Course: {material.course}
                          </span>
                          <span className="text-xs text-gray-600 bg-white px-2 py-1 rounded">
                            LOID: {material.loid}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                          {material.content.substring(0, 150)}...
                        </p>
                      </div>
                      <div className="flex gap-1 ml-4 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewingMaterial(material)}
                          className="h-8 w-8 p-0"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingMaterial(material)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Course Material</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this course material? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMaterialMutation.mutate(material.id)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-gray-600">No course materials found.</p>
              <p className="text-sm text-gray-500 mt-2">
                Click "Import CSV" above to upload course materials.
              </p>
            </div>
          )}
      </div>

      {/* View Material Dialog */}
      <Dialog open={!!viewingMaterial} onOpenChange={() => setViewingMaterial(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>View Course Material</DialogTitle>
            <DialogDescription>
              {viewingMaterial?.assignment} - LOID: {viewingMaterial?.loid}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Assignment</Label>
                <Input value={viewingMaterial?.assignment || ''} readOnly />
              </div>
              <div>
                <Label>Course</Label>
                <Input value={viewingMaterial?.course || ''} readOnly />
              </div>
              <div>
                <Label>LOID</Label>
                <Input value={viewingMaterial?.loid || ''} readOnly />
              </div>
            </div>
            <div>
              <Label>Content</Label>
              <Textarea 
                value={viewingMaterial?.content || ''} 
                readOnly 
                rows={15}
                className="font-mono text-sm"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Material Dialog */}
      <EditMaterialDialog 
        material={editingMaterial} 
        onClose={() => setEditingMaterial(null)} 
      />
    </>
  );
}

function QuestionSetsSection({ 
  courseId, 
  isAiCourse,
  refreshErrors = []
}: { 
  courseId: number; 
  isAiCourse?: boolean;
  refreshErrors?: Array<{
    questionSetId: string;
    title: string;
    error: string;
    details?: string;
  }>;
}) {
  const [importModalOpen, setImportModalOpen] = useState<number | null>(null);
  const [importJsonData, setImportJsonData] = useState("");
  const [refreshModalOpen, setRefreshModalOpen] = useState<number | null>(null);
  const [refreshComparisonData, setRefreshComparisonData] = useState<any>(null);
  const [refreshingQuestionSet, setRefreshingQuestionSet] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: questionSets, isLoading: questionSetsLoading } = useQuery({
    queryKey: ["/api/admin/question-sets", courseId],
    queryFn: () => fetch(`/api/admin/question-sets/${courseId}`).then(res => res.json()),
  });

  const deleteQuestionSetMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/question-sets/${id}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to delete question set");
      }
      return res;
    },
    onSuccess: () => {
      toast({ title: "Question set deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/question-sets", courseId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-question-sets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courses"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete question set",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const importQuestionsMutation = useMutation({
    mutationFn: async (data: { questionSetId: number; jsonData: string }) => {
      const parsedData = JSON.parse(data.jsonData);
      const res = await apiRequest("POST", `/api/admin/question-sets/${data.questionSetId}/import-questions`, parsedData);
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Questions imported successfully" });
      setImportModalOpen(null);
      setImportJsonData("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/question-sets", courseId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to import questions",
        description: error.message,
        variant: "destructive",
      });
    },
  });


  const getRefreshComparisonMutation = useMutation({
    mutationFn: async (questionSetId: number) => {
      const res = await apiRequest("GET", `/api/admin/question-sets/${questionSetId}/refresh`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to fetch refresh comparison data");
      }
      return await res.json();
    },
    onSuccess: (data) => {
      setRefreshComparisonData(data);
      setRefreshModalOpen(data.questionSet.id);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to fetch refresh comparison",
        description: error.message,
        variant: "destructive",
      });
      setRefreshingQuestionSet(null);
    },
  });

  const performRefreshMutation = useMutation({
    mutationFn: async (questionSetId: number) => {
      const res = await apiRequest("POST", `/api/admin/question-sets/${questionSetId}/update-from-bubble`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to refresh question set");
      }
      return await res.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Question set refreshed successfully",
        description: data.message 
      });
      setRefreshModalOpen(null);
      setRefreshComparisonData(null);
      setRefreshingQuestionSet(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/question-sets", courseId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/questions"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to refresh question set",
        description: error.message,
        variant: "destructive",
      });
      setRefreshingQuestionSet(null);
    },
  });

  const handleImport = (questionSetId: number) => {
    if (!importJsonData.trim()) {
      toast({
        title: "No data to import",
        description: "Please paste your JSON data",
        variant: "destructive",
      });
      return;
    }

    try {
      importQuestionsMutation.mutate({
        questionSetId,
        jsonData: importJsonData,
      });
    } catch (error) {
      toast({
        title: "Invalid JSON",
        description: "Please check your JSON format",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-semibold text-gray-700">Question Sets</h3>
      </div>
      {questionSetsLoading ? (
        <div className="text-center py-4 text-sm text-gray-500">Loading question sets...</div>
      ) : questionSets && Array.isArray(questionSets) && questionSets.length > 0 ? (
        <div className="grid gap-3">
          {questionSets
            .sort((a: any, b: any) => {
              const aNum = parseInt(a.title.match(/\d+/)?.[0] || '0');
              const bNum = parseInt(b.title.match(/\d+/)?.[0] || '0');
              return aNum - bNum;
            })
            .map((questionSet: any) => {
              // Check if this question set has a refresh error
              const refreshError = refreshErrors.find(
                e => e.questionSetId === questionSet.externalId || 
                     e.title === questionSet.title
              );
              
              return (
              <div key={questionSet.id} className={`flex justify-between items-center p-4 rounded-lg transition-colors ${
                refreshError 
                  ? 'bg-red-50 border-2 border-red-300 hover:bg-red-100' 
                  : 'bg-gray-50 hover:bg-gray-100'
              }`}>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">
                    {questionSet.title}
                    {questionSet.isShared && (
                      <span className="ml-2 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700" title={`Shared with: ${questionSet.sharedCourses?.map((c: any) => `${c.courseNumber} (${c.isAi ? 'AI' : 'Non-AI'})`).join(', ')}`}>
                        🔗 Shared
                      </span>
                    )}
                    {refreshError && (
                      <span className="ml-2 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
                        ⚠️ Refresh Failed
                      </span>
                    )}
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    {questionSet.questionCount || 0} questions
                    {questionSet.isShared && questionSet.sharedCourses && (
                      <span className="ml-2 text-xs text-green-600">
                        • Also used by {questionSet.sharedCourses.map((c: any) => `${c.courseNumber} ${c.isAi ? 'AI' : 'Non-AI'}`).join(', ')}
                      </span>
                    )}
                  </p>
                  {refreshError && (
                    <div className="mt-2 p-2 bg-red-100 rounded text-xs text-red-700">
                      <div className="font-semibold">Error: {refreshError.error}</div>
                      {refreshError.details && (
                        <div className="mt-1 italic">{refreshError.details}</div>
                      )}
                    </div>
                  )}
                </div>
              <div className="flex gap-2">
                {questionSet.externalId && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      setRefreshingQuestionSet(questionSet.id);
                      getRefreshComparisonMutation.mutate(questionSet.id);
                    }}
                    disabled={refreshingQuestionSet === questionSet.id}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${refreshingQuestionSet === questionSet.id ? 'animate-spin' : ''}`} />
                    {refreshingQuestionSet === questionSet.id ? "Loading..." : "Refresh Content"}
                  </Button>
                )}
                <Link href={`/admin/questions/${courseId}/${questionSet.id}`}>
                  <Button 
                    variant="outline" 
                    size="sm"
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit Questions
                  </Button>
                </Link>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setImportModalOpen(questionSet.id);
                    setImportJsonData("");
                  }}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Import Questions
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="secondary" size="sm">
                      <Eye className="h-4 w-4 mr-2" />
                      View Questions
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>
                        Questions in {questionSet.title}
                        {questionSet.isShared && (
                          <span className="ml-2 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                            🔗 Shared
                          </span>
                        )}
                      </DialogTitle>
                    </DialogHeader>
                    <QuestionsList questionSetId={questionSet.id} />
                  </DialogContent>
                </Dialog>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Question Set</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete "{questionSet.title}"? 
                        This will permanently delete all {questionSet.questionCount || 0} questions in this set. 
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => deleteQuestionSetMutation.mutate(questionSet.id)}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <p className="text-gray-500 text-sm">No question sets found for this course.</p>
        </div>
      )}

      {/* Import Questions Modal */}
      <Dialog open={importModalOpen !== null} onOpenChange={(open) => !open && setImportModalOpen(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Import Questions</DialogTitle>
            <DialogDescription>
              Paste your JSON data below. The format should be an array of question objects with the structure matching the question import schema.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="json-import">JSON Data</Label>
              <Textarea
                id="json-import"
                placeholder='[{"question_number": 1, "type": "multiple_choice", "loid": "LO1", "versions": [...]}]'
                value={importJsonData}
                onChange={(e) => setImportJsonData(e.target.value)}
                rows={15}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setImportModalOpen(null);
                setImportJsonData("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => importModalOpen && handleImport(importModalOpen)}
              disabled={importQuestionsMutation.isPending}
            >
              {importQuestionsMutation.isPending ? "Importing..." : "Import Questions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refresh Content Confirmation Dialog */}
      <Dialog open={refreshModalOpen !== null} onOpenChange={(open) => !open && setRefreshModalOpen(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              Refresh Content: {refreshComparisonData?.questionSet?.title}
            </DialogTitle>
            <DialogDescription>
              <strong>⚠️ PREVIEW ONLY:</strong> Review the changes that would be made to this question set. 
              <strong>No data has been changed yet.</strong> You must click "Confirm Refresh" below to actually apply these changes.
            </DialogDescription>
          </DialogHeader>
          
          {refreshComparisonData && (
            <div className="space-y-6">
              {/* Summary Section */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2">Summary of Changes</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="text-center">
                    <div className="text-lg font-semibold text-blue-700">{refreshComparisonData.summary.currentCount}</div>
                    <div className="text-blue-600">Current Questions</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-green-700">{refreshComparisonData.summary.newCount}</div>
                    <div className="text-green-600">New Questions</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-amber-700">{refreshComparisonData.summary.willBeUpdated}</div>
                    <div className="text-amber-600">Will Be Updated</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-red-700">{refreshComparisonData.summary.willBeRemoved}</div>
                    <div className="text-red-600">Will Be Removed</div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <div className="text-center">
                    <div className="text-lg font-semibold text-blue-900">{refreshComparisonData.summary.totalAfterRefresh}</div>
                    <div className="text-blue-700">Total After Refresh</div>
                  </div>
                </div>
              </div>

              {/* Side-by-Side Comparison */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Current Questions */}
                <div className="space-y-3">
                  <h3 className="font-medium text-gray-900 border-b pb-2">
                    Current Questions ({refreshComparisonData.currentQuestions.length})
                  </h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {refreshComparisonData.currentQuestions.length > 0 ? (
                      refreshComparisonData.currentQuestions.map((q: any, index: number) => (
                        <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="font-medium text-sm">Q{q.questionNumber}</div>
                              <div className="text-xs text-gray-600">LOID: {q.loid}</div>
                              <div className="text-xs text-gray-500 mt-1">{q.preview}</div>
                            </div>
                            <div className="text-xs text-gray-500">
                              {q.versionCount} version{q.versionCount !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500">No current questions</div>
                    )}
                  </div>
                </div>

                {/* New Questions */}
                <div className="space-y-3">
                  <h3 className="font-medium text-gray-900 border-b pb-2">
                    New Questions ({refreshComparisonData.newQuestions.length})
                  </h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {refreshComparisonData.newQuestions.length > 0 ? (
                      refreshComparisonData.newQuestions.map((q: any, index: number) => (
                        <div key={index} className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="font-medium text-sm">Q{q.questionNumber}</div>
                              <div className="text-xs text-gray-600">LOID: {q.loid}</div>
                              <div className="text-xs text-gray-600">Type: {q.type}</div>
                              <div className="text-xs text-gray-500 mt-1">{q.preview}</div>
                            </div>
                            <div className="text-xs text-gray-500">
                              {q.versionCount} version{q.versionCount !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500">No new questions</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Warning Section */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold mt-0.5">!</div>
                  <div>
                    <h4 className="font-medium text-red-900">Final Warning: This action cannot be undone</h4>
                    <p className="text-sm text-red-700 mt-1">
                      <strong>ONLY clicking "Confirm Refresh" below will change your data.</strong><br/>
                      This will completely replace all current questions in this question set with the latest data from Bubble. 
                      Any existing questions not found in Bubble will be permanently deleted.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setRefreshModalOpen(null);
                setRefreshComparisonData(null);
                setRefreshingQuestionSet(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (refreshModalOpen) {
                  performRefreshMutation.mutate(refreshModalOpen);
                }
              }}
              disabled={performRefreshMutation.isPending}
            >
              {performRefreshMutation.isPending ? "Refreshing..." : "Confirm Refresh"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QuestionsList({ questionSetId }: { questionSetId: number }) {
  const { data: questions, isLoading } = useQuery({
    queryKey: ["/api/admin/questions", questionSetId],
    queryFn: () => fetch(`/api/admin/questions/${questionSetId}`).then(res => res.json()),
  });

  if (isLoading) {
    return <div className="text-center py-4">Loading questions...</div>;
  }

  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No questions found in this set.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-h-96 overflow-y-auto">
      {questions.map((question: any, index: number) => (
        <div key={question.id} className="border rounded-lg p-4">
          <div className="flex justify-between items-start mb-2">
            <h4 className="font-medium text-sm">
              Question {question.originalQuestionNumber || index + 1}
            </h4>
            <span className="text-xs bg-secondary px-2 py-1 rounded">
              {question.questionType?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Multiple Choice'}
            </span>
          </div>
          
          <p className="text-sm mb-3 leading-relaxed">{question.questionText}</p>
          
          {question.answerChoices && Array.isArray(question.answerChoices) && (
            <div className="space-y-1 mb-3">
              {question.answerChoices.map((choice: string, choiceIndex: number) => (
                <div 
                  key={choiceIndex} 
                  className={`text-xs p-2 rounded border ${
                    choice.charAt(0) === question.correctAnswer 
                      ? 'bg-green-50 border-green-200 text-green-800' 
                      : 'bg-gray-50'
                  }`}
                >
                  {choice}
                  {choice.charAt(0) === question.correctAnswer && (
                    <span className="ml-2 text-green-600 font-medium">✓ Correct</span>
                  )}
                </div>
              ))}
            </div>
          )}
          
          <div className="text-xs text-muted-foreground">
            Correct Answer: {question.correctAnswer}
          </div>
        </div>
      ))}
    </div>
  );
}