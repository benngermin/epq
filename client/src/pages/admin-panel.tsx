import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Settings, Home, BookOpen, FileText, HelpCircle, Upload, Bot, Users, Edit, Trash2, Plus, Eye, ChevronDown, User, GraduationCap, LogOut } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import institutesLogo from "@assets/the-institutes-logo_1750194170496.png";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCourseSchema, insertQuestionSetSchema } from "@shared/schema";
import { z } from "zod";

export default function AdminPanel() {
  const { user, logoutMutation } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("courses");

  const { data: courses, isLoading: coursesLoading } = useQuery({
    queryKey: ["/api/admin/courses"],
  });

  const { data: aiSettings, isLoading: aiLoading } = useQuery({
    queryKey: ["/api/admin/ai-settings"],
  });

  const { data: practiceTests, isLoading: testsLoading } = useQuery({
    queryKey: ["/api/admin/practice-tests"],
  });

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["/api/admin/users"],
  });

  const { data: allQuestionSets, isLoading: questionSetsLoading } = useQuery({
    queryKey: ["/api/admin/question-sets"],
  });

  const { data: promptVersions, isLoading: promptVersionsLoading } = useQuery({
    queryKey: ["/api/admin/prompt-versions"],
  });

  // Course mutations
  const createCourseMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/courses", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courses"] });
      toast({ title: "Course created successfully" });
      courseForm.reset();
      setCreateCourseOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create course",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateCourseMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PUT", `/api/courses/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courses"] });
      toast({ title: "Course updated successfully" });
      setEditingCourse(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update course",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteCourseMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/courses/${id}`);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courses"] });
      toast({ title: "Course deleted successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete course",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Question set mutations
  const createQuestionSetMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/question-sets", data);
      return await res.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/question-sets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/question-sets", variables.courseId] });
      toast({ title: "Question set created successfully" });
      setQuestionSetDialogOpen(false);
      setStandaloneQuestionSetDialogOpen(false);
      questionSetForm.reset({ title: "" });
      standaloneQuestionSetForm.reset({ title: "", courseId: 0 });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create question set",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateQuestionSetMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PUT", `/api/admin/question-sets/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/question-sets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courses"] });
      toast({ title: "Question set updated successfully" });
      setEditingQuestionSet(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update question set",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteQuestionSetMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/question-sets/${id}`);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/question-sets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courses"] });
      toast({ title: "Question set deleted successfully" });
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
    mutationFn: async (data: { questionSetId: number; questions: any[] }) => {
      const res = await apiRequest("POST", "/api/admin/import-questions", data);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({ title: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/question-sets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/questions"] });
      setBulkImportData({ ...bulkImportData, jsonData: "", questionSetTitle: "" });
      setImportDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to import questions",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateAiSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PUT", "/api/admin/ai-settings", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai-settings"] });
      toast({ title: "AI settings updated successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update AI settings",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createPromptVersionMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/prompt-versions", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/prompt-versions"] });
      toast({ title: "Prompt version created successfully" });
      setNewPromptVersion({ versionName: "", promptText: "", modelName: "" });
      setAddVersionDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create prompt version",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updatePromptVersionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PUT", `/api/admin/prompt-versions/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/prompt-versions"] });
      toast({ title: "Prompt version updated successfully" });
      setEditingPromptVersion(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update prompt version",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const activatePromptVersionMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PUT", `/api/admin/prompt-versions/${id}/activate`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/prompt-versions"] });
      toast({ title: "Prompt version activated successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to activate prompt version",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // State management
  const [editingCourse, setEditingCourse] = useState<any>(null);
  const [editingQuestionSet, setEditingQuestionSet] = useState<any>(null);
  const [questionSetDialogOpen, setQuestionSetDialogOpen] = useState(false);
  const [standaloneQuestionSetDialogOpen, setStandaloneQuestionSetDialogOpen] = useState(false);
  const [createCourseOpen, setCreateCourseOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedCourseForQuestionSet, setSelectedCourseForQuestionSet] = useState<number | null>(null);
  const [selectedQuestionSetForImport, setSelectedQuestionSetForImport] = useState<number | null>(null);
  const [editingPromptVersion, setEditingPromptVersion] = useState<any>(null);
  const [addVersionDialogOpen, setAddVersionDialogOpen] = useState(false);
  const [newPromptVersion, setNewPromptVersion] = useState({ versionName: "", promptText: "", modelName: "" });

  // Forms
  const courseForm = useForm({
    resolver: zodResolver(insertCourseSchema),
    defaultValues: {
      title: "",
      description: "",
    },
  });

  const editCourseForm = useForm({
    resolver: zodResolver(insertCourseSchema),
    defaultValues: {
      title: "",
      description: "",
    },
  });

  const questionSetForm = useForm({
    resolver: zodResolver(insertQuestionSetSchema.omit({ courseId: true, description: true })),
    defaultValues: {
      title: "",
    },
  });

  const standaloneQuestionSetForm = useForm({
    resolver: zodResolver(insertQuestionSetSchema.omit({ description: true })),
    defaultValues: {
      title: "",
      courseId: 0,
    },
  });

  const editQuestionSetForm = useForm({
    resolver: zodResolver(insertQuestionSetSchema.partial().omit({ description: true })),
    defaultValues: {
      title: "",
      courseId: 0,
    },
  });

  const [bulkImportData, setBulkImportData] = useState({
    courseId: "",
    questionSetTitle: "",
    jsonData: "",
  });

  const [isDragOver, setIsDragOver] = useState(false);

  const [aiSettingsData, setAiSettingsData] = useState({
    modelName: "anthropic/claude-4-sonnet-20250522",
    temperature: [0.7],
    maxTokens: [150],
  });

  const aiModels = [
    { name: "OpenAI O1 (2024-12-17)", value: "openai/o1-2024-12-17", maxTokens: 200000 },
    { name: "OpenAI O3 Mini (2025-01-31)", value: "openai/o3-mini-2025-01-31", maxTokens: 200000 },
    { name: "OpenAI O3 Mini High", value: "openai/o3-mini-high", maxTokens: 200000 },
    { name: "OpenAI O3 (2025-04-16)", value: "openai/o3-2025-04-16", maxTokens: 200000 },
    { name: "OpenAI O3 Pro (2025-06-10)", value: "openai/o3-pro-2025-06-10", maxTokens: 200000 },
    { name: "OpenAI O4 Mini (2025-04-16)", value: "openai/o4-mini-2025-04-16", maxTokens: 200000 },
    { name: "Claude 4 Sonnet (2025-05-22)", value: "anthropic/claude-4-sonnet-20250522", maxTokens: 200000 },
    { name: "Claude 4 Opus (2025-05-22)", value: "anthropic/claude-4-opus-20250522", maxTokens: 200000 },
    { name: "Gemini 2.5 Flash Lite Preview", value: "google/gemini-2.5-flash-lite-preview-06-17", maxTokens: 1048576 },
    { name: "Gemini 2.5 Flash", value: "google/gemini-2.5-flash", maxTokens: 1048576 },
    { name: "Gemini 2.5 Pro", value: "google/gemini-2.5-pro", maxTokens: 1048576 },
    { name: "Gemini 2.5 Pro Preview", value: "google/gemini-2.5-pro-preview-06-05", maxTokens: 1048576 },
    { name: "Gemini 2.5 Flash Preview (Thinking)", value: "google/gemini-2.5-flash-preview-05-20:thinking", maxTokens: 1048576 },
    { name: "GPT-4.1", value: "openai/gpt-4.1", maxTokens: 1000000 },
    { name: "GPT-4.1 Mini", value: "openai/gpt-4.1-mini", maxTokens: 1000000 },
    { name: "GPT-4.1 Nano", value: "openai/gpt-4.1-nano", maxTokens: 1000000 },
    { name: "GPT-4o", value: "openai/gpt-4o", maxTokens: 128000 },
    { name: "GPT-4o Mini", value: "openai/gpt-4o-mini", maxTokens: 128000 },
    { name: "Claude 3.5 Haiku Beta", value: "anthropic/claude-3-5-haiku-20241022:beta", maxTokens: 200000 },
  ];

  const getMaxTokensForModel = (modelValue: string) => {
    const model = aiModels.find(m => m.value === modelValue);
    return model ? model.maxTokens : 4000;
  };

  // Load AI settings data when available
  useEffect(() => {
    if (aiSettings) {
      setAiSettingsData({
        modelName: (aiSettings as any).modelName || "anthropic/claude-4-sonnet-20250522",
        temperature: [(aiSettings as any).temperature ? (aiSettings as any).temperature / 100 : 0.7],
        maxTokens: [(aiSettings as any).maxTokens || 150],
      });
    }
  }, [aiSettings]);

  // Check admin access
  if (!user?.isAdmin && user?.email !== "demo@example.com") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Access Denied</h1>
          <p className="text-muted-foreground mb-4">You need administrator privileges to access this page.</p>
          <Button onClick={() => setLocation("/")}>Return to Dashboard</Button>
        </div>
      </div>
    );
  }

  // Event handlers
  const onCreateCourse = (data: any) => {
    createCourseMutation.mutate(data);
  };

  const onCreateQuestionSet = (data: any) => {
    if (!selectedCourseForQuestionSet) return;
    createQuestionSetMutation.mutate({ ...data, courseId: selectedCourseForQuestionSet });
  };

  const onCreateStandaloneQuestionSet = (data: any) => {
    createQuestionSetMutation.mutate(data);
  };

  const onEditQuestionSet = (questionSet: any) => {
    setEditingQuestionSet(questionSet);
    editQuestionSetForm.reset({
      title: questionSet.title,
    });
    editQuestionSetForm.setValue('courseId', questionSet.courseId);
  };

  const onUpdateQuestionSet = (data: any) => {
    if (editingQuestionSet) {
      updateQuestionSetMutation.mutate({ id: editingQuestionSet.id, data });
    }
  };

  const onDeleteQuestionSet = (id: number) => {
    deleteQuestionSetMutation.mutate(id);
  };

  const onEditCourse = (course: any) => {
    setEditingCourse(course);
    editCourseForm.reset({
      title: course.title,
      description: course.description,
    });
  };

  const onUpdateCourse = async (data: any) => {
    if (editingCourse) {
      updateCourseMutation.mutate({ id: editingCourse.id, data });
    }
  };

  const onDeleteCourse = async (id: number) => {
    deleteCourseMutation.mutate(id);
  };

  const handleFileRead = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setBulkImportData(prev => ({ ...prev, jsonData: content }));
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const jsonFile = files.find(file => file.type === 'application/json' || file.name.endsWith('.json'));
    
    if (jsonFile) {
      handleFileRead(jsonFile);
    } else {
      toast({
        title: "Invalid file type",
        description: "Please drop a JSON file",
        variant: "destructive",
      });
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileRead(file);
    }
  };

  const onBulkImport = () => {
    try {
      const questions = JSON.parse(bulkImportData.jsonData);
      
      // First create question set, then import questions
      const questionSetData = {
        courseId: parseInt(bulkImportData.courseId),
        title: bulkImportData.questionSetTitle,
      };

      createQuestionSetMutation.mutate(questionSetData, {
        onSuccess: (newQuestionSet) => {
          // Import questions to the newly created question set
          importQuestionsMutation.mutate({
            questionSetId: newQuestionSet.id,
            questions: questions,
          });
        },
      });
    } catch (error) {
      toast({
        title: "Invalid JSON",
        description: "Please check your JSON format",
        variant: "destructive",
      });
    }
  };

  const onUpdateAiSettings = () => {
    updateAiSettingsMutation.mutate({
      modelName: aiSettingsData.modelName,
      temperature: Math.round(aiSettingsData.temperature[0] * 100), // Convert back to 0-200 for storage
      maxTokens: aiSettingsData.maxTokens[0],
    });
  };

  // Component to display questions in a question set
  const QuestionsList = ({ questionSetId }: { questionSetId: number }) => {
    const { data: questions, isLoading } = useQuery({
      queryKey: ['/api/admin/questions', questionSetId],
      queryFn: () => fetch(`/api/admin/questions?questionSetId=${questionSetId}`).then(res => res.json()),
    });

    if (isLoading) {
      return <div className="text-center py-4">Loading questions...</div>;
    }

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <p>No questions found in this question set.</p>
          <p className="text-sm mt-2">Use the "Import Questions" button to add questions.</p>
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
  };

  // Component for displaying question sets within a course
  const QuestionSetsSection = ({ courseId }: { courseId: number }) => {
    const { data: questionSets, isLoading: questionSetsLoading } = useQuery({
      queryKey: ["/api/admin/question-sets", courseId],
      queryFn: () => fetch(`/api/admin/question-sets/${courseId}`).then(res => res.json()),
    });

    const deleteQuestionSetMutation = useMutation({
      mutationFn: async (id: number) => {
        const res = await apiRequest("DELETE", `/api/admin/question-sets/${id}`);
        return res;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/question-sets", courseId] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/courses"] });
        toast({ title: "Question set deleted successfully" });
      },
      onError: (error: Error) => {
        toast({
          title: "Failed to delete question set",
          description: error.message,
          variant: "destructive",
        });
      },
    });

    if (questionSetsLoading) {
      return <div className="text-sm text-muted-foreground">Loading question sets...</div>;
    }

    if (!questionSets || questionSets.length === 0) {
      return (
        <div className="text-sm text-muted-foreground">
          No question sets found. Create a question set to add questions to this course.
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {questionSets.map((questionSet: any) => (
          <div key={questionSet.id} className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-medium">{questionSet.title}</h4>
                {questionSet.description && (
                  <p className="text-sm text-muted-foreground">{questionSet.description}</p>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                {questionSet.questionCount || 0} questions
              </div>
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
                    <DialogDescription>
                      View all questions in this question set
                    </DialogDescription>
                  </DialogHeader>
                  <QuestionsList questionSetId={questionSet.id} />
                </DialogContent>
              </Dialog>
              
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
                      
                      {!(selectedQuestionSetForImport === questionSet.id && bulkImportData.jsonData) ? (
                        <div 
                          className={`relative border-2 border-dashed rounded-lg p-6 transition-all duration-200 ${
                            isDragOver 
                              ? 'border-primary bg-primary/10 scale-[1.02]' 
                              : 'border-gray-300 hover:border-primary/50 hover:bg-gray-50/50'
                          }`}
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => {
                            handleDrop(e);
                            setSelectedQuestionSetForImport(questionSet.id);
                          }}
                        >
                          <input
                            type="file"
                            accept=".json,application/json"
                            onChange={(e) => {
                              handleFileInput(e);
                              setSelectedQuestionSetForImport(questionSet.id);
                            }}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                          
                          <div className="text-center">
                            <div className="mb-3">
                              <Upload className="h-10 w-10 mx-auto text-gray-400" />
                            </div>
                            <h3 className="text-base font-semibold text-gray-900 mb-2">Upload JSON File</h3>
                            <p className="text-sm text-gray-600 mb-3">
                              Drag and drop your questions file here, or click to browse
                            </p>
                            <div className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                              Browse Files
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-center">
                              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                                <Upload className="h-4 w-4 text-green-600" />
                              </div>
                              <span className="text-sm font-medium text-green-800">JSON data loaded</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setBulkImportData(prev => ({ ...prev, jsonData: "" }));
                                setSelectedQuestionSetForImport(null);
                              }}
                              className="text-green-700 hover:text-green-900"
                            >
                              Clear
                            </Button>
                          </div>
                          <Textarea
                            id="json-data"
                            placeholder="Paste your JSON data here..."
                            rows={8}
                            value={selectedQuestionSetForImport === questionSet.id ? bulkImportData.jsonData : ''}
                            onChange={(e) => {
                              setSelectedQuestionSetForImport(questionSet.id);
                              setBulkImportData(prev => ({ ...prev, jsonData: e.target.value }));
                            }}
                            className="font-mono text-sm"
                          />
                        </div>
                      )}
                      
                      {!(selectedQuestionSetForImport === questionSet.id && bulkImportData.jsonData) && (
                        <div className="text-center">
                          <p className="text-sm text-gray-500 mb-2">Or paste your JSON data directly:</p>
                          <Textarea
                            placeholder="Paste your questions JSON here..."
                            value={selectedQuestionSetForImport === questionSet.id ? bulkImportData.jsonData : ''}
                            onChange={(e) => {
                              setSelectedQuestionSetForImport(questionSet.id);
                              setBulkImportData(prev => ({ ...prev, jsonData: e.target.value }));
                            }}
                            rows={4}
                            className="font-mono text-sm"
                          />
                        </div>
                      )}
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
                      disabled={importQuestionsMutation.isPending || !bulkImportData.jsonData}
                      className="w-full"
                    >
                      {importQuestionsMutation.isPending ? "Importing..." : "Import Questions"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Question Set</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete "{questionSet.title}"? This will also delete all questions within this set. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteQuestionSetMutation.mutate(questionSet.id)}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="bg-card shadow-sm border-b border-border/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center cursor-pointer" onClick={() => setLocation("/")}>
              <img src={institutesLogo} alt="The Institutes" className="h-6 w-6 text-primary mr-3" />
              <span className="font-semibold text-foreground">Exam Question Practice - Admin Panel</span>
            </div>
            <div className="flex items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-2 hover:bg-muted">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground">
                      <User className="h-4 w-4" />
                    </div>
                    <span className="hidden sm:block font-medium">{user?.name}</span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem 
                    onClick={() => setLocation("/")}
                    className="flex items-center space-x-2 cursor-pointer"
                  >
                    <GraduationCap className="h-4 w-4" />
                    <span>Dashboard</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setLocation("/admin")}
                    className="flex items-center space-x-2 cursor-pointer bg-accent"
                  >
                    <Settings className="h-4 w-4" />
                    <span>Admin</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => logoutMutation.mutate()}
                    className="flex items-center space-x-2 cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="courses" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Courses
            </TabsTrigger>
            <TabsTrigger value="question-sets" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Question Sets
            </TabsTrigger>
            <TabsTrigger value="import" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Bulk Import
            </TabsTrigger>
            <TabsTrigger value="ai" className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              AI Settings
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
          </TabsList>

          {/* Courses Tab */}
          <TabsContent value="courses">
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Course Management</h1>
                  <p className="text-muted-foreground mt-2">Manage courses and their question sets</p>
                </div>
                <Dialog open={createCourseOpen} onOpenChange={setCreateCourseOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Course
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Course</DialogTitle>
                      <DialogDescription>
                        Add a new course to the system
                      </DialogDescription>
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
                              <FormLabel>Description</FormLabel>
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
                ) : courses && Array.isArray(courses) ? (
                  courses.map((course: any) => (
                    <Card key={course.id}>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle>{course.title}</CardTitle>
                            <CardDescription>{course.description}</CardDescription>
                            <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                              <span>{course.questionSetCount || 0} question sets</span>
                              <span>{course.questionCount || 0} questions</span>
                              <span>{course.testCount || 0} practice tests</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => onEditCourse(course)}>
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            <Dialog open={questionSetDialogOpen} onOpenChange={setQuestionSetDialogOpen}>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm" onClick={() => setSelectedCourseForQuestionSet(course.id)}>
                                  <Plus className="h-4 w-4 mr-1" />
                                  Add Question Set
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Create Question Set</DialogTitle>
                                  <DialogDescription>
                                    Create a new question set for {course.title}
                                  </DialogDescription>
                                </DialogHeader>
                                <Form {...questionSetForm}>
                                  <form onSubmit={questionSetForm.handleSubmit(onCreateQuestionSet)} className="space-y-4">
                                    <FormField
                                      control={questionSetForm.control}
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

                                    <DialogFooter>
                                      <Button type="submit" disabled={createQuestionSetMutation.isPending}>
                                        {createQuestionSetMutation.isPending ? "Creating..." : "Create Question Set"}
                                      </Button>
                                    </DialogFooter>
                                  </form>
                                </Form>
                              </DialogContent>
                            </Dialog>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Delete
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Course</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{course.title}"? This will also delete all question sets and practice tests associated with this course. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => onDeleteCourse(course.id)}>
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
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
            </div>
          </TabsContent>

          {/* Question Sets Tab */}
          <TabsContent value="question-sets">
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Question Set Management</h1>
                  <p className="text-muted-foreground mt-2">Manage all question sets independently from courses</p>
                </div>
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
              </div>

              <div className="grid gap-6">
                {questionSetsLoading ? (
                  <div className="text-center py-8">Loading question sets...</div>
                ) : allQuestionSets && Array.isArray(allQuestionSets) ? (
                  allQuestionSets.map((questionSet: any) => (
                    <Card key={questionSet.id}>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle>{questionSet.title}</CardTitle>
                            <CardDescription>{questionSet.description}</CardDescription>
                            <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                              <span>Course: {questionSet.course?.title || 'No course assigned'}</span>
                              <span>{questionSet.questionCount || 0} questions</span>
                            </div>
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
                                  <DialogDescription>
                                    View all questions in this question set
                                  </DialogDescription>
                                </DialogHeader>
                                <QuestionsList questionSetId={questionSet.id} />
                              </DialogContent>
                            </Dialog>
                            
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
                                    
                                    {!(selectedQuestionSetForImport === questionSet.id && bulkImportData.jsonData) ? (
                                      <div 
                                        className={`relative border-2 border-dashed rounded-lg p-6 transition-all duration-200 ${
                                          isDragOver 
                                            ? 'border-primary bg-primary/10 scale-[1.02]' 
                                            : 'border-gray-300 hover:border-primary/50 hover:bg-gray-50/50'
                                        }`}
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={(e) => {
                                          handleDrop(e);
                                          setSelectedQuestionSetForImport(questionSet.id);
                                        }}
                                      >
                                        <input
                                          type="file"
                                          accept=".json,application/json"
                                          onChange={(e) => {
                                            handleFileInput(e);
                                            setSelectedQuestionSetForImport(questionSet.id);
                                          }}
                                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        />
                                        
                                        <div className="text-center">
                                          <div className="mb-3">
                                            <Upload className="h-10 w-10 mx-auto text-gray-400" />
                                          </div>
                                          <h3 className="text-base font-semibold text-gray-900 mb-2">Upload JSON File</h3>
                                          <p className="text-sm text-gray-600 mb-3">
                                            Drag and drop your questions file here, or click to browse
                                          </p>
                                          <div className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                                            Browse Files
                                          </div>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="space-y-3">
                                        <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                                          <div className="flex items-center">
                                            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                                              <Upload className="h-4 w-4 text-green-600" />
                                            </div>
                                            <span className="text-sm font-medium text-green-800">JSON data loaded</span>
                                          </div>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                              setBulkImportData(prev => ({ ...prev, jsonData: "" }));
                                              setSelectedQuestionSetForImport(null);
                                            }}
                                            className="text-green-700 hover:text-green-900"
                                          >
                                            Clear
                                          </Button>
                                        </div>
                                        <Textarea
                                          id="json-data"
                                          placeholder="Paste your JSON data here..."
                                          rows={10}
                                          value={selectedQuestionSetForImport === questionSet.id ? bulkImportData.jsonData : ''}
                                          onChange={(e) => {
                                            setSelectedQuestionSetForImport(questionSet.id);
                                            setBulkImportData(prev => ({ ...prev, jsonData: e.target.value }));
                                          }}
                                          className="font-mono text-sm"
                                        />
                                      </div>
                                    )}
                                    
                                    {!(selectedQuestionSetForImport === questionSet.id && bulkImportData.jsonData) && (
                                      <div className="text-center">
                                        <p className="text-sm text-gray-500 mb-2">Or paste your JSON data directly:</p>
                                        <Textarea
                                          placeholder="Paste your questions JSON here..."
                                          value={selectedQuestionSetForImport === questionSet.id ? bulkImportData.jsonData : ''}
                                          onChange={(e) => {
                                            setSelectedQuestionSetForImport(questionSet.id);
                                            setBulkImportData(prev => ({ ...prev, jsonData: e.target.value }));
                                          }}
                                          rows={4}
                                          className="font-mono text-sm"
                                        />
                                      </div>
                                    )}
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
                                    disabled={importQuestionsMutation.isPending || !bulkImportData.jsonData}
                                  >
                                    {importQuestionsMutation.isPending ? "Importing..." : "Import Questions"}
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>

                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm" onClick={() => onEditQuestionSet(questionSet)}>
                                  <Edit className="h-4 w-4 mr-1" />
                                  Edit
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Edit Question Set</DialogTitle>
                                  <DialogDescription>
                                    Update question set details
                                  </DialogDescription>
                                </DialogHeader>
                                <Form {...editQuestionSetForm}>
                                  <form onSubmit={editQuestionSetForm.handleSubmit(onUpdateQuestionSet)} className="space-y-4">
                                    <FormField
                                      control={editQuestionSetForm.control}
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
                                      control={editQuestionSetForm.control}
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
                                      <Button type="submit" disabled={updateQuestionSetMutation.isPending}>
                                        {updateQuestionSetMutation.isPending ? "Updating..." : "Update Question Set"}
                                      </Button>
                                    </DialogFooter>
                                  </form>
                                </Form>
                              </DialogContent>
                            </Dialog>
                            
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Delete
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Question Set</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{questionSet.title}"? This will also delete all questions in this set. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => onDeleteQuestionSet(questionSet.id)}>
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No question sets found.</p>
                    <p className="text-sm text-muted-foreground mt-2">Create your first question set to get started.</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Bulk Import Tab */}
          <TabsContent value="import">
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Bulk Question Import</h1>
                <p className="text-muted-foreground mt-2">Import questions from JSON format and create a new question set</p>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Import Questions</CardTitle>
                  <CardDescription>
                    Upload question data in JSON format to create a new question set
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="course-select">Select Course</Label>
                    <Select
                      value={bulkImportData.courseId}
                      onValueChange={(value) => setBulkImportData(prev => ({ ...prev, courseId: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a course" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.isArray(courses) && courses.map((course: any) => (
                          <SelectItem key={course.id} value={course.id.toString()}>
                            {course.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="question-set-title">Question Set Title</Label>
                    <Input
                      id="question-set-title"
                      placeholder="Enter title for the new question set"
                      value={bulkImportData.questionSetTitle}
                      onChange={(e) => setBulkImportData(prev => ({ ...prev, questionSetTitle: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="json-data">Question Data (JSON format)</Label>
                    
                    {!bulkImportData.jsonData ? (
                      <div 
                        className={`relative border-2 border-dashed rounded-lg p-8 transition-all duration-200 ${
                          isDragOver 
                            ? 'border-primary bg-primary/10 scale-[1.02]' 
                            : 'border-gray-300 hover:border-primary/50 hover:bg-gray-50/50'
                        }`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                      >
                        <input
                          type="file"
                          accept=".json,application/json"
                          onChange={handleFileInput}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        
                        <div className="text-center">
                          <div className="mb-4">
                            <Upload className="h-12 w-12 mx-auto text-gray-400" />
                          </div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload JSON File</h3>
                          <p className="text-sm text-gray-600 mb-4">
                            Drag and drop your questions file here, or click to browse
                          </p>
                          <div className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                            Browse Files
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                              <Upload className="h-4 w-4 text-green-600" />
                            </div>
                            <span className="text-sm font-medium text-green-800">JSON data loaded</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setBulkImportData(prev => ({ ...prev, jsonData: "" }))}
                            className="text-green-700 hover:text-green-900"
                          >
                            Clear
                          </Button>
                        </div>
                        <Textarea
                          id="json-data"
                          placeholder="Paste your questions JSON here..."
                          value={bulkImportData.jsonData}
                          onChange={(e) => setBulkImportData(prev => ({ ...prev, jsonData: e.target.value }))}
                          rows={12}
                          className="font-mono text-sm"
                        />
                      </div>
                    )}
                    
                    {!bulkImportData.jsonData && (
                      <div className="text-center">
                        <p className="text-sm text-gray-500 mb-2">Or paste your JSON data directly:</p>
                        <Textarea
                          placeholder="Paste your questions JSON here..."
                          value={bulkImportData.jsonData}
                          onChange={(e) => setBulkImportData(prev => ({ ...prev, jsonData: e.target.value }))}
                          rows={4}
                          className="font-mono text-sm"
                        />
                      </div>
                    )}
                  </div>

                  <Button 
                    onClick={onBulkImport} 
                    disabled={!bulkImportData.courseId || !bulkImportData.questionSetTitle || !bulkImportData.jsonData || createQuestionSetMutation.isPending || importQuestionsMutation.isPending}
                    className="w-full"
                  >
                    {createQuestionSetMutation.isPending || importQuestionsMutation.isPending ? "Importing..." : "Import Questions"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* AI Settings Tab */}
          <TabsContent value="ai">
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-foreground">AI Settings</h1>
                <p className="text-muted-foreground mt-2">Configure AI model parameters and behavior</p>
              </div>



              {/* Prompt Versions Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Assistant Chatbot Prompt
                    <Button 
                      onClick={() => setAddVersionDialogOpen(true)}
                      className="text-sm"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add version
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {promptVersionsLoading ? (
                    <div className="text-center py-4">Loading prompt versions...</div>
                  ) : promptVersions && Array.isArray(promptVersions) && promptVersions.length > 0 ? (
                    <div className="space-y-4">
                      {promptVersions.map((version: any) => (
                        <div key={version.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded text-sm ${
                                version.isActive 
                                  ? 'bg-blue-500 text-white' 
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                {version.versionName}
                              </span>
                              {version.isActive && <span className="text-sm text-green-600">Active</span>}
                              {version.modelName && (
                                <span className="text-sm text-gray-500">
                                  {aiModels.find(m => m.value === version.modelName)?.name || version.modelName}
                                </span>
                              )}
                            </div>
                            <div className="flex gap-2">
                              {!version.isActive && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => activatePromptVersionMutation.mutate(version.id)}
                                  disabled={activatePromptVersionMutation.isPending}
                                >
                                  Activate
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingPromptVersion(version)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                            {version.promptText}
                          </div>
                          <div className="text-xs text-gray-400 mt-2">
                            Created: {new Date(version.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No prompt versions found. Create your first version to get started.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-foreground">User Management</h1>
                <p className="text-muted-foreground mt-2">View and manage system users</p>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>System Users</CardTitle>
                  <CardDescription>
                    Overview of all registered users in the system
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {usersLoading ? (
                    <div className="text-center py-4">Loading users...</div>
                  ) : users && Array.isArray(users) && users.length > 0 ? (
                    <div className="space-y-4">
                      {users.map((user: any) => (
                        <div key={user.id} className="flex justify-between items-center p-4 border rounded-lg">
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {user.isAdmin ? "Administrator" : "Student"}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No users found in the system.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Course Dialog */}
      {editingCourse && (
        <Dialog open={!!editingCourse} onOpenChange={() => setEditingCourse(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Course</DialogTitle>
              <DialogDescription>
                Update course information
              </DialogDescription>
            </DialogHeader>
            <Form {...editCourseForm}>
              <form onSubmit={editCourseForm.handleSubmit(onUpdateCourse)} className="space-y-4">
                <FormField
                  control={editCourseForm.control}
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
                  control={editCourseForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Enter course description" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={updateCourseMutation.isPending}>
                    {updateCourseMutation.isPending ? "Updating..." : "Update Course"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}

      {/* Add Prompt Version Dialog */}
      <Dialog open={addVersionDialogOpen} onOpenChange={setAddVersionDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Prompt Version</DialogTitle>
            <DialogDescription>
              Create a new version of the system prompt for the AI assistant
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="version-name">Version Name</Label>
              <Input
                id="version-name"
                placeholder="e.g., V.3"
                value={newPromptVersion.versionName}
                onChange={(e) => setNewPromptVersion(prev => ({ ...prev, versionName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prompt-text">Prompt Text</Label>
              <Textarea
                id="prompt-text"
                placeholder="Enter the system prompt text..."
                rows={6}
                value={newPromptVersion.promptText}
                onChange={(e) => setNewPromptVersion((prev: any) => ({ ...prev, promptText: e.target.value }))}
              />
              <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded border">
                <strong>Available Variables:</strong>
                <div className="mt-1 space-y-1">
                  <div><code>{'{{QUESTION_TEXT}}'}</code> - The practice question text</div>
                  <div><code>{'{{ANSWER_CHOICES}}'}</code> - All answer choices (A, B, C, D)</div>
                  <div><code>{'{{SELECTED_ANSWER}}'}</code> - The student's chosen answer</div>
                  <div><code>{'{{CORRECT_ANSWER}}'}</code> - The correct answer</div>
                  <div><code>{'{{SOURCE_MATERIAL}}'}</code> - Course material for reference</div>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="model-for-prompt">AI Model for this prompt</Label>
              <Select
                value={newPromptVersion.modelName}
                onValueChange={(value) => setNewPromptVersion((prev: any) => ({ ...prev, modelName: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select model (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {aiModels.map(model => (
                    <SelectItem key={model.value} value={model.value}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => createPromptVersionMutation.mutate({
                versionName: newPromptVersion.versionName,
                promptText: newPromptVersion.promptText,
                modelName: newPromptVersion.modelName || null,
                isActive: false
              })}
              disabled={!newPromptVersion.versionName || !newPromptVersion.promptText || createPromptVersionMutation.isPending}
            >
              {createPromptVersionMutation.isPending ? "Creating..." : "Create Version"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Prompt Version Dialog */}
      {editingPromptVersion && (
        <Dialog open={!!editingPromptVersion} onOpenChange={() => setEditingPromptVersion(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Update Version</DialogTitle>
              <DialogDescription>
                Edit the prompt version details
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-prompt-text">Prompt Text</Label>
                <Textarea
                  id="edit-prompt-text"
                  rows={6}
                  value={editingPromptVersion.promptText}
                  onChange={(e) => setEditingPromptVersion(prev => ({ ...prev, promptText: e.target.value }))}
                />
                <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded border">
                  <strong>Available Variables:</strong>
                  <div className="mt-1 space-y-1">
                    <div><code>{"{chosenAnswer}"}</code> - The student's selected answer (A, B, C, D)</div>
                    <div><code>{"{correctAnswer}"}</code> - The correct answer for the question</div>
                    <div><code>{"{questionText}"}</code> - The full question text</div>
                    <div><code>{"{topicFocus}"}</code> - The learning objective/topic for the question</div>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-model-for-prompt">AI Model for this prompt</Label>
                <Select
                  value={editingPromptVersion.modelName || ""}
                  onValueChange={(value) => setEditingPromptVersion(prev => ({ ...prev, modelName: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select model (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {aiModels.map(model => (
                      <SelectItem key={model.value} value={model.value}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => updatePromptVersionMutation.mutate({
                  id: editingPromptVersion.id,
                  data: {
                    promptText: editingPromptVersion.promptText,
                    modelName: editingPromptVersion.modelName || null,
                  }
                })}
                disabled={updatePromptVersionMutation.isPending}
              >
                {updatePromptVersionMutation.isPending ? "Updating..." : "Update Version"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}