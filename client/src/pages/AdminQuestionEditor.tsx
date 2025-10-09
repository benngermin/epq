import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { QuestionTypeEditor } from "@/components/QuestionTypeEditor";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Plus, Save, Archive, RotateCcw, Shuffle, ChevronDown, ChevronRight, 
  GripVertical, Loader2, Sparkles, AlertCircle
} from "lucide-react";

interface Question {
  id: number;
  originalQuestionNumber: number;
  loid: string;
  displayOrder: number;
  isArchived: boolean;
}

interface QuestionVersion {
  id: number;
  questionId: number;
  versionNumber: number;
  topicFocus: string;
  questionText: string;
  questionType: string;
  answerChoices: any;
  correctAnswer: any;
  acceptableAnswers?: string[];
  caseSensitive?: boolean;
  blanks?: any;
  dropZones?: any;
  isStaticAnswer: boolean;
  staticExplanation?: string;
}

interface QuestionWithVersion {
  question: Question;
  version: QuestionVersion | null;
}

export default function AdminQuestionEditor() {
  const { courseId, setId } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State management
  const [editedQuestions, setEditedQuestions] = useState<Map<number, Partial<QuestionVersion>>>(new Map());
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());
  const [draggedQuestion, setDraggedQuestion] = useState<number | null>(null);
  const [dragOverQuestion, setDragOverQuestion] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<"before" | "after" | null>(null);
  const [confirmSaveId, setConfirmSaveId] = useState<number | null>(null);
  const [confirmArchiveId, setConfirmArchiveId] = useState<number | null>(null);
  const [confirmRecoverId, setConfirmRecoverId] = useState<number | null>(null);
  const [confirmDeleteExplanation, setConfirmDeleteExplanation] = useState<number | null>(null);
  const [generatingExplanation, setGeneratingExplanation] = useState<number | null>(null);
  const [savingModeSwitch, setSavingModeSwitch] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("active");
  const [isCreatingQuestion, setIsCreatingQuestion] = useState(false);
  const [newQuestionType, setNewQuestionType] = useState("multiple_choice");
  const [newQuestionMode, setNewQuestionMode] = useState<"ai" | "static">("ai");

  // Fetch course info
  const { data: course } = useQuery<{ courseNumber: string; courseTitle: string }>({
    queryKey: [`/api/courses/${courseId}`],
    enabled: !!courseId
  });

  // Fetch question set info
  const { data: questionSet } = useQuery<{ title: string }>({
    queryKey: [`/api/admin/question-sets/${setId}`],
    enabled: !!setId
  });

  // Fetch all question sets for the course to determine position
  const { data: courseQuestionSets } = useQuery<{ id: number; title: string }[]>({
    queryKey: [`/api/courses/${courseId}/question-sets`],
    enabled: !!courseId
  });

  // Fetch questions with versions
  const { data: questionsData, isLoading, error, refetch } = useQuery<{
    questions: QuestionWithVersion[];
  }>({
    queryKey: [`/api/admin/questions-with-versions/${setId}?includeArchived=true`],
    enabled: !!setId
  });

  // Filter questions based on active tab
  const filteredQuestions = useMemo(() => {
    if (!questionsData?.questions) return [];
    return questionsData.questions.filter(q => 
      activeTab === "active" ? !q.question.isArchived : q.question.isArchived
    ).sort((a, b) => a.question.displayOrder - b.question.displayOrder);
  }, [questionsData, activeTab]);

  // Check for unsaved changes
  const hasUnsavedChanges = editedQuestions.size > 0;

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Create question mutation
  const createQuestionMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/admin/questions/create-with-version", data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Question created successfully" });
      refetch();
      setIsCreatingQuestion(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create question",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Update question version mutation
  const updateVersionMutation = useMutation({
    mutationFn: async ({ versionId, data }: { versionId: number; data: any }) => {
      const response = await apiRequest("PUT", `/api/admin/question-versions/${versionId}`, data);
      return response.json();
    },
    onSuccess: (_, { versionId }) => {
      toast({ title: "Question saved successfully" });
      // Remove from edited questions
      const newEdited = new Map(editedQuestions);
      const questionId = questionsData?.questions.find(q => q.version?.id === versionId)?.question.id;
      if (questionId) {
        newEdited.delete(questionId);
        setEditedQuestions(newEdited);
      }
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save question",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Archive question mutation
  const archiveQuestionMutation = useMutation({
    mutationFn: async (questionId: number) => {
      const response = await apiRequest("POST", `/api/admin/questions/${questionId}/archive`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Question archived successfully" });
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to archive question",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Recover question mutation
  const recoverQuestionMutation = useMutation({
    mutationFn: async (questionId: number) => {
      const response = await apiRequest("POST", `/api/admin/questions/${questionId}/recover`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Question recovered successfully" });
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to recover question",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Reorder questions mutation
  const reorderQuestionsMutation = useMutation({
    mutationFn: async (questionIds: number[]) => {
      const response = await apiRequest("POST", "/api/admin/questions/reorder", {
        questionSetId: parseInt(setId!),
        questionIds
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Questions reordered successfully" });
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to reorder questions",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Generate static explanation mutation
  const generateExplanationMutation = useMutation({
    mutationFn: async (questionId: number) => {
      const response = await apiRequest("POST", `/api/admin/questions/${questionId}/generate-explanation`);
      return response.json();
    },
    onSuccess: (data, questionId) => {
      const question = questionsData?.questions.find(q => q.question.id === questionId);
      if (question?.version) {
        const newEdited = new Map(editedQuestions);
        const existing = newEdited.get(questionId) || {};
        newEdited.set(questionId, {
          ...existing,
          staticExplanation: data.explanation  // Fixed: using data.explanation instead of data.generatedExplanation
        });
        setEditedQuestions(newEdited);
        toast({ title: "Explanation generated successfully" });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to generate explanation",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Handle field edit
  const handleFieldEdit = (questionId: number, field: string, value: any) => {
    const newEdited = new Map(editedQuestions);
    const existing = newEdited.get(questionId) || {};
    newEdited.set(questionId, { ...existing, [field]: value });
    setEditedQuestions(newEdited);
  };

  // Handle save question
  const handleSaveQuestion = (questionId: number, versionId: number) => {
    const edits = editedQuestions.get(questionId);
    if (edits && versionId) {
      updateVersionMutation.mutate({ versionId, data: edits });
      setConfirmSaveId(null);
    }
  };

  // Handle explanation mode switch
  const handleExplanationModeSwitch = async (questionId: number, versionId: number, toStatic: boolean) => {
    if (!toStatic) {
      // Switching from static to AI - confirm deletion of static explanation
      setConfirmDeleteExplanation(questionId);
    } else {
      // Switching to static mode - save immediately
      setSavingModeSwitch(questionId);
      try {
        await updateVersionMutation.mutateAsync({
          versionId,
          data: { isStaticAnswer: true }
        });
        
        // Clear from edited questions since it's saved
        const newEdited = new Map(editedQuestions);
        const existingEdits = newEdited.get(questionId);
        if (existingEdits) {
          delete existingEdits.isStaticAnswer;
          if (Object.keys(existingEdits).length === 0) {
            newEdited.delete(questionId);
          } else {
            newEdited.set(questionId, existingEdits);
          }
        }
        setEditedQuestions(newEdited);
        
        toast({ title: "Switched to static mode successfully" });
      } catch (error) {
        toast({
          title: "Failed to switch mode",
          description: error instanceof Error ? error.message : "Unknown error",
          variant: "destructive"
        });
      } finally {
        setSavingModeSwitch(null);
      }
    }
  };

  // Confirm delete static explanation and switch to AI
  const confirmDeleteStaticExplanation = async (questionId: number) => {
    const question = questionsData?.questions.find(q => q.question.id === questionId);
    if (!question?.version) {
      toast({
        title: "Error",
        description: "Question version not found",
        variant: "destructive"
      });
      return;
    }
    
    setSavingModeSwitch(questionId);
    try {
      await updateVersionMutation.mutateAsync({
        versionId: question.version.id,
        data: {
          isStaticAnswer: false,
          staticExplanation: ""
        }
      });
      
      // Clear from edited questions since it's saved
      const newEdited = new Map(editedQuestions);
      const existingEdits = newEdited.get(questionId);
      if (existingEdits) {
        delete existingEdits.isStaticAnswer;
        delete existingEdits.staticExplanation;
        if (Object.keys(existingEdits).length === 0) {
          newEdited.delete(questionId);
        } else {
          newEdited.set(questionId, existingEdits);
        }
      }
      setEditedQuestions(newEdited);
      
      setConfirmDeleteExplanation(null);
      toast({ title: "Switched to AI mode successfully" });
    } catch (error) {
      toast({
        title: "Failed to switch mode",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    } finally {
      setSavingModeSwitch(null);
    }
  };

  // Generate static explanation
  const handleGenerateExplanation = async (questionId: number) => {
    setGeneratingExplanation(questionId);
    try {
      await generateExplanationMutation.mutateAsync(questionId);
    } finally {
      setGeneratingExplanation(null);
    }
  };

  // Remix (randomize) question order
  const handleRemixQuestions = () => {
    // Only shuffle active questions, preserve archived questions
    const allQuestions = questionsData?.questions || [];
    const activeQuestions = allQuestions.filter(q => !q.question.isArchived);
    const archivedQuestions = allQuestions.filter(q => q.question.isArchived);
    
    // Shuffle only the active questions
    const shuffledActive = [...activeQuestions].sort(() => Math.random() - 0.5);
    
    // Combine shuffled active questions with preserved archived questions
    const activeQuestionIds = shuffledActive.map(q => q.question.id);
    const archivedQuestionIds = archivedQuestions.map(q => q.question.id);
    const allQuestionIds = [...activeQuestionIds, ...archivedQuestionIds];
    
    reorderQuestionsMutation.mutate(allQuestionIds);
  };

  // Drag and drop handlers with improved UX
  const handleDragStart = (e: React.DragEvent, questionId: number) => {
    // Only allow dragging from the grip handle area
    const gripHandle = (e.target as HTMLElement).closest('[data-drag-handle]');
    if (!gripHandle) {
      e.preventDefault();
      return;
    }
    
    setDraggedQuestion(questionId);
    e.dataTransfer.effectAllowed = "move";
    
    // Add custom drag image for better visual feedback
    const dragImage = document.createElement('div');
    dragImage.className = 'bg-white shadow-xl rounded-lg px-4 py-2 border-2 border-blue-500';
    dragImage.textContent = `Moving Question ${filteredQuestions.findIndex(q => q.question.id === questionId) + 1}`;
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    setTimeout(() => document.body.removeChild(dragImage), 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    // Clear all drag states
    setDraggedQuestion(null);
    setDragOverQuestion(null);
    setDropPosition(null);
  };

  const handleDragOver = (e: React.DragEvent, questionId: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    
    if (draggedQuestion === null || draggedQuestion === questionId) return;
    
    // More precise drop zone calculation with buffer zones
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;
    
    // Create buffer zones (30% top, 40% middle, 30% bottom)
    let position: "before" | "after" | null;
    if (y < height * 0.3) {
      position = "before";
    } else if (y > height * 0.7) {
      position = "after";
    } else {
      // Middle zone - maintain current position to reduce flickering
      position = dropPosition || "after";
    }
    
    // Update hover state for visual feedback
    if (dragOverQuestion !== questionId || dropPosition !== position) {
      setDragOverQuestion(questionId);
      setDropPosition(position);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Check if we're truly leaving the drop zone
    const relatedTarget = e.relatedTarget as HTMLElement;
    const currentTarget = e.currentTarget as HTMLElement;
    
    // Only clear if we're leaving to a different card or outside
    if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
      // Add a small delay to prevent flickering
      setTimeout(() => {
        if (dragOverQuestion === parseInt(currentTarget.dataset.questionId || "0")) {
          setDragOverQuestion(null);
          setDropPosition(null);
        }
      }, 50);
    }
  };

  const handleDrop = (e: React.DragEvent, dropQuestionId: number) => {
    e.preventDefault();
    
    // Validation checks
    if (draggedQuestion === null || draggedQuestion === dropQuestionId) {
      setDragOverQuestion(null);
      setDropPosition(null);
      return;
    }

    // Only reorder active questions
    if (activeTab !== "active") {
      setDraggedQuestion(null);
      setDragOverQuestion(null);
      setDropPosition(null);
      return;
    }

    const dragIndex = filteredQuestions.findIndex(q => q.question.id === draggedQuestion);
    const dropIndex = filteredQuestions.findIndex(q => q.question.id === dropQuestionId);
    
    if (dragIndex === -1 || dropIndex === -1) {
      // Question not found, abort
      setDraggedQuestion(null);
      setDragOverQuestion(null);
      setDropPosition(null);
      return;
    }
    
    // Create new order array
    const newActiveOrder = [...filteredQuestions];
    const [draggedItem] = newActiveOrder.splice(dragIndex, 1);
    
    // Calculate the new index - simpler logic
    let targetIndex = dropIndex;
    if (dropPosition === "after") {
      // If dragging from above, the removal shifts indices down
      targetIndex = dragIndex < dropIndex ? dropIndex : dropIndex + 1;
    } else {
      // "before" position
      targetIndex = dragIndex < dropIndex ? dropIndex - 1 : dropIndex;
    }
    
    // Ensure target index is within bounds
    targetIndex = Math.max(0, Math.min(targetIndex, newActiveOrder.length));
    
    // Insert at new position
    newActiveOrder.splice(targetIndex, 0, draggedItem);
    
    // Get all questions (including archived) to preserve their order
    const allQuestions = questionsData?.questions || [];
    const archivedQuestions = allQuestions.filter(q => q.question.isArchived);
    
    // Combine reordered active questions with unchanged archived questions
    const activeQuestionIds = newActiveOrder.map(q => q.question.id);
    const archivedQuestionIds = archivedQuestions.map(q => q.question.id);
    const allQuestionIds = [...activeQuestionIds, ...archivedQuestionIds];
    
    // Apply the new order
    reorderQuestionsMutation.mutate(allQuestionIds);
    
    // Clear all drag states
    setDraggedQuestion(null);
    setDragOverQuestion(null);
    setDropPosition(null);
  };

  // Get current value for a field (edited or original)
  const getCurrentValue = (questionId: number, version: QuestionVersion | null, field: keyof QuestionVersion) => {
    const edited = editedQuestions.get(questionId);
    if (edited && field in edited) {
      return edited[field as keyof typeof edited];
    }
    return version ? version[field] : "";
  };

  // Create new question
  const handleCreateQuestion = () => {
    const newOrder = Math.max(...questionsData?.questions.map(q => q.question.displayOrder) || [0]) + 1;
    
    const baseData = {
      questionText: "",
      questionType: newQuestionType,
      correctAnswer: "",
      answerChoices: newQuestionType === "either_or" ? ["", ""] : [],
      topicFocus: "",
      isStaticAnswer: newQuestionMode === "static",
      staticExplanation: ""
    };

    // Add type-specific defaults
    const typeDefaults: Record<string, any> = {
      select_from_list: { blanks: [] },
      drag_and_drop: { dropZones: [], correctAnswer: {} },
      numerical_entry: { acceptableAnswers: [] },
      short_answer: { acceptableAnswers: [], caseSensitive: false }
    };

    const versionData = {
      ...baseData,
      ...(typeDefaults[newQuestionType] || {})
    };

    createQuestionMutation.mutate({
      questionSetId: parseInt(setId!),
      question: {
        originalNumber: newOrder,
        loid: "",
        displayOrder: newOrder
      },
      version: versionData
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load questions. Please try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Build breadcrumbs
  const breadcrumbs = [
    { label: "Content Management", href: "/admin" },
    { label: course?.courseNumber || `Course ${courseId}` },
    { label: questionSet?.title || "Question Set" }
  ];

  return (
    <AdminLayout breadcrumbs={breadcrumbs}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Question Editor</h1>
            <p className="text-muted-foreground">
              Manage questions for {course?.courseNumber || `Course ${courseId}`} - {questionSet?.title || "Question Set"}
            </p>
          </div>
        
        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <Badge variant="secondary">
              {editedQuestions.size} unsaved change{editedQuestions.size !== 1 ? "s" : ""}
            </Badge>
          )}
          <Button
            onClick={() => setIsCreatingQuestion(true)}
            data-testid="button-create-question"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Question
          </Button>
        </div>
      </div>

      {/* Tabs for Active/Archived */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="active" data-testid="tab-active">
              Active Questions ({questionsData?.questions.filter(q => !q.question.isArchived).length || 0})
            </TabsTrigger>
            <TabsTrigger value="archived" data-testid="tab-archived">
              Archived ({questionsData?.questions.filter(q => q.question.isArchived).length || 0})
            </TabsTrigger>
          </TabsList>
          
          {activeTab === "active" && filteredQuestions.length > 1 && (
            <Button
              variant="outline"
              onClick={handleRemixQuestions}
              disabled={reorderQuestionsMutation.isPending}
              data-testid="button-remix"
            >
              <Shuffle className="h-4 w-4 mr-2" />
              Remix Order
            </Button>
          )}
        </div>

        <TabsContent value={activeTab} className="space-y-4">
          <ScrollArea className="h-[calc(100vh-250px)]">
            <div className="space-y-4 pr-4">
              {filteredQuestions.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-12">
                    <p className="text-muted-foreground">
                      {activeTab === "active" 
                        ? "No active questions. Create your first question to get started."
                        : "No archived questions."}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                filteredQuestions.map((item, index) => {
                  const { question, version } = item;
                  const isExpanded = expandedQuestions.has(question.id);
                  const hasEdits = editedQuestions.has(question.id);
                  const currentMode = getCurrentValue(question.id, version, "isStaticAnswer") ? "static" : "ai";
                  // Display the actual position in the current list (1-based)
                  const displayNumber = index + 1;

                  return (
                    <div key={question.id} className="relative">
                      {/* Enhanced drop zone indicators with smooth animations */}
                      {dragOverQuestion === question.id && dropPosition === "before" && (
                        <div className="absolute -top-2 left-0 right-0 h-2 z-20">
                          <div className="h-1 bg-gradient-to-r from-blue-400 via-blue-500 to-blue-400 rounded-full animate-pulse" />
                          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
                        </div>
                      )}
                      {dragOverQuestion === question.id && dropPosition === "after" && (
                        <div className="absolute -bottom-2 left-0 right-0 h-2 z-20">
                          <div className="h-1 bg-gradient-to-r from-blue-400 via-blue-500 to-blue-400 rounded-full animate-pulse" />
                          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1 w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
                        </div>
                      )}
                      
                      <Card 
                        className={`
                          ${hasEdits ? "border-yellow-500" : ""}
                          ${draggedQuestion === question.id ? "opacity-60 scale-[0.985] blur-[0.5px]" : ""}
                          ${dragOverQuestion === question.id && draggedQuestion !== question.id ? "shadow-xl ring-2 ring-blue-300 bg-blue-50/30" : ""}
                          transition-all duration-300 ease-out
                          ${activeTab === "active" ? "hover:shadow-md" : ""}
                        `}
                        onDragOver={(e) => handleDragOver(e, question.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, question.id)}
                        data-testid={`card-question-${question.id}`}
                        data-question-id={question.id}
                      >
                      <CardHeader className="pb-3 space-y-3">
                        {/* Question header with badges */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {activeTab === "active" && (
                              <div 
                                className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 transition-colors cursor-grab active:cursor-grabbing"
                                data-drag-handle
                                draggable={true}
                                onDragStart={(e) => handleDragStart(e, question.id)}
                                onDragEnd={handleDragEnd}
                                title="Drag to reorder"
                              >
                                <GripVertical className="h-4 w-4 text-gray-500 pointer-events-none" />
                                <GripVertical className="h-4 w-4 text-gray-500 -ml-2 pointer-events-none" />
                              </div>
                            )}
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="font-semibold cursor-help">Q{displayNumber}</span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">Original: Q{question.originalQuestionNumber}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <Badge variant="outline">{version?.questionType || "unknown"}</Badge>
                            <Badge variant={currentMode === "ai" ? "default" : "secondary"}>
                              {currentMode === "ai" ? "AI Explanation" : "Static Explanation"}
                            </Badge>
                            {hasEdits && <Badge variant="secondary">Modified</Badge>}
                          </div>
                          
                          {/* Action buttons */}
                          <div className="flex items-center gap-2">
                            {hasEdits && (
                              <Button
                                size="sm"
                                onClick={() => setConfirmSaveId(question.id)}
                                data-testid={`button-save-${question.id}`}
                              >
                                <Save className="h-4 w-4 mr-1" />
                                Save
                              </Button>
                            )}
                            {activeTab === "active" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setConfirmArchiveId(question.id)}
                                data-testid={`button-archive-${question.id}`}
                              >
                                <Archive className="h-4 w-4 mr-1" />
                                Archive
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setConfirmRecoverId(question.id)}
                                data-testid={`button-recover-${question.id}`}
                              >
                                <RotateCcw className="h-4 w-4 mr-1" />
                                Recover
                              </Button>
                            )}
                          </div>
                        </div>
                        
                        {/* Full-width question text */}
                        <Textarea
                          value={getCurrentValue(question.id, version, "questionText") as string}
                          onChange={(e) => handleFieldEdit(question.id, "questionText", e.target.value)}
                          className="min-h-[80px] resize-y w-full"
                          placeholder="Enter question text..."
                          data-testid={`textarea-question-${question.id}`}
                        />
                        
                        {/* Inline editable correct answer for simple types */}
                        {version && ["multiple_choice", "numerical_entry", "short_answer", "either_or"].includes(version.questionType) && (
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Correct Answer</Label>
                            <div className="flex items-center gap-2">
                              {version.questionType === "multiple_choice" ? (
                                <>
                                  <Select
                                    value={getCurrentValue(question.id, version, "correctAnswer") as string}
                                    onValueChange={(val) => handleFieldEdit(question.id, "correctAnswer", val)}
                                  >
                                    <SelectTrigger className="w-24" data-testid={`select-correct-${question.id}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {(getCurrentValue(question.id, version, "answerChoices") as any[] || []).map((_: any, i: number) => (
                                        <SelectItem key={i} value={String.fromCharCode(65 + i)}>
                                          {String.fromCharCode(65 + i)}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <div className="flex-1 px-3 py-2 bg-green-50 border border-green-200 rounded-md">
                                    <span className="text-sm text-green-900">
                                      {(() => {
                                        const correctLetter = getCurrentValue(question.id, version, "correctAnswer") as string;
                                        const choices = getCurrentValue(question.id, version, "answerChoices") as string[] || [];
                                        const index = correctLetter ? correctLetter.charCodeAt(0) - 65 : -1;
                                        const answerText = index >= 0 && index < choices.length ? choices[index] : "";
                                        return answerText || "Select correct answer above";
                                      })()}
                                    </span>
                                  </div>
                                </>
                              ) : version.questionType === "short_answer" ? (
                                <>
                                  <Input
                                    value={getCurrentValue(question.id, version, "correctAnswer") as string}
                                    onChange={(e) => handleFieldEdit(question.id, "correctAnswer", e.target.value)}
                                    className="w-48"
                                    placeholder="Short answer..."
                                    data-testid={`input-correct-${question.id}`}
                                  />
                                  <Input
                                    value={
                                      (getCurrentValue(question.id, version, "acceptableAnswers") as string[])?.[0] || ""
                                    }
                                    onChange={(e) => {
                                      const currentAcceptable = getCurrentValue(question.id, version, "acceptableAnswers") as string[] || [];
                                      const newAcceptable = [...currentAcceptable];
                                      newAcceptable[0] = e.target.value;
                                      handleFieldEdit(question.id, "acceptableAnswers", newAcceptable.filter(Boolean));
                                    }}
                                    className="flex-1"
                                    placeholder="Full/expanded answer (optional)..."
                                    data-testid={`input-expanded-${question.id}`}
                                  />
                                </>
                              ) : (
                                <Input
                                  value={getCurrentValue(question.id, version, "correctAnswer") as string}
                                  onChange={(e) => handleFieldEdit(question.id, "correctAnswer", e.target.value)}
                                  className="flex-1"
                                  placeholder="Enter correct answer..."
                                  data-testid={`input-correct-${question.id}`}
                                />
                              )}
                            </div>
                          </div>
                        )}
                      </CardHeader>
                      
                      {/* Collapsible type-specific fields */}
                      <Collapsible 
                        open={isExpanded} 
                        onOpenChange={(open) => {
                          const newExpanded = new Set(expandedQuestions);
                          if (open) {
                            newExpanded.add(question.id);
                          } else {
                            newExpanded.delete(question.id);
                          }
                          setExpandedQuestions(newExpanded);
                        }}
                      >
                        <CollapsibleTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="w-full justify-start py-3"
                            data-testid={`button-expand-${question.id}`}
                          >
                            {isExpanded ? <ChevronDown className="h-4 w-4 mr-2" /> : <ChevronRight className="h-4 w-4 mr-2" />}
                            Advanced Settings & Explanations
                          </Button>
                        </CollapsibleTrigger>
                        
                        <CollapsibleContent>
                          <CardContent className="space-y-4 pt-4">
                            {/* Question type specific editor */}
                            {version && (
                              <QuestionTypeEditor
                                questionType={version.questionType}
                                value={{
                                  answerChoices: getCurrentValue(question.id, version, "answerChoices"),
                                  correctAnswer: getCurrentValue(question.id, version, "correctAnswer"),
                                  acceptableAnswers: getCurrentValue(question.id, version, "acceptableAnswers"),
                                  caseSensitive: getCurrentValue(question.id, version, "caseSensitive"),
                                  blanks: getCurrentValue(question.id, version, "blanks"),
                                  dropZones: getCurrentValue(question.id, version, "dropZones"),
                                }}
                                onChange={(newValue) => {
                                  Object.entries(newValue).forEach(([key, val]) => {
                                    handleFieldEdit(question.id, key, val);
                                  });
                                }}
                              />
                            )}
                            
                            {/* Explanation type switching */}
                            <div className="space-y-4 border-t pt-4">
                              <div className="space-y-2">
                                <Label>Explanation Type</Label>
                                <div className="flex items-center gap-4">
                                  <RadioGroup
                                    value={currentMode}
                                    onValueChange={(value) => 
                                      handleExplanationModeSwitch(question.id, version!.id, value === "static")
                                    }
                                    className="flex items-center gap-6"
                                    disabled={savingModeSwitch === question.id}
                                    data-testid={`radiogroup-mode-${question.id}`}
                                  >
                                    <div className="flex items-center space-x-2">
                                      <RadioGroupItem 
                                        value="ai" 
                                        id={`ai-${question.id}`} 
                                        disabled={savingModeSwitch === question.id}
                                      />
                                      <Label 
                                        htmlFor={`ai-${question.id}`} 
                                        className={`cursor-pointer ${savingModeSwitch === question.id ? 'opacity-50' : ''}`}
                                      >
                                        AI
                                      </Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <RadioGroupItem 
                                        value="static" 
                                        id={`static-${question.id}`} 
                                        disabled={savingModeSwitch === question.id}
                                      />
                                      <Label 
                                        htmlFor={`static-${question.id}`} 
                                        className={`cursor-pointer ${savingModeSwitch === question.id ? 'opacity-50' : ''}`}
                                      >
                                        Static
                                      </Label>
                                    </div>
                                  </RadioGroup>
                                  {savingModeSwitch === question.id && (
                                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                      Saving...
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              {/* Static explanation editor */}
                              {currentMode === "static" && (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <Label>Static Explanation</Label>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleGenerateExplanation(question.id)}
                                      disabled={generatingExplanation === question.id}
                                      data-testid={`button-generate-${question.id}`}
                                    >
                                      {generatingExplanation === question.id ? (
                                        <>
                                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                          Generating...
                                        </>
                                      ) : (
                                        <>
                                          <Sparkles className="h-4 w-4 mr-2" />
                                          Generate
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                  <Textarea
                                    value={getCurrentValue(question.id, version, "staticExplanation") as string}
                                    onChange={(e) => handleFieldEdit(question.id, "staticExplanation", e.target.value)}
                                    rows={6}
                                    placeholder="Enter or generate static explanation..."
                                    className="font-mono text-sm"
                                    data-testid={`textarea-explanation-${question.id}`}
                                  />
                                </div>
                              )}
                            </div>
                            
                            {/* Additional metadata */}
                            <div className="border-t pt-4">
                              <div>
                                <Label htmlFor={`loid-${question.id}`} className="text-sm">LOID</Label>
                                <Input
                                  id={`loid-${question.id}`}
                                  value={question.loid}
                                  readOnly
                                  className="text-sm"
                                  data-testid={`input-loid-${question.id}`}
                                />
                              </div>
                            </div>
                          </CardContent>
                        </CollapsibleContent>
                      </Collapsible>
                    </Card>
                      
                      {/* Drop zone indicator - appears below the card */}
                      {dragOverQuestion === question.id && dropPosition === "after" && (
                        <div className="absolute -bottom-1 left-0 right-0 h-1 bg-blue-500 rounded-full z-10 animate-pulse" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Create Question Dialog */}
      <AlertDialog open={isCreatingQuestion} onOpenChange={setIsCreatingQuestion}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Create New Question</AlertDialogTitle>
            <AlertDialogDescription>
              Select the question type and explanation mode for the new question.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="new-type">Question Type</Label>
              <Select value={newQuestionType} onValueChange={setNewQuestionType}>
                <SelectTrigger id="new-type" data-testid="select-new-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                  <SelectItem value="multiple_response">Multiple Response</SelectItem>
                  <SelectItem value="numerical_entry">Numerical Entry</SelectItem>
                  <SelectItem value="select_from_list">Select from List</SelectItem>
                  <SelectItem value="drag_and_drop">Drag and Drop</SelectItem>
                  <SelectItem value="either_or">Either/Or</SelectItem>
                  <SelectItem value="short_answer">Short Answer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Explanation Mode</Label>
              <div className="flex items-center gap-4 mt-2">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="ai"
                    checked={newQuestionMode === "ai"}
                    onChange={(e) => setNewQuestionMode(e.target.value as "ai" | "static")}
                    data-testid="radio-ai"
                  />
                  <span>AI Explanation</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="static"
                    checked={newQuestionMode === "static"}
                    onChange={(e) => setNewQuestionMode(e.target.value as "ai" | "static")}
                    data-testid="radio-static"
                  />
                  <span>Static Explanation</span>
                </label>
              </div>
            </div>
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleCreateQuestion}
              disabled={createQuestionMutation.isPending}
              data-testid="button-confirm-create"
            >
              {createQuestionMutation.isPending ? "Creating..." : "Create Question"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Save Confirmation Dialog */}
      <AlertDialog open={confirmSaveId !== null} onOpenChange={() => setConfirmSaveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save Changes</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to save the changes to this question?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const question = questionsData?.questions.find(q => q.question.id === confirmSaveId);
                if (question?.version) {
                  handleSaveQuestion(confirmSaveId!, question.version.id);
                }
              }}
              data-testid="button-confirm-save"
            >
              Save Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={confirmArchiveId !== null} onOpenChange={() => setConfirmArchiveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Question</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive this question? It will be moved to the archived tab.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                archiveQuestionMutation.mutate(confirmArchiveId!);
                setConfirmArchiveId(null);
              }}
              data-testid="button-confirm-archive"
            >
              Archive Question
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Recover Confirmation Dialog */}
      <AlertDialog open={confirmRecoverId !== null} onOpenChange={() => setConfirmRecoverId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recover Question</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to recover this question? It will be moved back to active questions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                recoverQuestionMutation.mutate(confirmRecoverId!);
                setConfirmRecoverId(null);
              }}
              data-testid="button-confirm-recover"
            >
              Recover Question
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Static Explanation Confirmation */}
      <AlertDialog open={confirmDeleteExplanation !== null} onOpenChange={(open) => {
        if (!open && !savingModeSwitch) {
          setConfirmDeleteExplanation(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch to AI Mode</AlertDialogTitle>
            <AlertDialogDescription>
              Switching to AI mode will delete the static explanation. This cannot be undone. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingModeSwitch === confirmDeleteExplanation}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault(); // Prevent default closing
                confirmDeleteStaticExplanation(confirmDeleteExplanation!);
              }}
              className="bg-red-600 hover:bg-red-700"
              disabled={savingModeSwitch === confirmDeleteExplanation}
              data-testid="button-confirm-delete-explanation"
            >
              {savingModeSwitch === confirmDeleteExplanation ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Switching...
                </span>
              ) : (
                "Delete & Switch to AI"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </AdminLayout>
  );
}