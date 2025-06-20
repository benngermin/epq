import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import TopNavigation from "@/components/TopNavigation";

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: courses, isLoading } = useQuery({
    queryKey: ["/api/courses"],
  });

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
    console.log("Resuming test with run:", testRun);
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
          <div className="mx-auto h-12 w-12 text-primary animate-pulse mb-4 bg-blue-600 rounded-full flex items-center justify-center">
            <span className="text-white text-lg font-bold">📚</span>
          </div>
          <p className="text-muted-foreground">Loading your courses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNavigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">My Courses</h1>
        </div>

        {!courses || !Array.isArray(courses) || courses.length === 0 ? (
          <Card className="max-w-md mx-auto bg-card border shadow-sm">
            <CardContent className="pt-6 text-center">
              <div className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-4 bg-gray-200 rounded-full flex items-center justify-center">
                <span className="text-gray-500 text-lg font-bold">📚</span>
              </div>
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
                    <div className="h-5 w-5 sm:h-6 sm:w-6 text-primary flex-shrink-0 mt-0.5 sm:mt-0 bg-blue-600 rounded flex items-center justify-center">
                      <span className="text-white text-xs font-bold">C</span>
                    </div>
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
                    course.questionSets.map((questionSet: any) => (
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
