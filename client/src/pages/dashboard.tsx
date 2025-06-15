import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useLocation } from "wouter";
import { GraduationCap, LogOut, BookOpen, Shield, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const { user, logoutMutation } = useAuth();
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
          <GraduationCap className="mx-auto h-12 w-12 text-primary animate-pulse mb-4" />
          <p className="text-muted-foreground">Loading your courses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <nav className="bg-card shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center min-w-0 flex-1">
              <GraduationCap className="h-5 w-5 sm:h-6 sm:w-6 text-primary mr-2 sm:mr-3 flex-shrink-0" />
              <span className="font-semibold text-foreground text-sm sm:text-base truncate">CPC Practice Platform</span>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <span className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Welcome, {user?.name}</span>
              {user?.isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLocation("/admin")}
                  className="hidden sm:flex"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Admin
                </Button>
              )}
              {user?.isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLocation("/admin")}
                  className="sm:hidden"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => logoutMutation.mutate()}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">My Courses</h1>
          <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">Continue your exam preparation journey</p>
        </div>

        {!courses || courses.length === 0 ? (
          <Card className="max-w-md mx-auto">
            <CardContent className="pt-6 text-center">
              <BookOpen className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-4" />
              <h3 className="text-base sm:text-lg font-semibold mb-2">No Courses Available</h3>
              <p className="text-muted-foreground text-sm sm:text-base">
                No courses have been set up yet. Please contact your administrator.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {courses.map((course: any) => (
              <Card key={course.id} className="hover:shadow-md transition-shadow">
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
                  {/* Progress Indicator */}
                  <div>
                    <div className="flex justify-between text-xs sm:text-sm text-muted-foreground mb-2">
                      <span>Overall Progress</span>
                      <span>{course.progress}%</span>
                    </div>
                    <Progress value={course.progress} className="h-2" />
                  </div>

                  {/* Practice Tests */}
                  <div className="space-y-2">
                    <h4 className="font-medium text-foreground text-sm">Practice Tests</h4>
                    
                    {course.practiceTests?.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No practice tests available</p>
                    ) : (
                      course.practiceTests?.map((test: any) => (
                        <div key={test.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-muted rounded-lg gap-3">
                          <div className="flex-1 min-w-0">
                            <h5 className="text-sm font-medium text-foreground truncate">{test.title}</h5>
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              <Badge
                                variant="secondary"
                                className={`text-xs text-white ${getStatusColor(test.status)}`}
                              >
                                {test.status}
                              </Badge>
                              {test.score && (
                                <span className="text-xs text-muted-foreground">
                                  Score: {test.score}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2 sm:gap-1 w-full sm:w-auto">
                            {test.status === "Completed" ? (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => resumeTest(test.testRun)}
                                  className="w-full sm:w-auto"
                                >
                                  Review
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => restartTestMutation.mutate(test.id)}
                                  disabled={restartTestMutation.isPending}
                                  className="w-full sm:w-auto"
                                >
                                  Restart
                                </Button>
                              </>
                            ) : test.status === "In Progress" ? (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => resumeTest(test.testRun)}
                                  className="w-full sm:w-auto"
                                >
                                  Continue
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => restartTestMutation.mutate(test.id)}
                                  disabled={restartTestMutation.isPending}
                                  className="w-full sm:w-auto"
                                >
                                  Start Over
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => startTestMutation.mutate(test.id)}
                                disabled={startTestMutation.isPending}
                                className="w-full sm:w-auto"
                              >
                                Start Test
                              </Button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
