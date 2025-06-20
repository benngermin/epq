import { useState, useCallback } from "react";
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
import { Plus, Edit, Trash2, Upload, Eye } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const courseSchema = z.object({
  title: z.string().min(1, "Course title is required"),
  description: z.string().optional(),
});

const questionSetSchema = z.object({
  title: z.string().min(1, "Question set title is required"),
  courseId: z.number().min(1, "Course selection is required"),
});

export default function AdminPanel() {
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
      const lines = csvContent.split('\n');
      const materials = [];
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = [];
        let currentValue = '';
        let inQuotes = false;
        
        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(currentValue);
            currentValue = '';
          } else {
            currentValue += char;
          }
        }
        values.push(currentValue);
        
        if (values.length >= 4) {
          const [assignment, course, loid, content] = values;
          materials.push({ 
            assignment: assignment.replace(/"/g, ''), 
            course: course.replace(/"/g, ''), 
            loid: loid.replace(/"/g, ''), 
            content: content.replace(/"/g, '') 
          });
        }
      }
      
      console.log(`Parsed ${materials.length} materials from CSV`);
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
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Admin Panel</h1>
          <p className="text-muted-foreground mt-2">Manage courses, questions, and system settings</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="content">Content Management</TabsTrigger>
            <TabsTrigger value="uploads">Import & Upload</TabsTrigger>
            <TabsTrigger value="settings">AI & Settings</TabsTrigger>
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
                      <CardTitle>Question Sets Upload</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        Upload questions to existing question sets using JSON format.
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
                                    Course ID: {questionSet.courseId} • {questionSet.questionCount} questions
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
                          <p className="text-sm text-muted-foreground mt-1">Create question sets in the Content Management tab first.</p>
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

                <Card>
                  <CardHeader>
                    <CardTitle>AI Configuration</CardTitle>
                    <CardDescription>Configure the AI chatbot settings and prompts</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      AI settings and prompt management will be available here.
                    </p>
                  </CardContent>
                </Card>
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

function CourseMaterialsSection() {
  const { data: materials, isLoading } = useQuery({
    queryKey: ["/api/admin/course-materials"],
  });

  return (
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
              {materials.slice(0, 10).map((material: any, index: number) => (
                <div key={index} className="border rounded p-3">
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
                  </div>
                </div>
              ))}
              {materials.length > 10 && (
                <p className="text-xs text-muted-foreground text-center">
                  ...and {materials.length - 10} more materials
                </p>
              )}
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
          {questionSets.map((questionSet: any) => (
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