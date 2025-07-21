import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { useLocation } from "wouter";
import { GraduationCap, LogOut, BookOpen, Shield, Settings, ChevronDown, User } from "lucide-react";
import institutesLogo from "@assets/the-institutes-logo_1750194170496.png";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import type { Course, QuestionSet } from "@shared/schema";

export default function Dashboard() {
  const { user, logoutMutation } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null);

  const { data: courses = [], isLoading } = useQuery<(Course & { questionSets: QuestionSet[] })[]>({
    queryKey: ["/api/courses"],
  });

  // Debug logging
  console.log("Dashboard - Total courses fetched:", courses.length);
  console.log("Dashboard - Raw courses data:", courses);
  console.log("Dashboard - Courses with question sets:", courses.filter(c => c.questionSets && c.questionSets.length > 0).map(c => ({
    id: c.id,
    title: c.title,
    questionSetCount: c.questionSets.length
  })));

  // Get courses that have at least one question set
  const coursesWithQuestionSets = courses.filter((course) => 
    course.questionSets && course.questionSets.length > 0
  );

  // Get question sets for selected course
  const selectedCourseData = selectedCourse 
    ? coursesWithQuestionSets.find((c) => c.id === selectedCourse)
    : null;

  const startTestMutation = useMutation({
    mutationFn: async (testId: number) => {
      const res = await apiRequest("POST", `/api/practice-tests/${testId}/start`);
      return await res.json();
    },
    onSuccess: (testRun) => {
      setLocation(`/test/${testRun.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to start test",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const restartTestMutation = useMutation({
    mutationFn: async (testId: number) => {
      const res = await apiRequest("POST", `/api/practice-tests/${testId}/restart`);
      return await res.json();
    },
    onSuccess: (testRun) => {
      setLocation(`/test/${testRun.id}`);
      toast({
        title: "Test restarted",
        description: "Starting fresh practice test",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to restart test",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resumeTest = (testRun: any) => {
    setLocation(`/test/${testRun.id}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Completed": return "bg-green-500";
      case "In Progress": return "bg-yellow-500";
      default: return "bg-gray-500";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <GraduationCap className="mx-auto h-12 w-12 text-primary animate-pulse mb-4" />
          <p className="text-muted-foreground">Loading your courses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <nav className="bg-card shadow-sm border-b border-border/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center min-w-0 flex-1">
              <img src={institutesLogo} alt="The Institutes" className="h-6 w-6 sm:h-8 sm:w-8 mr-2 sm:mr-3 flex-shrink-0" />
              <span className="font-semibold text-foreground text-sm sm:text-base truncate">Exam Practice Questions</span>
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
                  {(user?.isAdmin || user?.email === "demo@example.com") && (
                    <DropdownMenuItem 
                      onClick={() => setLocation("/admin")}
                      className="flex items-center space-x-2 cursor-pointer"
                    >
                      <Settings className="h-4 w-4" />
                      <span>Admin</span>
                    </DropdownMenuItem>
                  )}
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">My Courses</h1>
          
          {/* Course and Question Set Selection */}
          {coursesWithQuestionSets.length > 0 ? (
            <div className="flex flex-col sm:flex-row gap-4 p-4 bg-accent rounded-lg border">
              {/* Course Dropdown */}
              <div className="flex-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      {selectedCourse && selectedCourseData 
                        ? selectedCourseData.title 
                        : "Select a Course"}
                      <ChevronDown className="h-4 w-4 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-full">
                    <DropdownMenuLabel>Available Courses</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {coursesWithQuestionSets.map((course: any) => (
                      <DropdownMenuItem 
                        key={course.id}
                        onClick={() => setSelectedCourse(course.id)}
                        className="cursor-pointer"
                      >
                        {course.title}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Question Set Dropdown */}
              {selectedCourseData && (
                <div className="flex-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        Select Question Set
                        <ChevronDown className="h-4 w-4 ml-2" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-full">
                      <DropdownMenuLabel>Question Sets</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {selectedCourseData.questionSets
                        .sort((a: any, b: any) => {
                          const aNum = parseInt(a.title.match(/\d+/)?.[0] || '0');
                          const bNum = parseInt(b.title.match(/\d+/)?.[0] || '0');
                          return aNum - bNum;
                        })
                        .map((questionSet: any) => (
                          <DropdownMenuItem 
                            key={questionSet.id}
                            onClick={() => setLocation(`/question-set/${questionSet.id}`)}
                            className="cursor-pointer"
                          >
                            <div className="flex flex-col">
                              <span>{questionSet.title}</span>
                              <span className="text-xs text-muted-foreground">
                                {questionSet.questionCount} questions
                              </span>
                            </div>
                          </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 bg-yellow-100 border border-yellow-400 rounded-lg">
              <p className="text-yellow-800">No courses with question sets found. Debugging info is in console.</p>
            </div>
          )}
        </div>

        {!courses || !Array.isArray(courses) || courses.length === 0 ? (
          <Card className="max-w-md mx-auto bg-card border shadow-sm">
            <CardContent className="pt-6 text-center">
              <BookOpen className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-4" />
              <h3 className="text-base sm:text-lg font-semibold mb-2 text-foreground">No Courses Available</h3>
              <p className="text-muted-foreground text-sm sm:text-base">
                No courses have been set up yet. Please contact your administrator.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {Array.isArray(courses) && courses.map((course: any) => (
              <Card key={course.id} className="bg-card border shadow-sm hover:shadow-md transition-all duration-200">
                <CardHeader className="pb-4">
                  <div className="flex items-start sm:items-center mb-3 sm:mb-4 gap-3">
                    {course.title.toLowerCase().includes("property") ? (
                      <BookOpen className="h-5 w-5 sm:h-6 sm:w-6 text-primary flex-shrink-0 mt-0.5 sm:mt-0" />
                    ) : (
                      <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-primary flex-shrink-0 mt-0.5 sm:mt-0" />
                    )}
                    <div className="min-w-0">
                      <CardTitle className="text-base sm:text-lg leading-tight">{course.title}</CardTitle>
                      <CardDescription className="text-xs sm:text-sm mt-1">{course.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4 pt-0">
                  {/* Important Note */}
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">
                      <strong>IMPORTANT NOTE:</strong> Each question set represents various question types you may encounter on the exam. While the format of the questions will be consistent, the topics they cover may vary. It is essential for you to use these practice questions to become familiar with the exam structure and question formats. However, you should not solely rely on these questions to prepare for all necessary knowledge.
                    </p>
                  </div>

                  {/* Progress Indicator */}
                  <div>
                    <div className="flex justify-between text-xs sm:text-sm text-muted-foreground mb-2">
                      <span>Overall Progress</span>
                      <span>{course.progress}%</span>
                    </div>
                    <Progress value={course.progress} className="h-2" />
                  </div>

                  {(!course.questionSets || course.questionSets.length === 0) ? (
                    <p className="text-sm text-muted-foreground">No question sets available</p>
                  ) : (
                    course.questionSets
                      .sort((a: any, b: any) => {
                        const aNum = parseInt(a.title.match(/\d+/)?.[0] || '0');
                        const bNum = parseInt(b.title.match(/\d+/)?.[0] || '0');
                        return aNum - bNum;
                      })
                      .map((questionSet: any) => (
                      <div key={questionSet.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-accent rounded-lg border gap-3">
                        <div className="flex-1 min-w-0">
                          <h5 className="text-sm font-medium text-foreground truncate">{questionSet.title}</h5>
                          {questionSet.description && (
                            <p className="text-xs text-muted-foreground mt-1">{questionSet.description}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <Badge variant="secondary" className="text-xs bg-muted text-muted-foreground">
                              {questionSet.questionCount} questions
                            </Badge>
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-1 w-full sm:w-auto">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => setLocation(`/question-set/${questionSet.id}`)}
                            className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground"
                          >
                            Practice Questions
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
