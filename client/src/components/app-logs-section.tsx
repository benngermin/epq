import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
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
  Search,
  Filter,
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
  testRunsStartedToday: number;
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

interface UsageData {
  date?: string;
  courseName?: string;
  count: number;
}

export function AppLogsSection() {
  const { data: overallStats, isLoading: overallLoading } = useQuery<OverallStats>({
    queryKey: ["/api/admin/logs/overview"],
    refetchInterval: 30000, // Refetch every 30 seconds
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

  // State for chart controls
  const [questionSetGroupBy, setQuestionSetGroupBy] = useState<'day' | 'week' | 'month'>('day');
  const [questionSetViewType, setQuestionSetViewType] = useState<'date' | 'course'>('date');
  const [questionsAnsweredGroupBy, setQuestionsAnsweredGroupBy] = useState<'day' | 'week' | 'month'>('day');
  const [questionsAnsweredViewType, setQuestionsAnsweredViewType] = useState<'date' | 'course'>('date');

  // Fetch question set usage data
  const { data: questionSetUsageData, isLoading: questionSetUsageLoading } = useQuery<UsageData[]>({
    queryKey: ["/api/admin/logs/question-set-usage", { groupBy: questionSetGroupBy, viewType: questionSetViewType }],
    queryFn: async () => {
      const response = await fetch(`/api/admin/logs/question-set-usage?groupBy=${questionSetGroupBy}&viewType=${questionSetViewType}`);
      if (!response.ok) throw new Error('Failed to fetch question set usage');
      return response.json();
    },
  });

  // Fetch questions answered data
  const { data: questionsAnsweredData, isLoading: questionsAnsweredLoading } = useQuery<UsageData[]>({
    queryKey: ["/api/admin/logs/questions-answered", { groupBy: questionsAnsweredGroupBy, viewType: questionsAnsweredViewType }],
    queryFn: async () => {
      const response = await fetch(`/api/admin/logs/questions-answered?groupBy=${questionsAnsweredGroupBy}&viewType=${questionsAnsweredViewType}`);
      if (!response.ok) throw new Error('Failed to fetch questions answered');
      return response.json();
    },
  });

  // User filtering state
  const [searchTerm, setSearchTerm] = useState("");
  const [activityFilter, setActivityFilter] = useState("all");
  const [performanceFilter, setPerformanceFilter] = useState("all");

  // Format chart data
  const formatDateLabel = (dateStr: string, groupBy: 'day' | 'week' | 'month') => {
    const date = new Date(dateStr);
    switch(groupBy) {
      case 'week':
        return format(date, 'MMM dd');
      case 'month':
        return format(date, 'MMM yyyy');
      default:
        return format(date, 'MMM dd');
    }
  };

  const questionSetChartData = useMemo(() => {
    if (!questionSetUsageData) return [];
    
    if (questionSetViewType === 'course') {
      return questionSetUsageData.map(item => ({
        name: item.courseName || '',
        value: item.count
      }));
    } else {
      return questionSetUsageData.map(item => ({
        name: formatDateLabel(item.date || '', questionSetGroupBy),
        value: item.count
      }));
    }
  }, [questionSetUsageData, questionSetViewType, questionSetGroupBy]);

  const questionsAnsweredChartData = useMemo(() => {
    if (!questionsAnsweredData) return [];
    
    if (questionsAnsweredViewType === 'course') {
      return questionsAnsweredData.map(item => ({
        name: item.courseName || '',
        value: item.count
      }));
    } else {
      return questionsAnsweredData.map(item => ({
        name: formatDateLabel(item.date || '', questionsAnsweredGroupBy),
        value: item.count
      }));
    }
  }, [questionsAnsweredData, questionsAnsweredViewType, questionsAnsweredGroupBy]);

  // Filter and sort users based on search and filters
  const filteredUsers = useMemo(() => {
    if (!userStats) return [];
    
    return userStats.filter(user => {
      // Search filter
      const matchesSearch = searchTerm === "" || 
        user.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.userEmail.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Activity filter
      let matchesActivity = true;
      if (activityFilter === "active") {
        matchesActivity = user.totalTestRuns > 0;
      } else if (activityFilter === "inactive") {
        matchesActivity = user.totalTestRuns === 0;
      } else if (activityFilter === "recent") {
        matchesActivity = user.lastActive !== null && 
          new Date(user.lastActive) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
      }
      
      // Performance filter
      let matchesPerformance = true;
      const successRate = user.totalAnswers > 0 ? (user.correctAnswers / user.totalAnswers * 100) : 0;
      if (performanceFilter === "high") {
        matchesPerformance = successRate >= 80;
      } else if (performanceFilter === "medium") {
        matchesPerformance = successRate >= 50 && successRate < 80;
      } else if (performanceFilter === "low") {
        matchesPerformance = successRate < 50 && user.totalAnswers > 0;
      } else if (performanceFilter === "nodata") {
        matchesPerformance = user.totalAnswers === 0;
      }
      
      return matchesSearch && matchesActivity && matchesPerformance;
    }).sort((a, b) => a.userName.localeCompare(b.userName)); // Sort alphabetically by username
  }, [userStats, searchTerm, activityFilter, performanceFilter]);

  // Sort course stats by total attempts (highest first)
  const sortedCourseStats = useMemo(() => {
    if (!courseStats) return [];
    return [...courseStats].sort((a, b) => b.totalAttempts - a.totalAttempts);
  }, [courseStats]);

  // Sort question stats by total attempts (highest first)
  const sortedQuestionStats = useMemo(() => {
    if (!questionStats?.byQuestionSet) return [];
    return [...questionStats.byQuestionSet].sort((a, b) => b.totalAttempts - a.totalAttempts);
  }, [questionStats?.byQuestionSet]);

  // Sort failed questions by failure rate (highest first), then alphabetically by title
  const sortedFailedQuestions = useMemo(() => {
    if (!questionStats?.mostFailedQuestions) return [];
    return [...questionStats.mostFailedQuestions].sort((a, b) => {
      if (a.failureRate !== b.failureRate) {
        return b.failureRate - a.failureRate; // Highest failure rate first
      }
      return a.questionSetTitle.localeCompare(b.questionSetTitle); // Then alphabetically
    });
  }, [questionStats?.mostFailedQuestions]);

  if (overallLoading || usersLoading || questionsLoading || coursesLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
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
              The analytics dashboard will populate once users start taking question sets. 
              Currently showing structure and available metrics.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-orange-500" />
              Total Question Sets Started
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats?.totalTestRuns || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Started today: {overallStats?.testRunsStartedToday || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Question Set Usage Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Question Set Usage
              </CardTitle>
              <CardDescription>
                {questionSetViewType === 'date' 
                  ? `Question sets started by ${questionSetGroupBy}`
                  : 'Question sets by course'}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={questionSetViewType} onValueChange={(value: 'date' | 'course') => setQuestionSetViewType(value)}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">By Date</SelectItem>
                  <SelectItem value="course">By Course</SelectItem>
                </SelectContent>
              </Select>
              {questionSetViewType === 'date' && (
                <Select value={questionSetGroupBy} onValueChange={(value: 'day' | 'week' | 'month') => setQuestionSetGroupBy(value)}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Day</SelectItem>
                    <SelectItem value="week">Week</SelectItem>
                    <SelectItem value="month">Month</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {questionSetChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              {questionSetViewType === 'date' ? (
                <AreaChart data={questionSetChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="name" 
                    className="text-xs" 
                    angle={questionSetChartData.length > 10 ? -45 : 0}
                    textAnchor={questionSetChartData.length > 10 ? "end" : "middle"}
                    height={questionSetChartData.length > 10 ? 60 : 30}
                  />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))' 
                    }} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#3b82f6" 
                    fill="#3b82f6" 
                    fillOpacity={0.3}
                    name="Question Sets"
                  />
                </AreaChart>
              ) : (
                <BarChart data={questionSetChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="name" 
                    className="text-xs"
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))' 
                    }} 
                  />
                  <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} name="Question Sets" />
                </BarChart>
              )}
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              {questionSetUsageLoading ? 'Loading...' : 'No data available'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Questions Answered Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileQuestion className="h-5 w-5" />
                Questions Answered
              </CardTitle>
              <CardDescription>
                {questionsAnsweredViewType === 'date' 
                  ? `Total questions answered by ${questionsAnsweredGroupBy}`
                  : 'Questions answered by course'}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={questionsAnsweredViewType} onValueChange={(value: 'date' | 'course') => setQuestionsAnsweredViewType(value)}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">By Date</SelectItem>
                  <SelectItem value="course">By Course</SelectItem>
                </SelectContent>
              </Select>
              {questionsAnsweredViewType === 'date' && (
                <Select value={questionsAnsweredGroupBy} onValueChange={(value: 'day' | 'week' | 'month') => setQuestionsAnsweredGroupBy(value)}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Day</SelectItem>
                    <SelectItem value="week">Week</SelectItem>
                    <SelectItem value="month">Month</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {questionsAnsweredChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              {questionsAnsweredViewType === 'date' ? (
                <AreaChart data={questionsAnsweredChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="name" 
                    className="text-xs" 
                    angle={questionsAnsweredChartData.length > 10 ? -45 : 0}
                    textAnchor={questionsAnsweredChartData.length > 10 ? "end" : "middle"}
                    height={questionsAnsweredChartData.length > 10 ? 60 : 30}
                  />
                  <YAxis 
                    className="text-xs" 
                    tickCount={8}
                    tickFormatter={(value) => value.toLocaleString()}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))' 
                    }} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#10b981" 
                    fill="#10b981" 
                    fillOpacity={0.3}
                    name="Questions"
                  />
                </AreaChart>
              ) : (
                <BarChart data={questionsAnsweredChartData} margin={{ top: 20, right: 30, left: 20, bottom: 100 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="name" 
                    className="text-xs"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    interval={0}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis 
                    className="text-xs" 
                    tickCount={8}
                    tickFormatter={(value) => value.toLocaleString()}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))' 
                    }}
                    formatter={(value: any) => [value.toLocaleString(), 'Questions']}
                  />
                  <Bar 
                    dataKey="value" 
                    fill="#10b981" 
                    radius={[8, 8, 0, 0]} 
                    name="Questions"
                  />
                </BarChart>
              )}
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              {questionsAnsweredLoading ? 'Loading...' : 'No data available'}
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
              {/* Search and Filter Controls */}
              <div className="mb-6 space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input
                        placeholder="Search by name or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Select value={activityFilter} onValueChange={setActivityFilter}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Activity Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Users</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="recent">Recently Active</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={performanceFilter} onValueChange={setPerformanceFilter}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Performance Level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Performance</SelectItem>
                        <SelectItem value="high">High (≥80%)</SelectItem>
                        <SelectItem value="medium">Medium (50-79%)</SelectItem>
                        <SelectItem value="low">Low (&lt;50%)</SelectItem>
                        <SelectItem value="nodata">No Data</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    <span>Showing {filteredUsers.length} of {userStats?.length || 0} users</span>
                  </div>
                </div>
              </div>
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Question Sets</TableHead>
                      <TableHead>Total Answers</TableHead>
                      <TableHead>Success Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => {
                      // Validate success rate calculation
                      const calculatedSuccessRate = user.totalAnswers > 0
                        ? ((user.correctAnswers / user.totalAnswers) * 100)
                        : 0;
                      
                      return (
                        <TableRow key={user.userId}>
                          <TableCell className="font-medium">{user.userName}</TableCell>
                          <TableCell>{user.userEmail}</TableCell>
                          <TableCell>{user.totalTestRuns}</TableCell>
                          <TableCell>{user.totalAnswers}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={calculatedSuccessRate} className="w-16 h-2" />
                              <span className="text-sm">{calculatedSuccessRate.toFixed(1)}%</span>
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
                    {sortedCourseStats?.map((course) => (
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
                    {sortedQuestionStats?.map((qs) => {
                      // Validate success rate calculation
                      const calculatedSuccessRate = qs.totalAttempts > 0 
                        ? ((qs.correctAttempts / qs.totalAttempts) * 100) 
                        : 0;
                      
                      return (
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
                                value={calculatedSuccessRate} 
                                className={`w-16 h-2 ${calculatedSuccessRate < 50 ? "[&>div]:bg-red-500" : calculatedSuccessRate < 70 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-green-500"}`}
                              />
                              <span className="text-sm font-medium">{calculatedSuccessRate.toFixed(1)}%</span>
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
                  {sortedFailedQuestions?.map((question, index) => {
                    // Validate failure rate calculation
                    const calculatedFailureRate = question.totalAttempts > 0 
                      ? ((question.failureCount / question.totalAttempts) * 100) 
                      : 0;
                    
                    return (
                      <Card key={question.questionId} className="border-l-4 border-l-red-500">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium">
                              #{index + 1} - {question.questionSetTitle}
                            </CardTitle>
                            <Badge variant="destructive" className="gap-1">
                              <XCircle className="h-3 w-3" />
                              {calculatedFailureRate.toFixed(1)}% failure rate
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
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}