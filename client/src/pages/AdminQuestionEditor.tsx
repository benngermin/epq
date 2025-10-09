import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { QuestionTypeEditor } from "@/components/QuestionTypeEditor";
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
import { 
  Plus, Save, Archive, RotateCcw, Shuffle, ChevronDown, ChevronRight, 
  GripVertical, Loader2, Sparkles, AlertCircle, ArrowLeft 
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
  const [confirmSaveId, setConfirmSaveId] = useState<number | null>(null);
  const [confirmArchiveId, setConfirmArchiveId] = useState<number | null>(null);
  const [confirmRecoverId, setConfirmRecoverId] = useState<number | null>(null);
  const [confirmDeleteExplanation, setConfirmDeleteExplanation] = useState<number | null>(null);
  const [generatingExplanation, setGeneratingExplanation] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("active");
  const [isCreatingQuestion, setIsCreatingQuestion] = useState(false);
  const [newQuestionType, setNewQuestionType] = useState("multiple_choice");
  const [newQuestionMode, setNewQuestionMode] = useState<"ai" | "static">("ai");

  // Fetch question set info
  const { data: questionSet } = useQuery<{ title: string }>({
    queryKey: [`/api/admin/question-sets/${setId}`],
    enabled: !!setId
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
          staticExplanation: data.generatedExplanation
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
  const handleExplanationModeSwitch = (questionId: number, versionId: number, toStatic: boolean) => {
    if (!toStatic) {
      // Switching from static to AI - confirm deletion of static explanation
      setConfirmDeleteExplanation(questionId);
    } else {
      // Switching to static mode
      handleFieldEdit(questionId, "isStaticAnswer", true);
    }
  };

  // Confirm delete static explanation and switch to AI
  const confirmDeleteStaticExplanation = (questionId: number) => {
    handleFieldEdit(questionId, "isStaticAnswer", false);
    handleFieldEdit(questionId, "staticExplanation", "");
    setConfirmDeleteExplanation(null);
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
    const questionIds = filteredQuestions.map(q => q.question.id);
    const shuffled = [...questionIds].sort(() => Math.random() - 0.5);
    reorderQuestionsMutation.mutate(shuffled);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, questionId: number) => {
    setDraggedQuestion(questionId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, dropQuestionId: number) => {
    e.preventDefault();
    if (draggedQuestion === null || draggedQuestion === dropQuestionId) return;

    const dragIndex = filteredQuestions.findIndex(q => q.question.id === draggedQuestion);
    const dropIndex = filteredQuestions.findIndex(q => q.question.id === dropQuestionId);
    
    const newOrder = [...filteredQuestions];
    const [removed] = newOrder.splice(dragIndex, 1);
    newOrder.splice(dropIndex, 0, removed);
    
    const questionIds = newOrder.map(q => q.question.id);
    reorderQuestionsMutation.mutate(questionIds);
    setDraggedQuestion(null);
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

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/admin")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Question Editor</h1>
            <p className="text-muted-foreground">
              Course {courseId} - {questionSet?.title || `Set ${setId}`}
            </p>
          </div>
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
                filteredQuestions.map((item) => {
                  const { question, version } = item;
                  const isExpanded = expandedQuestions.has(question.id);
                  const hasEdits = editedQuestions.has(question.id);
                  const currentMode = getCurrentValue(question.id, version, "isStaticAnswer") ? "static" : "ai";

                  return (
                    <Card 
                      key={question.id}
                      className={hasEdits ? "border-yellow-500" : ""}
                      draggable={activeTab === "active"}
                      onDragStart={(e) => handleDragStart(e, question.id)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, question.id)}
                      data-testid={`card-question-${question.id}`}
                    >
                      <CardHeader className="pb-3 space-y-3">
                        {/* Question header with badges */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {activeTab === "active" && (
                              <GripVertical className="h-5 w-5 text-muted-foreground cursor-move" />
                            )}
                            <span className="font-semibold">Q{question.originalQuestionNumber}</span>
                            <Badge variant="outline">{version?.questionType || "unknown"}</Badge>
                            <Badge variant={currentMode === "ai" ? "default" : "secondary"}>
                              {currentMode === "ai" ? "AI Mode" : "Static Mode"}
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
                                <Save className="h-4 w-4" />
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
                          <div className="flex items-center gap-2">
                            <Label className="text-sm font-medium">Correct Answer:</Label>
                            {version.questionType === "multiple_choice" ? (
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
                            ) : (
                              <Input
                                value={getCurrentValue(question.id, version, "correctAnswer") as string}
                                onChange={(e) => handleFieldEdit(question.id, "correctAnswer", e.target.value)}
                                className="w-64"
                                placeholder="Enter correct answer..."
                                data-testid={`input-correct-${question.id}`}
                              />
                            )}
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
                            Type-specific fields & Explanation settings
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
                                <RadioGroup
                                  value={currentMode}
                                  onValueChange={(value) => 
                                    handleExplanationModeSwitch(question.id, version!.id, value === "static")
                                  }
                                  className="flex items-center gap-6"
                                  data-testid={`radiogroup-mode-${question.id}`}
                                >
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="ai" id={`ai-${question.id}`} />
                                    <Label htmlFor={`ai-${question.id}`} className="cursor-pointer">AI</Label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="static" id={`static-${question.id}`} />
                                    <Label htmlFor={`static-${question.id}`} className="cursor-pointer">Static</Label>
                                  </div>
                                </RadioGroup>
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
                            <div className="grid grid-cols-2 gap-4 border-t pt-4">
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
                              <div>
                                <Label htmlFor={`topic-${question.id}`} className="text-sm">Topic Focus</Label>
                                <Input
                                  id={`topic-${question.id}`}
                                  value={getCurrentValue(question.id, version, "topicFocus") as string}
                                  onChange={(e) => handleFieldEdit(question.id, "topicFocus", e.target.value)}
                                  className="text-sm"
                                  placeholder="Enter topic focus..."
                                  data-testid={`input-topic-${question.id}`}
                                />
                              </div>
                            </div>
                          </CardContent>
                        </CollapsibleContent>
                      </Collapsible>
                    </Card>
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
      <AlertDialog open={confirmDeleteExplanation !== null} onOpenChange={() => setConfirmDeleteExplanation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch to AI Mode</AlertDialogTitle>
            <AlertDialogDescription>
              Switching to AI mode will delete the static explanation. This cannot be undone. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDeleteStaticExplanation(confirmDeleteExplanation!)}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete-explanation"
            >
              Delete & Switch to AI
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}