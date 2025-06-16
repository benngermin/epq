import { useState } from "react";
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
import { Settings, Home, BookOpen, FileText, HelpCircle, Upload, Bot, Users, Edit, Trash2 } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCourseSchema } from "@shared/schema";
import { z } from "zod";

const sampleQuestions = `[
  {
    "originalQuestionNumber": 1,
    "LOID": "11597",
    "versions": [
      {
        "versionNumber": 1,
        "topicFocus": "Risk transfer principles",
        "questionText": "Which of the following best describes how insurance facilitates access to automobile ownership by transferring financial risk from individuals to insurance companies?",
        "answerChoices": [
          "A. Insurance allows individuals to purchase vehicles they cannot afford by spreading the cost over monthly premiums.",
          "B. Insurance companies provide direct financing for automobile purchases at reduced interest rates.",
          "C. Insurance eliminates all financial risks associated with automobile ownership and operation.",
          "D. Insurance pooling allows individuals to manage potential large financial losses through predictable premium payments."
        ],
        "correctAnswer": "D"
      }
    ]
  }
]`;

export default function AdminPanel() {
  const { user } = useAuth();
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

  const { data: questions, isLoading: questionsLoading } = useQuery({
    queryKey: ["/api/admin/questions"],
  });

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["/api/admin/users"],
  });

  const createCourseMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/courses", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courses"] });
      toast({ title: "Course created successfully" });
      courseForm.reset();
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

  const importQuestionsMutation = useMutation({
    mutationFn: async (data: { courseId: number; questions: any[] }) => {
      const res = await apiRequest("POST", "/api/admin/import-questions", data);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({ title: data.message });
      setImportData({ courseId: "", jsonData: "" });
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

  // State for editing
  const [editingCourse, setEditingCourse] = useState<any>(null);

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

  const [importData, setImportData] = useState({
    courseId: "",
    jsonData: "",
  });

  const [aiSettingsData, setAiSettingsData] = useState({
    apiKey: "",
    modelName: "anthropic/claude-3-sonnet",
    systemPrompt: "You are a course-assistant AI. The learner chose answer \"X\"; the correct answer is \"Y\". Explain why the correct answer is correct, why the chosen answer is not, and invite follow-up questions. Keep replies under 150 words unless the learner requests more depth.",
    temperature: [70],
    maxTokens: [150],
    topP: [100],
  });

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

  const onCreateCourse = (data: any) => {
    createCourseMutation.mutate(data);
  };

  const onEditCourse = (course: any) => {
    setEditingCourse(course);
    editCourseForm.reset({
      title: course.title,
      description: course.description,
    });
  };

  const onUpdateCourse = (data: any) => {
    if (editingCourse) {
      updateCourseMutation.mutate({
        id: editingCourse.id,
        data,
      });
    }
  };

  const onDeleteCourse = (courseId: number) => {
    deleteCourseMutation.mutate(courseId);
  };

  const onImportQuestions = () => {
    try {
      const questions = JSON.parse(importData.jsonData);
      importQuestionsMutation.mutate({
        courseId: parseInt(importData.courseId),
        questions,
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
      apiKey: aiSettingsData.apiKey || undefined,
      modelName: aiSettingsData.modelName,
      systemPrompt: aiSettingsData.systemPrompt,
      temperature: aiSettingsData.temperature[0],
      maxTokens: aiSettingsData.maxTokens[0],
      topP: aiSettingsData.topP[0],
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="bg-card shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Settings className="h-6 w-6 text-primary mr-3" />
              <span className="font-semibold text-foreground">Admin Panel</span>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="outline" size="sm" onClick={() => setLocation("/")}>
                <Home className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-card border-r shadow-sm min-h-[calc(100vh-64px)]">
          <div className="p-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} orientation="vertical">
              <TabsList className="grid w-full grid-rows-6 h-auto">
                <TabsTrigger value="courses" className="justify-start">
                  <BookOpen className="h-4 w-4 mr-2" />
                  Courses
                </TabsTrigger>
                <TabsTrigger value="tests" className="justify-start">
                  <FileText className="h-4 w-4 mr-2" />
                  Exam Questions
                </TabsTrigger>
                <TabsTrigger value="questions" className="justify-start">
                  <HelpCircle className="h-4 w-4 mr-2" />
                  Questions
                </TabsTrigger>
                <TabsTrigger value="import" className="justify-start">
                  <Upload className="h-4 w-4 mr-2" />
                  Bulk Import
                </TabsTrigger>
                <TabsTrigger value="ai" className="justify-start">
                  <Bot className="h-4 w-4 mr-2" />
                  AI Settings
                </TabsTrigger>
                <TabsTrigger value="users" className="justify-start">
                  <Users className="h-4 w-4 mr-2" />
                  Users
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsContent value="courses">
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Course Management</h1>
                  <p className="text-muted-foreground mt-2">Manage courses and practice tests</p>
                </div>

                {/* Create Course Form */}
                <Card>
                  <CardHeader>
                    <CardTitle>Create New Course</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={courseForm.handleSubmit(onCreateCourse)} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="title">Course Title</Label>
                          <Input
                            id="title"
                            placeholder="e.g., Property & Casualty Insurance"
                            {...courseForm.register("title")}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="description">Description</Label>
                          <Input
                            id="description"
                            placeholder="Brief course description"
                            {...courseForm.register("description")}
                          />
                        </div>
                      </div>
                      <Button type="submit" disabled={createCourseMutation.isPending}>
                        {createCourseMutation.isPending ? "Creating..." : "Create Course"}
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                {/* Courses Table */}
                <Card>
                  <CardHeader>
                    <CardTitle>Existing Courses</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {coursesLoading ? (
                      <p>Loading courses...</p>
                    ) : !courses || courses.length === 0 ? (
                      <p className="text-muted-foreground">No courses created yet.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2">Course</th>
                              <th className="text-left py-2">Description</th>
                              <th className="text-left py-2">Tests</th>
                              <th className="text-left py-2">Questions</th>
                              <th className="text-left py-2">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {courses.map((course: any) => (
                              <tr key={course.id} className="border-b">
                                <td className="py-2 font-medium">{course.title}</td>
                                <td className="py-2 text-muted-foreground">{course.description}</td>
                                <td className="py-2">{course.testCount}</td>
                                <td className="py-2">{course.questionCount}</td>
                                <td className="py-2">
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button variant="outline" size="sm" className="mr-2" onClick={() => onEditCourse(course)}>
                                        <Edit className="h-4 w-4 mr-1" />
                                        Edit
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                      <DialogHeader>
                                        <DialogTitle>Edit Course</DialogTitle>
                                        <DialogDescription>
                                          Update the course information below.
                                        </DialogDescription>
                                      </DialogHeader>
                                      <form onSubmit={editCourseForm.handleSubmit(onUpdateCourse)} className="space-y-4">
                                        <div className="space-y-2">
                                          <Label htmlFor="edit-title">Course Title</Label>
                                          <Input
                                            id="edit-title"
                                            placeholder="e.g., Property & Casualty Insurance"
                                            {...editCourseForm.register("title")}
                                          />
                                        </div>
                                        <div className="space-y-2">
                                          <Label htmlFor="edit-description">Description</Label>
                                          <Input
                                            id="edit-description"
                                            placeholder="Brief course description"
                                            {...editCourseForm.register("description")}
                                          />
                                        </div>
                                        <DialogFooter>
                                          <Button type="submit" disabled={updateCourseMutation.isPending}>
                                            {updateCourseMutation.isPending ? "Updating..." : "Update Course"}
                                          </Button>
                                        </DialogFooter>
                                      </form>
                                    </DialogContent>
                                  </Dialog>
                                  
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="destructive" size="sm">
                                        <Trash2 className="h-4 w-4 mr-1" />
                                        Delete
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          This will permanently delete "{course.title}" and all associated practice tests and questions. This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => onDeleteCourse(course.id)}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                          Delete Course
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="tests">
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Exam Questions</h1>
                  <p className="text-muted-foreground mt-2">View all exam questions across courses</p>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>All Exam Questions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {testsLoading ? (
                      <p>Loading exam questions...</p>
                    ) : !practiceTests || practiceTests.length === 0 ? (
                      <p className="text-muted-foreground">No exam questions found.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2">Test Name</th>
                              <th className="text-left py-2">Course</th>
                              <th className="text-left py-2">Question Count</th>
                              <th className="text-left py-2">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {practiceTests.map((test: any) => (
                              <tr key={test.id} className="border-b">
                                <td className="py-2 font-medium">{test.title}</td>
                                <td className="py-2">{test.courseName}</td>
                                <td className="py-2">{test.questionCount}</td>
                                <td className="py-2">
                                  <Button variant="outline" size="sm" className="mr-2">
                                    Edit
                                  </Button>
                                  <Button variant="destructive" size="sm">
                                    Delete
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="questions">
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Questions</h1>
                  <p className="text-muted-foreground mt-2">View all questions across courses</p>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>All Questions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {questionsLoading ? (
                      <p>Loading questions...</p>
                    ) : !questions || questions.length === 0 ? (
                      <p className="text-muted-foreground">No questions found.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2">ID</th>
                              <th className="text-left py-2">Course</th>
                              <th className="text-left py-2">Original #</th>
                              <th className="text-left py-2">LOID</th>
                              <th className="text-left py-2">Versions</th>
                              <th className="text-left py-2">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {questions.map((question: any) => (
                              <tr key={question.id} className="border-b">
                                <td className="py-2 font-medium">{question.id}</td>
                                <td className="py-2">{question.courseName}</td>
                                <td className="py-2">{question.originalQuestionNumber}</td>
                                <td className="py-2">{question.loid}</td>
                                <td className="py-2">{question.versionCount}</td>
                                <td className="py-2">
                                  <Button variant="outline" size="sm" className="mr-2">
                                    View
                                  </Button>
                                  <Button variant="destructive" size="sm">
                                    Delete
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="users">
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Users</h1>
                  <p className="text-muted-foreground mt-2">Manage user accounts and permissions</p>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>All Users</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {usersLoading ? (
                      <p>Loading users...</p>
                    ) : !users || users.length === 0 ? (
                      <p className="text-muted-foreground">No users found. User management feature needs implementation.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2">Name</th>
                              <th className="text-left py-2">Email</th>
                              <th className="text-left py-2">Role</th>
                              <th className="text-left py-2">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {users.map((user: any) => (
                              <tr key={user.id} className="border-b">
                                <td className="py-2 font-medium">{user.name}</td>
                                <td className="py-2">{user.email}</td>
                                <td className="py-2">{user.isAdmin ? 'Admin' : 'User'}</td>
                                <td className="py-2">
                                  <Button variant="outline" size="sm" className="mr-2">
                                    Edit
                                  </Button>
                                  <Button variant="destructive" size="sm">
                                    Delete
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="import">
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Bulk Question Import</h1>
                  <p className="text-muted-foreground mt-2">Import questions from JSON format</p>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Import Questions</CardTitle>
                    <CardDescription>
                      Upload question data in the required JSON format
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="course-select">Select Course</Label>
                      <Select
                        value={importData.courseId}
                        onValueChange={(value) => setImportData(prev => ({ ...prev, courseId: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a course" />
                        </SelectTrigger>
                        <SelectContent>
                          {courses?.map((course: any) => (
                            <SelectItem key={course.id} value={course.id.toString()}>
                              {course.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="json-data">JSON Data</Label>
                      <Textarea
                        id="json-data"
                        rows={12}
                        className="font-mono text-sm"
                        placeholder={sampleQuestions}
                        value={importData.jsonData}
                        onChange={(e) => setImportData(prev => ({ ...prev, jsonData: e.target.value }))}
                      />
                    </div>

                    <Button
                      onClick={onImportQuestions}
                      disabled={!importData.courseId || !importData.jsonData || importQuestionsMutation.isPending}
                    >
                      {importQuestionsMutation.isPending ? "Importing..." : "Import Questions"}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="ai">
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-foreground">AI Chatbot Settings</h1>
                  <p className="text-muted-foreground mt-2">Configure OpenRouter integration and GPT parameters</p>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>OpenRouter Configuration</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="api-key">OpenRouter API Key</Label>
                      <Input
                        id="api-key"
                        type="password"
                        placeholder="sk-or-..."
                        value={aiSettingsData.apiKey}
                        onChange={(e) => setAiSettingsData(prev => ({ ...prev, apiKey: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="model-name">Model Name</Label>
                      <Input
                        id="model-name"
                        value={aiSettingsData.modelName}
                        onChange={(e) => setAiSettingsData(prev => ({ ...prev, modelName: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="temperature">Temperature: {aiSettingsData.temperature[0] / 100}</Label>
                      <Slider
                        value={aiSettingsData.temperature}
                        onValueChange={(value) => setAiSettingsData(prev => ({ ...prev, temperature: value }))}
                        max={100}
                        step={1}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>0 (Focused)</span>
                        <span>1 (Creative)</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="system-prompt">System Prompt</Label>
                      <Textarea
                        id="system-prompt"
                        rows={4}
                        value={aiSettingsData.systemPrompt}
                        onChange={(e) => setAiSettingsData(prev => ({ ...prev, systemPrompt: e.target.value }))}
                      />
                    </div>

                    <Button onClick={onUpdateAiSettings} disabled={updateAiSettingsMutation.isPending}>
                      {updateAiSettingsMutation.isPending ? "Saving..." : "Save Settings"}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="tests">
              <div className="text-center py-12">
                <h3 className="text-lg font-semibold mb-2">Practice Tests Management</h3>
                <p className="text-muted-foreground">Coming soon - manage practice tests here</p>
              </div>
            </TabsContent>

            <TabsContent value="questions">
              <div className="text-center py-12">
                <h3 className="text-lg font-semibold mb-2">Question Management</h3>
                <p className="text-muted-foreground">Coming soon - individual question CRUD operations</p>
              </div>
            </TabsContent>

            <TabsContent value="users">
              <div className="text-center py-12">
                <h3 className="text-lg font-semibold mb-2">User Management</h3>
                <p className="text-muted-foreground">Coming soon - manage users and permissions</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
