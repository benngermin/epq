import { useState } from "react";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronRight,
  ChevronDown,
  BookOpen,
  FileQuestion,
  HelpCircle,
  TrendingUp,
  TrendingDown,
  Users,
  Target,
  AlertCircle,
} from "lucide-react";

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

interface QuestionSetStat {
  questionSetId: number;
  questionSetTitle: string;
  courseTitle: string;
  totalAttempts: number;
  correctAttempts: number;
  incorrectAttempts: number;
  successRate: number;
}

interface QuestionSetDetailedStats {
  questionSetInfo: {
    id: number;
    title: string;
    courseTitle: string;
    courseNumber: string;
    totalQuestions: number;
    totalAttempts: number;
    successRate: number;
  };
  questions: Array<{
    questionId: number;
    questionNumber: number;
    questionText: string;
    totalAttempts: number;
    correctAttempts: number;
    incorrectAttempts: number;
    successRate: number;
    averageTimeSpent: number;
  }>;
}

export function CourseHierarchyLogs() {
  const [expandedCourses, setExpandedCourses] = useState<Set<number>>(new Set());
  const [expandedQuestionSets, setExpandedQuestionSets] = useState<Set<number>>(new Set());
  const [loadingQuestionSets, setLoadingQuestionSets] = useState<Set<number>>(new Set());

  // Fetch course stats
  const { data: courseStats, isLoading: coursesLoading } = useQuery<CourseStat[]>({
    queryKey: ["/api/admin/logs/courses"],
  });

  // Fetch question stats (grouped by question set)
  const { data: questionStats, isLoading: questionsLoading } = useQuery<{
    byQuestionSet: QuestionSetStat[];
  }>({
    queryKey: ["/api/admin/logs/questions"],
  });

  // Function to fetch detailed stats for a specific question set
  const fetchQuestionSetDetails = async (questionSetId: number) => {
    setLoadingQuestionSets(prev => new Set(prev).add(questionSetId));
    
    try {
      const response = await fetch(`/api/admin/logs/question-set/${questionSetId}/details`);
      if (!response.ok) throw new Error('Failed to fetch question set details');
      const data: QuestionSetDetailedStats = await response.json();
      
      // Store in cache for future use
      return data;
    } finally {
      setLoadingQuestionSets(prev => {
        const newSet = new Set(prev);
        newSet.delete(questionSetId);
        return newSet;
      });
    }
  };

  // Use separate queries for each expanded question set
  const questionSetQueries = Array.from(expandedQuestionSets).map(questionSetId => 
    useQuery<QuestionSetDetailedStats>({
      queryKey: [`/api/admin/logs/question-set/${questionSetId}/details`],
      queryFn: () => fetchQuestionSetDetails(questionSetId),
      enabled: expandedQuestionSets.has(questionSetId),
    })
  );

  const toggleCourse = (courseId: number) => {
    setExpandedCourses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(courseId)) {
        newSet.delete(courseId);
        // Also collapse all question sets in this course
        const courseQuestionSets = questionStats?.byQuestionSet
          .filter(qs => courseStats?.find(c => c.courseId === courseId && c.courseTitle === qs.courseTitle))
          .map(qs => qs.questionSetId) || [];
        courseQuestionSets.forEach(qsId => expandedQuestionSets.delete(qsId));
        setExpandedQuestionSets(new Set(expandedQuestionSets));
      } else {
        newSet.add(courseId);
      }
      return newSet;
    });
  };

  const toggleQuestionSet = (questionSetId: number) => {
    setExpandedQuestionSets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionSetId)) {
        newSet.delete(questionSetId);
      } else {
        newSet.add(questionSetId);
      }
      return newSet;
    });
  };

  // Group question sets by course
  const groupedData = courseStats?.map(course => {
    const courseQuestionSets = questionStats?.byQuestionSet.filter(
      qs => qs.courseTitle === course.courseTitle
    ) || [];
    
    return {
      ...course,
      questionSets: courseQuestionSets,
    };
  }) || [];

  if (coursesLoading || questionsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Course Performance Hierarchy</CardTitle>
          <CardDescription>Loading course and question data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Course Performance Hierarchy
        </CardTitle>
        <CardDescription>
          Comprehensive view of courses, question sets, and individual question performance
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[700px] pr-4">
          <div className="space-y-4">
            {groupedData.map(course => {
              const isExpanded = expandedCourses.has(course.courseId);
              const hasData = course.questionSets.length > 0;
              
              return (
                <Card key={course.courseId} className="border-l-4 border-l-primary">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-0 h-auto"
                          onClick={() => toggleCourse(course.courseId)}
                          disabled={!hasData}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-base">
                              {course.courseNumber}
                            </h3>
                            <Badge variant="outline">
                              {course.totalQuestionSets} sets
                            </Badge>
                            <Badge variant="outline">
                              {course.totalQuestions} questions
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {course.courseTitle}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>{course.uniqueUsers} users</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Target className="h-4 w-4 text-muted-foreground" />
                          <span>{course.totalAttempts} attempts</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={course.averageScore || 0} className="w-20 h-2" />
                          <span className="font-medium min-w-[45px]">
                            {(course.averageScore || 0).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <Collapsible open={isExpanded}>
                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        {course.questionSets.length > 0 ? (
                          <div className="space-y-2 ml-8">
                            {course.questionSets.map(questionSet => {
                              const isQSExpanded = expandedQuestionSets.has(questionSet.questionSetId);
                              const isLoadingQS = loadingQuestionSets.has(questionSet.questionSetId);
                              const queryResult = questionSetQueries.find(
                                (_, index) => Array.from(expandedQuestionSets)[index] === questionSet.questionSetId
                              );
                              const detailedStats = queryResult?.data;
                              
                              return (
                                <Card key={questionSet.questionSetId} className="border-l-4 border-l-blue-500">
                                  <CardHeader className="pb-3 bg-muted/30">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3 flex-1">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="p-0 h-auto"
                                          onClick={() => toggleQuestionSet(questionSet.questionSetId)}
                                        >
                                          {isQSExpanded ? (
                                            <ChevronDown className="h-4 w-4" />
                                          ) : (
                                            <ChevronRight className="h-4 w-4" />
                                          )}
                                        </Button>
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2">
                                            <FileQuestion className="h-4 w-4 text-muted-foreground" />
                                            <h4 className="font-medium text-sm">
                                              {questionSet.questionSetTitle}
                                            </h4>
                                            {detailedStats && (
                                              <Badge variant="outline" className="text-xs">
                                                {detailedStats.questionSetInfo.totalQuestions} questions
                                              </Badge>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-4 text-sm">
                                        <span className="text-muted-foreground">
                                          {questionSet.totalAttempts} attempts
                                        </span>
                                        <div className="flex items-center gap-2">
                                          <span className="text-green-600 font-medium">
                                            {questionSet.correctAttempts}
                                          </span>
                                          <span className="text-muted-foreground">/</span>
                                          <span className="text-red-600 font-medium">
                                            {questionSet.incorrectAttempts}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <Progress 
                                            value={questionSet.successRate} 
                                            className={`w-16 h-2 ${
                                              questionSet.successRate < 50 
                                                ? "[&>div]:bg-red-500" 
                                                : questionSet.successRate < 70 
                                                ? "[&>div]:bg-yellow-500" 
                                                : "[&>div]:bg-green-500"
                                            }`}
                                          />
                                          <span className="font-medium min-w-[45px]">
                                            {questionSet.successRate.toFixed(1)}%
                                          </span>
                                          {questionSet.successRate < 50 && (
                                            <AlertCircle className="h-4 w-4 text-red-500" />
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </CardHeader>
                                  
                                  <Collapsible open={isQSExpanded}>
                                    <CollapsibleContent>
                                      <CardContent className="pt-4">
                                        {isLoadingQS || queryResult?.isLoading ? (
                                          <div className="space-y-2">
                                            {[1, 2, 3].map(i => (
                                              <Skeleton key={i} className="h-12 w-full" />
                                            ))}
                                          </div>
                                        ) : detailedStats ? (
                                          <div className="ml-4">
                                            <Table>
                                              <TableHeader>
                                                <TableRow>
                                                  <TableHead className="w-16">#</TableHead>
                                                  <TableHead className="w-[40%]">Question</TableHead>
                                                  <TableHead className="text-right">Attempts</TableHead>
                                                  <TableHead className="text-right">Correct</TableHead>
                                                  <TableHead className="text-right">Incorrect</TableHead>
                                                  <TableHead>Pass Rate</TableHead>
                                                  <TableHead className="text-right">Avg Time</TableHead>
                                                </TableRow>
                                              </TableHeader>
                                              <TableBody>
                                                {detailedStats.questions.map(question => {
                                                  const passRate = question.successRate;
                                                  const avgTimeFormatted = question.averageTimeSpent > 0 
                                                    ? `${Math.round(question.averageTimeSpent)}s` 
                                                    : '-';
                                                  
                                                  return (
                                                    <TableRow key={question.questionId}>
                                                      <TableCell className="font-medium">
                                                        {question.questionNumber}
                                                      </TableCell>
                                                      <TableCell className="text-sm">
                                                        <span className="line-clamp-2">
                                                          {question.questionText}
                                                        </span>
                                                      </TableCell>
                                                      <TableCell className="text-right">
                                                        {question.totalAttempts}
                                                      </TableCell>
                                                      <TableCell className="text-right">
                                                        <span className="text-green-600 font-medium">
                                                          {question.correctAttempts}
                                                        </span>
                                                      </TableCell>
                                                      <TableCell className="text-right">
                                                        <span className="text-red-600 font-medium">
                                                          {question.incorrectAttempts}
                                                        </span>
                                                      </TableCell>
                                                      <TableCell>
                                                        <div className="flex items-center gap-2">
                                                          <Progress 
                                                            value={passRate} 
                                                            className={`w-14 h-2 ${
                                                              passRate < 50 
                                                                ? "[&>div]:bg-red-500" 
                                                                : passRate < 70 
                                                                ? "[&>div]:bg-yellow-500" 
                                                                : "[&>div]:bg-green-500"
                                                            }`}
                                                          />
                                                          <span className="text-sm font-medium min-w-[40px]">
                                                            {passRate.toFixed(1)}%
                                                          </span>
                                                          {passRate < 30 && (
                                                            <TrendingDown className="h-3 w-3 text-red-500" />
                                                          )}
                                                          {passRate > 90 && (
                                                            <TrendingUp className="h-3 w-3 text-green-500" />
                                                          )}
                                                        </div>
                                                      </TableCell>
                                                      <TableCell className="text-right text-sm text-muted-foreground">
                                                        {avgTimeFormatted}
                                                      </TableCell>
                                                    </TableRow>
                                                  );
                                                })}
                                              </TableBody>
                                            </Table>
                                            
                                            {detailedStats.questions.length === 0 && (
                                              <div className="text-center py-8 text-muted-foreground">
                                                <HelpCircle className="h-8 w-8 mx-auto mb-2" />
                                                <p>No question statistics available yet</p>
                                              </div>
                                            )}
                                          </div>
                                        ) : (
                                          <div className="text-center py-4 text-muted-foreground">
                                            Failed to load question details
                                          </div>
                                        )}
                                      </CardContent>
                                    </CollapsibleContent>
                                  </Collapsible>
                                </Card>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-muted-foreground">
                            No question sets with activity found for this course
                          </div>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}