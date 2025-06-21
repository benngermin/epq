import { useState, useCallback } from "react";
import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Upload, Eye, LogOut, User, Shield } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import institutesLogo from "@assets/the-institutes-logo_1750194170496.png";

const courseSchema = z.object({
  title: z.string().min(1, "Course title is required"),
  description: z.string().optional(),
});

const questionSetSchema = z.object({
  title: z.string().min(1, "Question set title is required"),
  courseId: z.number().min(1, "Course selection is required"),
});

const aiSettingsSchema = z.object({
  modelName: z.string().min(1, "Model is required"),
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().min(1).max(4000),
});

const promptSchema = z.object({
  promptText: z.string().min(1, "Prompt text is required"),
});

// AI Settings Component
function AISettingsSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Query for AI settings
  const { data: aiSettings, isLoading: aiSettingsLoading } = useQuery({
    queryKey: ["/api/admin/ai-settings"],
  });

  // Query for active prompt
  const { data: activePrompt, isLoading: promptLoading } = useQuery({
    queryKey: ["/api/admin/active-prompt"],
  });

  const aiSettingsForm = useForm<z.infer<typeof aiSettingsSchema>>({
    resolver: zodResolver(aiSettingsSchema),
    defaultValues: {
      modelName: "anthropic/claude-sonnet-4",
      temperature: 0.7,
      maxTokens: 1000,
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
        modelName: aiSettings.modelName || "anthropic/claude-sonnet-4",
        temperature: aiSettings.temperature || 0.7,
        maxTokens: aiSettings.maxTokens || 1000,
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
                    <FormLabel>AI Model</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select AI model" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="openai/gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                          <SelectItem value="openai/gpt-4">GPT-4</SelectItem>
                          <SelectItem value="anthropic/claude-3-haiku">Claude 3 Haiku</SelectItem>
                          <SelectItem value="anthropic/claude-3-sonnet">Claude 3 Sonnet</SelectItem>
                          <SelectItem value="anthropic/claude-sonnet-4">Claude Sonnet 4</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={aiSettingsForm.control}
                name="temperature"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Temperature ({field.value})</FormLabel>
                    <FormControl>
                      <Input
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        className="w-full"
                      />
                    </FormControl>
                    <div className="text-xs text-muted-foreground">
                      Higher values make output more random, lower values more deterministic
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={aiSettingsForm.control}
                name="maxTokens"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Tokens</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        max="4000"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <div className="text-xs text-muted-foreground">
                      Maximum number of tokens in the response
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
                      This prompt guides how the AI responds to student questions. Use template variables: {"{"}{"{"} QUESTION_TEXT {"}"}{"}"},  {"{"}{"{"} ANSWER_CHOICES {"}"}{"}"},  {"{"}{"{"} SELECTED_ANSWER {"}"}{"}"},  {"{"}{"{"} CORRECT_ANSWER {"}"}{"}"},  {"{"}{"{"} SOURCE_MATERIAL {"}"}{"}"} 
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
    defaultValues: { title: "", description: "" },
  });

  const editCourseForm = useForm<z.infer<typeof courseSchema>>({
    resolver: zodResolver(courseSchema),
    defaultValues: { title: "", description: "" },
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
      
      console.log(`Parsed ${materials.length} complete materials from CSV`);
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
              <h1 className="text-xl font-semibold">CPCU 500 Learning Platform</h1>
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Admin Panel</h1>
          <p className="text-muted-foreground mt-2">Manage courses, questions, and system settings</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="content">Content Management</TabsTrigger>
            <TabsTrigger value="uploads">Import & Upload</TabsTrigger>
            <TabsTrigger value="settings">AI & Settings</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>

          <div className="space-y-6">
            {/* Content Management Tab */}
            <TabsContent value="content">
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">Content Management</h1>
                    <p className="text-muted-foreground mt-2">Manage courses, question sets, and course materials</p>
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button>
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
                            name="title"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Course Title</FormLabel>
                                <FormControl>
                                  <Input placeholder="Enter course title" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={courseForm.control}
                            name="description"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Description (Optional)</FormLabel>
                                <FormControl>
                                  <Textarea placeholder="Enter course description" {...field} />
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

                <div className="grid gap-6">
                  {coursesLoading ? (
                    <div className="text-center py-8">Loading courses...</div>
                  ) : courses && Array.isArray(courses) && courses.length > 0 ? (
                    (courses as any[]).map((course: any) => (
                      <Card key={course.id}>
                        <CardHeader>
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle>{course.title}</CardTitle>
                              <CardDescription>{course.description}</CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <QuestionSetsSection courseId={course.id} />
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
                <div className="mt-8">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h2 className="text-xl font-semibold text-foreground">Course Materials</h2>
                      <p className="text-muted-foreground text-sm">View and manage uploaded course materials</p>
                    </div>
                  </div>
                  <CourseMaterialsSection />
                </div>
              </div>
            </TabsContent>

            {/* Import & Upload Tab */}
            <TabsContent value="uploads">
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">Import & Upload</h1>
                    <p className="text-muted-foreground mt-2">Upload course materials and question sets</p>
                  </div>
                </div>

                <div className="grid gap-6">
                  {/* Course Materials Upload Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        Course Materials Upload
                        <Button 
                          onClick={() => setCourseMaterialsDialogOpen(true)}
                          className="text-sm"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Import CSV
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        Course materials provide context for the AI chatbot when students get questions wrong. 
                        Each material is linked to questions via LOID (Learning Objective ID).
                      </p>
                      <div className="text-sm">
                        <p>Upload a CSV file with columns: assignment, course, loid, value</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Question Sets Upload Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        Question Sets Upload
                        <Dialog open={standaloneQuestionSetDialogOpen} onOpenChange={setStandaloneQuestionSetDialogOpen}>
                          <DialogTrigger asChild>
                            <Button>
                              <Plus className="h-4 w-4 mr-2" />
                              Create Question Set
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Create New Question Set</DialogTitle>
                              <DialogDescription>
                                Create a question set and assign it to a course
                              </DialogDescription>
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
                                        <Input placeholder="Enter question set title" {...field} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={standaloneQuestionSetForm.control}
                                  name="courseId"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Course</FormLabel>
                                      <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                                        <FormControl>
                                          <SelectTrigger>
                                            <SelectValue placeholder="Select a course" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {Array.isArray(courses) && courses.map((course: any) => (
                                            <SelectItem key={course.id} value={course.id.toString()}>
                                              {course.title}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
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
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        Create new question sets or upload questions to existing ones using JSON format.
                      </p>
                      
                      {questionSetsLoading ? (
                        <div className="text-center py-4">Loading question sets...</div>
                      ) : allQuestionSets && Array.isArray(allQuestionSets) && allQuestionSets.length > 0 ? (
                        <div className="space-y-4">
                          {(allQuestionSets as any[]).map((questionSet: any) => (
                            <div key={questionSet.id} className="border rounded-lg p-4">
                              <div className="flex justify-between items-center">
                                <div>
                                  <h4 className="font-medium">{questionSet.title}</h4>
                                  <p className="text-sm text-muted-foreground">
                                    Course ID: {questionSet.courseId} • {questionSet.questionCount || 0} questions
                                  </p>
                                </div>
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button variant="outline" size="sm">
                                      <Upload className="h-4 w-4 mr-1" />
                                      Import Questions
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Import Questions</DialogTitle>
                                      <DialogDescription>
                                        Upload questions to {questionSet.title}
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                      <div className="space-y-2">
                                        <Label htmlFor="json-data">Question Data (JSON format)</Label>
                                        <Textarea
                                          placeholder="Paste your questions JSON here..."
                                          value={selectedQuestionSetForImport === questionSet.id ? bulkImportData.jsonData : ''}
                                          onChange={(e) => {
                                            setSelectedQuestionSetForImport(questionSet.id);
                                            setBulkImportData(prev => ({ ...prev, jsonData: e.target.value }));
                                          }}
                                          className="font-mono text-sm"
                                          rows={6}
                                        />
                                      </div>
                                      <Button 
                                        onClick={() => {
                                          try {
                                            const questions = JSON.parse(bulkImportData.jsonData);
                                            importQuestionsMutation.mutate({
                                              questionSetId: questionSet.id,
                                              questions: questions,
                                            });
                                          } catch (error) {
                                            toast({
                                              title: "Invalid JSON",
                                              description: "Please check your JSON format",
                                              variant: "destructive",
                                            });
                                          }
                                        }}
                                        disabled={!bulkImportData.jsonData || importQuestionsMutation.isPending}
                                        className="w-full"
                                      >
                                        {importQuestionsMutation.isPending ? "Importing..." : "Import Questions"}
                                      </Button>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <p className="text-muted-foreground">No question sets found.</p>
                          <p className="text-sm text-muted-foreground mt-1">Create your first question set using the button above.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* AI & Settings Tab */}
            <TabsContent value="settings">
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-foreground">AI & Settings</h1>
                  <p className="text-muted-foreground mt-2">Configure AI model parameters and behavior</p>
                </div>

                <AISettingsSection />
              </div>
            </TabsContent>

            {/* Logs Tab */}
            <TabsContent value="logs">
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Chatbot Logs</h1>
                  <p className="text-muted-foreground mt-2">View all chatbot interactions and AI model usage</p>
                </div>

                <ChatbotLogsSection />
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
      <Card>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="text-center py-4">Loading course materials...</div>
          ) : materials && Array.isArray(materials) && materials.length > 0 ? (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Total: {materials.length} course materials across {new Set(materials.map((m: any) => m.loid)).size} unique LOIDs
              </div>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {materials.map((material: any) => (
                  <div key={material.id} className="border rounded p-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{material.assignment}</h4>
                        <p className="text-xs text-muted-foreground">
                          Course: {material.course} • LOID: {material.loid}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {material.content.substring(0, 100)}...
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setViewingMaterial(material)}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingMaterial(material)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Trash2 className="h-3 w-3" />
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
            <div className="text-center py-8">
              <p className="text-muted-foreground">No course materials found.</p>
              <p className="text-sm text-muted-foreground mt-2">
                Upload course materials in the Import & Upload tab to provide context for the AI chatbot.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

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

function QuestionSetsSection({ courseId }: { courseId: number }) {
  const { data: questionSets, isLoading: questionSetsLoading } = useQuery({
    queryKey: ["/api/admin/question-sets", courseId],
    queryFn: () => fetch(`/api/admin/question-sets/${courseId}`).then(res => res.json()),
  });

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Question Sets</h3>
      {questionSetsLoading ? (
        <div className="text-center py-4">Loading question sets...</div>
      ) : questionSets && Array.isArray(questionSets) && questionSets.length > 0 ? (
        <div className="space-y-2">
          {questionSets
            .sort((a: any, b: any) => {
              const aNum = parseInt(a.title.match(/\d+/)?.[0] || '0');
              const bNum = parseInt(b.title.match(/\d+/)?.[0] || '0');
              return aNum - bNum;
            })
            .map((questionSet: any) => (
            <div key={questionSet.id} className="flex justify-between items-center p-3 border rounded">
              <div>
                <h4 className="font-medium">{questionSet.title}</h4>
                <p className="text-sm text-muted-foreground">{questionSet.questionCount || 0} questions</p>
              </div>
              <div className="flex gap-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4 mr-1" />
                      View Questions
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Questions in {questionSet.title}</DialogTitle>
                    </DialogHeader>
                    <QuestionsList questionSetId={questionSet.id} />
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-muted-foreground">No question sets found for this course.</p>
        </div>
      )}
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
            <h4 className="font-medium text-sm">Question {question.originalQuestionNumber || index + 1}</h4>
            <span className="text-xs bg-secondary px-2 py-1 rounded">
              {question.topicFocus || 'General'}
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