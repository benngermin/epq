import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Users,
  BookOpen,
  FileQuestion,
  Activity,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle,
  Calendar,
  Clock,
  BarChart3,
} from "lucide-react";
import { format } from "date-fns";

interface OverallStats {
  totalUsers: number;
  totalCourses: number;
  totalQuestionSets: number;
  totalQuestions: number;
  totalTestRuns: number;
  totalAnswers: number;
  activeUsersToday: number;
  activeUsersThisWeek: number;
  activeUsersThisMonth: number;
}

interface UserStat {
  userId: number;
  userName: string;
  userEmail: string;
  totalTestRuns: number;
  totalAnswers: number;
  correctAnswers: number;
  lastActive: string | null;
  registeredAt: string;
}

interface QuestionStats {
  byQuestionSet: Array<{
    questionSetId: number;
    questionSetTitle: string;
    courseTitle: string;
    totalAttempts: number;
    correctAttempts: number;
    incorrectAttempts: number;
    successRate: number;
  }>;
  mostFailedQuestions: Array<{
    questionId: number;
    questionText: string;
    questionSetTitle: string;
    failureCount: number;
    totalAttempts: number;
    failureRate: number;
  }>;
}

interface CourseStat {
  courseId: number;
  courseNumber: string;
  courseTitle: string;
  totalQuestionSets: number;
  totalQuestions: number;
  totalAttempts: number;
  uniqueUsers: number;
  averageScore: number;
}

export function AppLogsSection() {
  const { data: overallStats, isLoading: overallLoading } = useQuery<OverallStats>({
    queryKey: ["/api/admin/logs/overview"],
  });

  const { data: userStats, isLoading: usersLoading } = useQuery<UserStat[]>({
    queryKey: ["/api/admin/logs/users"],
  });

  const { data: questionStats, isLoading: questionsLoading } = useQuery<QuestionStats>({
    queryKey: ["/api/admin/logs/questions"],
  });

  const { data: courseStats, isLoading: coursesLoading } = useQuery<CourseStat[]>({
    queryKey: ["/api/admin/logs/courses"],
  });

  if (overallLoading || usersLoading || questionsLoading || coursesLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Loading App Statistics...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-32 bg-muted rounded"></div>
            <div className="h-64 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats?.totalUsers || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Active today: {overallStats?.activeUsersToday || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Courses & Content
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats?.totalCourses || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {overallStats?.totalQuestionSets || 0} question sets
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileQuestion className="h-4 w-4" />
              Total Questions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats?.totalQuestions || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {overallStats?.totalAnswers || 0} answers submitted
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Test Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats?.totalTestRuns || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total test runs
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active Users Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Active Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Today</span>
              <span className="font-semibold">{overallStats?.activeUsersToday || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">This Week</span>
              <span className="font-semibold">{overallStats?.activeUsersThisWeek || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">This Month</span>
              <span className="font-semibold">{overallStats?.activeUsersThisMonth || 0}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Tabs */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="courses">Courses</TabsTrigger>
          <TabsTrigger value="questions">Questions</TabsTrigger>
          <TabsTrigger value="failures">Failed Questions</TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>User Activity</CardTitle>
              <CardDescription>
                Detailed breakdown of user engagement and performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Test Runs</TableHead>
                      <TableHead>Total Answers</TableHead>
                      <TableHead>Success Rate</TableHead>
                      <TableHead>Last Active</TableHead>
                      <TableHead>Registered</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userStats?.map((user) => {
                      const successRate = user.totalAnswers > 0
                        ? ((user.correctAnswers / user.totalAnswers) * 100).toFixed(1)
                        : "0";
                      
                      return (
                        <TableRow key={user.userId}>
                          <TableCell className="font-medium">{user.userName}</TableCell>
                          <TableCell>{user.userEmail}</TableCell>
                          <TableCell>{user.totalTestRuns}</TableCell>
                          <TableCell>{user.totalAnswers}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={parseFloat(successRate)} className="w-16 h-2" />
                              <span className="text-sm">{successRate}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {user.lastActive ? (
                              <div className="flex items-center gap-1 text-sm">
                                <Clock className="h-3 w-3" />
                                {format(new Date(user.lastActive), "MMM dd, yyyy")}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Never</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(user.registeredAt), "MMM dd, yyyy")}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Courses Tab */}
        <TabsContent value="courses">
          <Card>
            <CardHeader>
              <CardTitle>Course Performance</CardTitle>
              <CardDescription>
                Course-level statistics and engagement metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Course</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Question Sets</TableHead>
                      <TableHead>Questions</TableHead>
                      <TableHead>Total Attempts</TableHead>
                      <TableHead>Unique Users</TableHead>
                      <TableHead>Average Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {courseStats?.map((course) => (
                      <TableRow key={course.courseId}>
                        <TableCell className="font-medium">{course.courseNumber}</TableCell>
                        <TableCell>{course.courseTitle}</TableCell>
                        <TableCell>{course.totalQuestionSets}</TableCell>
                        <TableCell>{course.totalQuestions}</TableCell>
                        <TableCell>{course.totalAttempts}</TableCell>
                        <TableCell>{course.uniqueUsers}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={course.averageScore} className="w-16 h-2" />
                            <span className="text-sm">{course.averageScore.toFixed(1)}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Questions Tab */}
        <TabsContent value="questions">
          <Card>
            <CardHeader>
              <CardTitle>Question Set Performance</CardTitle>
              <CardDescription>
                Success rates and attempt statistics by question set
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Question Set</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Total Attempts</TableHead>
                      <TableHead>Correct</TableHead>
                      <TableHead>Incorrect</TableHead>
                      <TableHead>Success Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {questionStats?.byQuestionSet.map((qs) => (
                      <TableRow key={qs.questionSetId}>
                        <TableCell className="font-medium">{qs.questionSetTitle}</TableCell>
                        <TableCell>{qs.courseTitle}</TableCell>
                        <TableCell>{qs.totalAttempts}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="gap-1">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            {qs.correctAttempts}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="gap-1">
                            <XCircle className="h-3 w-3 text-red-500" />
                            {qs.incorrectAttempts}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress 
                              value={qs.successRate} 
                              className={`w-16 h-2 ${qs.successRate < 50 ? "[&>div]:bg-red-500" : qs.successRate < 70 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-green-500"}`}
                            />
                            <span className="text-sm font-medium">{qs.successRate.toFixed(1)}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Failed Questions Tab */}
        <TabsContent value="failures">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                Most Failed Questions
              </CardTitle>
              <CardDescription>
                Questions with the highest failure rates that may need review
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-4">
                  {questionStats?.mostFailedQuestions.map((question, index) => (
                    <Card key={question.questionId} className="border-l-4 border-l-red-500">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium">
                            #{index + 1} - {question.questionSetTitle}
                          </CardTitle>
                          <Badge variant="destructive" className="gap-1">
                            <XCircle className="h-3 w-3" />
                            {question.failureRate.toFixed(1)}% failure rate
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-3">
                          {question.questionText}
                        </p>
                        <div className="flex items-center gap-4 text-sm">
                          <span>
                            <strong>{question.failureCount}</strong> failures
                          </span>
                          <span>
                            <strong>{question.totalAttempts}</strong> total attempts
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}