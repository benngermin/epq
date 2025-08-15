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
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Eye,
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
  LabelList,
} from "recharts";
import { CourseHierarchyLogs } from "./course-hierarchy-logs";
import { ConversationViewerModal } from "./conversation-viewer-modal";

// Utility function to format numbers with commas
const formatNumber = (num: number): string => {
  return num.toLocaleString();
};

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
  testRunsThisWeek: number;
  testRunsThisMonth: number;
  answersToday: number;
  answersThisWeek: number;
  answersThisMonth: number;
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

interface FeedbackData {
  id: number;
  userId: number | null;
  userName: string;
  userEmail: string;
  messageId: string;
  feedbackType: string;
  feedbackMessage: string | null;
  assistantMessage: string | null;
  conversation: Array<{id: string, content: string, role: "user" | "assistant"}> | null;
  createdAt: string;
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
  isAi?: boolean;
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
  // State for time scale filter
  const [timeScale, setTimeScale] = useState<'day' | 'week' | 'month' | 'all'>('day');
  
  // State for conversation viewer modal
  const [selectedFeedback, setSelectedFeedback] = useState<{id: number, messageId: string} | null>(null);

  const { data: overallStats, isLoading: overallLoading } = useQuery<OverallStats>({
    queryKey: ["/api/admin/logs/overview", timeScale],
    queryFn: async () => {
      const response = await fetch(`/api/admin/logs/overview?timeScale=${timeScale}`);
      if (!response.ok) throw new Error('Failed to fetch overview stats');
      return response.json();
    },
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

  const { data: feedbackData, isLoading: feedbackLoading } = useQuery<FeedbackData[]>({
    queryKey: ["/api/admin/logs/feedback"],
  });

  // State for chart controls
  const [questionSetGroupBy, setQuestionSetGroupBy] = useState<'day' | 'week' | 'month'>('day');
  const [questionSetViewType, setQuestionSetViewType] = useState<'date' | 'course'>('date');
  const [questionSetTimeRange, setQuestionSetTimeRange] = useState<'day' | 'week' | 'month' | 'all'>('all');
  const [questionsAnsweredGroupBy, setQuestionsAnsweredGroupBy] = useState<'day' | 'week' | 'month'>('day');
  const [questionsAnsweredViewType, setQuestionsAnsweredViewType] = useState<'date' | 'course'>('date');
  const [questionsAnsweredTimeRange, setQuestionsAnsweredTimeRange] = useState<'day' | 'week' | 'month' | 'all'>('all');

  // Fetch question set usage data
  const { data: questionSetUsageData, isLoading: questionSetUsageLoading } = useQuery<UsageData[]>({
    queryKey: ["/api/admin/logs/question-set-usage", { groupBy: questionSetGroupBy, viewType: questionSetViewType, timeRange: questionSetTimeRange }],
    queryFn: async () => {
      const response = await fetch(`/api/admin/logs/question-set-usage?groupBy=${questionSetGroupBy}&viewType=${questionSetViewType}&timeRange=${questionSetTimeRange}`);
      if (!response.ok) throw new Error('Failed to fetch question set usage');
      return response.json();
    },
  });

  // Fetch questions answered data
  const { data: questionsAnsweredData, isLoading: questionsAnsweredLoading } = useQuery<UsageData[]>({
    queryKey: ["/api/admin/logs/questions-answered", { groupBy: questionsAnsweredGroupBy, viewType: questionsAnsweredViewType, timeRange: questionsAnsweredTimeRange }],
    queryFn: async () => {
      const response = await fetch(`/api/admin/logs/questions-answered?groupBy=${questionsAnsweredGroupBy}&viewType=${questionsAnsweredViewType}&timeRange=${questionsAnsweredTimeRange}`);
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
    // Parse the date string as noon to avoid timezone issues
    // When we parse "2025-08-08" we want it to be that date in local time
    // Adding T12:00:00 ensures we're in the middle of the day to avoid DST edge cases
    const date = new Date(dateStr + 'T12:00:00');
    
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

  // Group question stats by course and sort
  const groupedQuestionStats = useMemo(() => {
    if (!questionStats?.byQuestionSet || !courseStats) return [];
    
    // Group by course title
    const grouped = questionStats.byQuestionSet.reduce((acc, qs) => {
      const courseKey = qs.courseTitle || 'Unknown Course';
      if (!acc[courseKey]) {
        // Find the course number from courseStats
        const course = courseStats.find(c => c.courseTitle === qs.courseTitle);
        acc[courseKey] = {
          courseNumber: course?.courseNumber || 'Unknown',
          courseTitle: qs.courseTitle || 'Unknown Course',
          questionSets: [],
          totalAttempts: 0
        };
      }
      acc[courseKey].questionSets.push(qs);
      acc[courseKey].totalAttempts += qs.totalAttempts;
      return acc;
    }, {} as Record<string, any>);
    
    // Sort courses by total attempts, then sort question sets within each course
    return Object.values(grouped)
      .sort((a, b) => b.totalAttempts - a.totalAttempts)
      .map(course => ({
        ...course,
        questionSets: course.questionSets.sort((a: any, b: any) => b.totalAttempts - a.totalAttempts)
      }));
  }, [questionStats?.byQuestionSet, courseStats]);

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

      {/* Time Scale Dropdown */}
      <div className="flex justify-end mb-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Time Range:</span>
          <Select value={timeScale} onValueChange={(value: 'day' | 'week' | 'month' | 'all') => setTimeScale(value)}>
            <SelectTrigger className="w-[140px] border-2 border-primary/20 hover:border-primary/40 transition-colors">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Day</SelectItem>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(
                timeScale === 'all' ? overallStats?.totalUsers || 0 : 
                timeScale === 'day' ? overallStats?.activeUsersToday || 0 :
                timeScale === 'week' ? overallStats?.activeUsersThisWeek || 0 :
                overallStats?.activeUsersThisMonth || 0
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {timeScale === 'all' ? 'Total registered' :
               timeScale === 'day' ? 'Active today' :
               timeScale === 'week' ? 'Active this week' :
               'Active this month'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-orange-500" />
              Question Sets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(
                timeScale === 'all' ? overallStats?.totalTestRuns || 0 :
                timeScale === 'day' ? overallStats?.testRunsStartedToday || 0 :
                timeScale === 'week' ? overallStats?.testRunsThisWeek || 0 :
                overallStats?.testRunsThisMonth || 0
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {timeScale === 'all' ? 'Total started' :
               timeScale === 'day' ? 'Started today' :
               timeScale === 'week' ? 'Started this week' :
               'Started this month'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Question Answers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(
                timeScale === 'all' ? overallStats?.totalAnswers || 0 :
                timeScale === 'day' ? overallStats?.answersToday || 0 :
                timeScale === 'week' ? overallStats?.answersThisWeek || 0 :
                overallStats?.answersThisMonth || 0
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {timeScale === 'all' ? 'Total answered' :
               timeScale === 'day' ? 'Answered today' :
               timeScale === 'week' ? 'Answered this week' :
               'Answered this month'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Side-by-side Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Question Set Usage Chart */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-5 w-5" />
                  Question Set Usage
                </CardTitle>
                <CardDescription>
                  {questionSetViewType === 'date' 
                    ? `Question sets started by ${questionSetGroupBy} (${questionSetTimeRange === 'all' ? 'All Time' : `Last ${questionSetTimeRange}`})`
                    : `Question sets by course (${questionSetTimeRange === 'all' ? 'All Time' : `Last ${questionSetTimeRange}`})`}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Select value={questionSetTimeRange} onValueChange={(value: 'day' | 'week' | 'month' | 'all') => setQuestionSetTimeRange(value)}>
                  <SelectTrigger className="w-[110px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Last Day</SelectItem>
                    <SelectItem value="week">Last Week</SelectItem>
                    <SelectItem value="month">Last Month</SelectItem>
                    <SelectItem value="all">All Time</SelectItem>
                  </SelectContent>
                </Select>
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
              <ResponsiveContainer width="100%" height={350}>
                {questionSetViewType === 'date' ? (
                  <AreaChart data={questionSetChartData} margin={{ right: 20, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="name" 
                      className="text-xs" 
                      angle={questionSetChartData.length > 8 ? -45 : 0}
                      textAnchor={questionSetChartData.length > 8 ? "end" : "middle"}
                      height={questionSetChartData.length > 8 ? 60 : 30}
                      interval={0}
                      tick={{ 
                        fill: 'hsl(var(--foreground))', 
                        fontSize: 11,
                        fontWeight: 500
                      }}
                    />
                    <YAxis className="text-xs" tick={{ 
                      fill: 'hsl(var(--foreground))', 
                      fontSize: 11 
                    }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#ffffff', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                        opacity: 0.95
                      }} 
                      wrapperStyle={{ zIndex: 1000 }}
                      formatter={(value: any) => [formatNumber(value), 'Question Sets']}
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
                  <BarChart data={questionSetChartData} margin={{ bottom: 70, left: 10, right: 10, top: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="name" 
                      angle={-45}
                      textAnchor="end"
                      height={70}
                      interval={0}
                      tick={{ 
                        fill: '#000000', 
                        fontSize: 10,
                        fontWeight: 600,
                        dy: 10
                      }}
                      tickLine={{ stroke: '#666666' }}
                      axisLine={{ stroke: '#666666' }}
                    />
                    <YAxis tick={{ 
                      fill: 'hsl(var(--foreground))', 
                      fontSize: 10,
                      fontWeight: 500
                    }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#ffffff', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                        opacity: 0.95
                      }}
                      wrapperStyle={{ zIndex: 1000 }}
                      formatter={(value: any) => [formatNumber(value), 'Question Sets']}
                    />
                    <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} name="Question Sets">
                      <LabelList 
                        position="top" 
                        fill="#333333" 
                        fontSize={10} 
                        fontWeight={600}
                        offset={3}
                      />
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[350px] text-muted-foreground">
                {questionSetUsageLoading ? 'Loading...' : 'No data available'}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Questions Answered Chart */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileQuestion className="h-5 w-5" />
                  Questions Answered
                </CardTitle>
                <CardDescription>
                  {questionsAnsweredViewType === 'date' 
                    ? `Total questions answered by ${questionsAnsweredGroupBy} (${questionsAnsweredTimeRange === 'all' ? 'All Time' : `Last ${questionsAnsweredTimeRange}`})`
                    : `Questions answered by course (${questionsAnsweredTimeRange === 'all' ? 'All Time' : `Last ${questionsAnsweredTimeRange}`})`}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Select value={questionsAnsweredTimeRange} onValueChange={(value: 'day' | 'week' | 'month' | 'all') => setQuestionsAnsweredTimeRange(value)}>
                  <SelectTrigger className="w-[110px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Last Day</SelectItem>
                    <SelectItem value="week">Last Week</SelectItem>
                    <SelectItem value="month">Last Month</SelectItem>
                    <SelectItem value="all">All Time</SelectItem>
                  </SelectContent>
                </Select>
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
              <ResponsiveContainer width="100%" height={350}>
                {questionsAnsweredViewType === 'date' ? (
                  <AreaChart data={questionsAnsweredChartData} margin={{ right: 20, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="name" 
                      className="text-xs" 
                      angle={questionsAnsweredChartData.length > 8 ? -45 : 0}
                      textAnchor={questionsAnsweredChartData.length > 8 ? "end" : "middle"}
                      height={questionsAnsweredChartData.length > 8 ? 60 : 30}
                      interval={0}
                      tick={{ 
                        fill: 'hsl(var(--foreground))', 
                        fontSize: 11,
                        fontWeight: 500
                      }}
                    />
                    <YAxis 
                      className="text-xs" 
                      tickCount={7}
                      tickFormatter={(value) => value.toLocaleString()}
                      tick={{ 
                        fill: 'hsl(var(--foreground))', 
                        fontSize: 11 
                      }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#ffffff', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                        opacity: 0.95
                      }} 
                      wrapperStyle={{ zIndex: 1000 }}
                      formatter={(value: any) => [formatNumber(value), 'Questions']}
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
                  <BarChart data={questionsAnsweredChartData} margin={{ bottom: 70, left: 10, right: 10, top: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="name" 
                      angle={-45}
                      textAnchor="end"
                      height={70}
                      interval={0}
                      tick={{ 
                        fill: '#000000', 
                        fontSize: 10,
                        fontWeight: 600,
                        dy: 10
                      }}
                      tickLine={{ stroke: '#666666' }}
                      axisLine={{ stroke: '#666666' }}
                    />
                    <YAxis 
                      tickCount={7}
                      tickFormatter={(value) => value.toLocaleString()}
                      tick={{ 
                        fill: 'hsl(var(--foreground))', 
                        fontSize: 10,
                        fontWeight: 500
                      }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#ffffff', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                        opacity: 0.95
                      }}
                      wrapperStyle={{ zIndex: 1000 }}
                      formatter={(value: any) => [value.toLocaleString(), 'Questions']}
                    />
                    <Bar 
                      dataKey="value" 
                      fill="#10b981" 
                      radius={[6, 6, 0, 0]} 
                      name="Questions"
                    >
                      <LabelList 
                        position="top" 
                        fill="#333333" 
                        fontSize={10} 
                        fontWeight={600}
                        offset={3}
                      />
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[350px] text-muted-foreground">
                {questionsAnsweredLoading ? 'Loading...' : 'No data available'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tabs */}
      <Tabs defaultValue="courses" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="courses">Courses</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
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
                    <span>Showing {formatNumber(filteredUsers.length)} of {formatNumber(userStats?.length || 0)} users</span>
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
                          <TableCell>{formatNumber(user.totalTestRuns)}</TableCell>
                          <TableCell>{formatNumber(user.totalAnswers)}</TableCell>
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

        {/* Courses Tab - Now shows hierarchical view */}
        <TabsContent value="courses">
          <CourseHierarchyLogs />
        </TabsContent>

        {/* Feedback Tab */}
        <TabsContent value="feedback">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                User Feedback
              </CardTitle>
              <CardDescription>
                All feedback submitted by users on AI assistant responses
              </CardDescription>
            </CardHeader>
            <CardContent>
              {feedbackLoading ? (
                <div className="flex items-center justify-center h-[400px]">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : !feedbackData || feedbackData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-lg font-medium">No feedback yet</p>
                  <p className="text-sm mt-2">User feedback will appear here when submitted</p>
                </div>
              ) : (
                <ScrollArea className="h-[600px]">
                  <div className="space-y-4">
                    {feedbackData.map((feedback) => (
                      <div key={feedback.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${
                              feedback.feedbackType === 'positive' 
                                ? 'bg-green-100 text-green-600' 
                                : 'bg-red-100 text-red-600'
                            }`}>
                              {feedback.feedbackType === 'positive' ? (
                                <ThumbsUp className="h-4 w-4" />
                              ) : (
                                <ThumbsDown className="h-4 w-4" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium">{feedback.userName}</p>
                              <p className="text-sm text-muted-foreground">{feedback.userEmail}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant={feedback.feedbackType === 'positive' ? 'default' : 'destructive'}>
                              {feedback.feedbackType}
                            </Badge>
                            <p className="text-sm text-muted-foreground mt-1">
                              {format(new Date(feedback.createdAt), 'MMM dd, yyyy h:mm a')}
                            </p>
                          </div>
                        </div>
                        
                        {feedback.feedbackMessage && (
                          <div className="bg-muted/50 rounded-lg p-3">
                            <p className="text-sm font-medium mb-1">User Feedback:</p>
                            <p className="text-sm">{feedback.feedbackMessage}</p>
                          </div>
                        )}
                        
                        <div className="flex justify-end pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedFeedback({id: feedback.id, messageId: feedback.messageId})}
                            className="flex items-center gap-1"
                          >
                            <Eye className="h-3 w-3" />
                            View Conversation
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Conversation Viewer Modal */}
      {selectedFeedback && (
        <ConversationViewerModal
          isOpen={!!selectedFeedback}
          onClose={() => setSelectedFeedback(null)}
          feedbackId={selectedFeedback.id}
          messageId={selectedFeedback.messageId}
        />
      )}
    </div>
  );
}