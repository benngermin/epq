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
import { Skeleton } from "@/components/ui/skeleton";
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
  UserCheck,
  Target,
  Award,
} from "lucide-react";
import { format } from "date-fns";
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";

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

  // Prepare data for charts
  const userActivityData = overallStats ? [
    { name: 'Today', value: overallStats.activeUsersToday, fill: '#0ea5e9' },
    { name: 'This Week', value: overallStats.activeUsersThisWeek, fill: '#3b82f6' },
    { name: 'This Month', value: overallStats.activeUsersThisMonth, fill: '#6366f1' },
  ] : [];

  const topCoursesByEngagement = courseStats?.slice(0, 10).map(course => ({
    name: course.courseNumber,
    attempts: course.totalAttempts,
    users: course.uniqueUsers,
    score: course.averageScore || 0,
  })) || [];

  const questionSuccessData = questionStats?.byQuestionSet.slice(0, 8).map(qs => ({
    name: qs.questionSetTitle.length > 20 ? qs.questionSetTitle.substring(0, 20) + '...' : qs.questionSetTitle,
    successRate: qs.successRate,
    attempts: qs.totalAttempts,
  })) || [];

  const userPerformanceData = userStats?.slice(0, 10).map(user => ({
    name: user.userName,
    testRuns: user.totalTestRuns,
    successRate: user.totalAnswers > 0 ? (user.correctAnswers / user.totalAnswers * 100) : 0,
  })) || [];

  if (overallLoading || usersLoading || questionsLoading || coursesLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20 mb-2" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate some additional metrics
  const totalSuccessRate = overallStats && overallStats.totalAnswers > 0
    ? ((questionStats?.byQuestionSet.reduce((acc, qs) => acc + qs.correctAttempts, 0) || 0) / overallStats.totalAnswers * 100).toFixed(1)
    : '0';

  const COLORS = ['#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e'];
  
  // Check if we have any data
  const hasData = overallStats && (overallStats.totalTestRuns > 0 || overallStats.totalAnswers > 0);

  return (
    <div className="space-y-6">
      {/* No Data Alert */}
      {!hasData && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <AlertCircle className="h-5 w-5" />
              No Activity Data Available
            </CardTitle>
            <CardDescription className="text-amber-700 dark:text-amber-300">
              The analytics dashboard will populate once users start taking practice tests. 
              Currently showing structure and available metrics.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
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

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-purple-500" />
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

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileQuestion className="h-4 w-4 text-green-500" />
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

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-orange-500" />
              Test Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats?.totalTestRuns || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Success rate: {totalSuccessRate}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Content Distribution Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Content Distribution
            </CardTitle>
            <CardDescription>Questions across courses</CardDescription>
          </CardHeader>
          <CardContent>
            {courseStats && courseStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={courseStats.slice(0, 8).map(c => ({
                  name: c.courseNumber,
                  questions: c.totalQuestions,
                  sets: c.totalQuestionSets
                }))}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))' 
                    }} 
                  />
                  <Bar dataKey="questions" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="sets" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                Loading content data...
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Registration Trend
            </CardTitle>
            <CardDescription>User growth over time</CardDescription>
          </CardHeader>
          <CardContent>
            {userStats && userStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={
                  userStats
                    .sort((a, b) => new Date(a.registeredAt).getTime() - new Date(b.registeredAt).getTime())
                    .reduce((acc: any[], user, index) => {
                      const date = format(new Date(user.registeredAt), "MMM yyyy");
                      const existing = acc.find(item => item.month === date);
                      if (existing) {
                        existing.users++;
                      } else {
                        acc.push({ month: date, users: 1, total: (acc[acc.length - 1]?.total || 0) + 1 });
                      }
                      return acc;
                    }, [])
                    .slice(-12)
                }>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))' 
                    }} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="total" 
                    stroke="#10b981" 
                    fill="#10b981"
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                Loading user data...
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Question Success Rate Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Question Set Performance
          </CardTitle>
          <CardDescription>Success rates by question set</CardDescription>
        </CardHeader>
        <CardContent>
          {questionSuccessData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={questionSuccessData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" angle={-45} textAnchor="end" height={60} />
                <YAxis className="text-xs" domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))' 
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="successRate" 
                  stroke="#10b981" 
                  fill="#10b981" 
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              No question performance data available
            </div>
          )}
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
                            <Progress value={course.averageScore || 0} className="w-16 h-2" />
                            <span className="text-sm">{(course.averageScore || 0).toFixed(1)}%</span>
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