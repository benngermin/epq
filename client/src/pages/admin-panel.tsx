import { useState, useCallback, lazy, Suspense } from "react";
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
import { Plus, Edit, Trash2, Upload, Eye, LogOut, User, Shield, Download, CheckCircle, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import institutesLogo from "@assets/the-institutes-logo_1750194170496.png";

// Lazy load the AppLogsSection component to reduce initial bundle size
const AppLogsSection = lazy(() => import("@/components/app-logs-section").then(module => ({ default: module.AppLogsSection })));
import type { AiSettings, PromptVersion } from "@shared/schema";



const courseSchema = z.object({
  courseNumber: z.string().min(1, "Course number is required"),
  courseTitle: z.string().min(1, "Course title is required"),
});

const questionSetSchema = z.object({
  title: z.string().min(1, "Question set title is required"),
  courseId: z.number().min(1, "Course selection is required"),
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
  const [activeTab, setActiveTab] = useState("content");
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
    defaultValues: { title: "", courseId: 0 },
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
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <header className="border-b">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <img src={institutesLogo} alt="The Institutes" className="h-8" />
              <div className="border-l h-6"></div>
              <h1 className="text-xl font-semibold">Exam Practice Questions</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-2">
                    <div className="bg-blue-100 p-2 rounded-full">
                      <User className="h-4 w-4 text-blue-600" />
                    </div>
                    <span className="text-sm font-medium">{user?.name}</span>
                    {user?.isAdmin && <Shield className="h-4 w-4 text-blue-600" />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setLocation("/dashboard")}>
                    Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => logoutMutation.mutate()}
                    className="text-red-600"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>
      <div className="container mx-auto py-8 px-4">

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
                <div className="bg-white rounded-lg p-6 shadow-sm mb-8">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex gap-3">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="lg">
                          <Download className="w-5 h-5 mr-2" />
                          Import Content
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Import Content from Bubble.io</DialogTitle>
                          <DialogDescription>
                            Choose what type of content you want to import from the Bubble.io repository
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
                            {importLearningObjectsMutation.isPending ? "Importing..." : "Import Learning Objects"}
                          </Button>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" className="w-full justify-start" size="lg">
                                <Upload className="w-5 h-5 mr-2" />
                                Import Question Sets
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Import Question Sets from Bubble Repository</DialogTitle>
                                <DialogDescription>
                                  Fetch and import question sets from ti-content-repository.bubbleapps.io
                                </DialogDescription>
                              </DialogHeader>
                              <BubbleImportSection />
                            </DialogContent>
                          </Dialog>
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
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline">
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
                  </div>
                </div>

                <div className="space-y-6">
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
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <QuestionSetsSection courseId={course.id} isAiCourse={course.isAi} />
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

                {/* Course Materials Management Section */}
                <div className="mt-8 bg-white rounded-lg p-6 shadow-sm">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">Course Materials</h2>
                      <p className="text-gray-600 text-sm mt-1">View and manage uploaded course materials</p>
                    </div>
                    <Button 
                      onClick={() => setCourseMaterialsDialogOpen(true)}
                      variant="outline"
                      className="shadow-sm"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Import CSV
                    </Button>
                  </div>
                  <CourseMaterialsSection />
                </div>
              </div>
            </div>
            </TabsContent>

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


          </div>
        </Tabs>
      </div>
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
              <div className="max-h-96 overflow-y-auto space-y-3 pr-2">
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

function QuestionSetsSection({ courseId, isAiCourse }: { courseId: number; isAiCourse?: boolean }) {
  const { data: questionSets, isLoading: questionSetsLoading } = useQuery({
    queryKey: ["/api/admin/question-sets", courseId],
    queryFn: () => fetch(`/api/admin/question-sets/${courseId}`).then(res => res.json()),
  });

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
            .map((questionSet: any) => (
            <div key={questionSet.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex-1">
                <h4 className="font-medium text-gray-900">
                  {questionSet.title}
                  {isAiCourse !== undefined && (
                    <span className={`ml-2 px-2 py-0.5 text-xs font-medium rounded-full ${
                      isAiCourse 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {isAiCourse ? 'AI' : 'Non-AI'}
                    </span>
                  )}
                </h4>
                <p className="text-sm text-gray-600 mt-1">{questionSet.questionCount || 0} questions</p>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="secondary" size="sm" className="ml-4">
                    <Eye className="h-4 w-4 mr-2" />
                    View Questions
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      Questions in {questionSet.title}
                      {isAiCourse !== undefined && (
                        <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${
                          isAiCourse 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {isAiCourse ? 'AI' : 'Non-AI'}
                        </span>
                      )}
                    </DialogTitle>
                  </DialogHeader>
                  <QuestionsList questionSetId={questionSet.id} isAiCourse={isAiCourse} />
                </DialogContent>
              </Dialog>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <p className="text-gray-500 text-sm">No question sets found for this course.</p>
        </div>
      )}
    </div>
  );
}

function QuestionsList({ questionSetId, isAiCourse }: { questionSetId: number; isAiCourse?: boolean }) {
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
              {isAiCourse !== undefined && (
                <span className={`ml-2 px-1.5 py-0.5 text-xs font-medium rounded ${
                  isAiCourse 
                    ? 'bg-blue-50 text-blue-600' 
                    : 'bg-gray-50 text-gray-600'
                }`}>
                  {isAiCourse ? 'AI' : 'Non-AI'}
                </span>
              )}
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