import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { GraduationCap } from "lucide-react";
import { useEffect } from "react";
import type { Course, QuestionSet } from "@shared/schema";

export default function Dashboard() {
  const { user, isLoading: userLoading } = useAuth();
  const [, setLocation] = useLocation();
  
  // Check if we're in demo mode
  const isDemo = window.location.pathname.startsWith('/demo');
  
  // Version indicator to verify new dashboard loads (only in development)
  if (import.meta.env.DEV) {
    console.log("Dashboard Version: 3.0 - Direct-to-Assessment");
    console.log("Features: URL parameter based course resolution");
    console.log("Demo mode:", isDemo);
  }

  const { data: courses, isLoading: coursesLoading } = useQuery<any[]>({
    queryKey: [isDemo ? "/api/demo/courses" : "/api/courses"],
    enabled: !!user, // Only fetch when user is authenticated
  });

  useEffect(() => {
    // Create an abort controller for cleanup
    const abortController = new AbortController();
    
    // Process once we have courses data and user is authenticated
    if (!coursesLoading && !userLoading && user && courses && courses.length > 0) {
      const processCourseSelection = async () => {
        try {
          if (import.meta.env.DEV) {
            console.log('Dashboard: Processing course selection', {
              coursesCount: courses.length,
              firstCourse: courses[0],
              hasQuestionSets: courses[0]?.questionSets !== undefined,
              questionSetsCount: courses[0]?.questionSets?.length
            });
          }
          
          // Parse URL parameters - normalize to handle case-insensitive matching
          const urlParams = new URLSearchParams(window.location.search);
          let courseIdParam: string | null = null;
          let assignmentName: string | null = null;
          
          // Check all parameter variations in a case-insensitive way
          urlParams.forEach((value, key) => {
            const lowerKey = key.toLowerCase();
            if ((lowerKey === 'course_id' || lowerKey === 'courseid') && !courseIdParam) {
              courseIdParam = value;
            } else if ((lowerKey === 'assignment_name' || lowerKey === 'assignmentname') && !assignmentName) {
              assignmentName = value;
            }
          });
          
          // Store assignment name for future use
          if (assignmentName) {
            (window as any).currentAssignmentName = assignmentName;
          }
        
        // Log parameter parsing (only in development)
        if (import.meta.env.DEV) {
          console.log('URL Parameters:', {
            course_id: courseIdParam,
            assignment_name: assignmentName
          });
        }
        
        let targetCourse: any;
        
        if (courseIdParam) {
          // Fetch course by external ID using the API endpoint
          try {
            // Check if operation was aborted
            if (abortController.signal.aborted) return;
            
            const response = await fetch(isDemo ? `/api/demo/courses/by-external-id/${courseIdParam}` : `/api/courses/by-external-id/${courseIdParam}`, {
              headers: {
                'Content-Type': 'application/json',
              },
              credentials: 'include',
              signal: abortController.signal,
            });
            
            if (response.ok) {
              const courseData = await response.json();
              if (import.meta.env.DEV) {
                console.log(`API returned course:`, courseData);
              }
              
              // Find the full course object with question sets from the courses array
              targetCourse = courses.find(c => c.id === courseData.id);
              
              if (!targetCourse) {
                if (import.meta.env.DEV) {
                  console.log(`Course ${courseData.courseNumber} (ID: ${courseData.id}) not in courses array, fetching question sets...`);
                }
                // Course exists but isn't in the courses array, fetch its question sets
                // Check if operation was aborted before second fetch
                if (abortController.signal.aborted) return;
                
                const qsResponse = await fetch(isDemo ? `/api/demo/courses/${courseData.id}/question-sets` : `/api/courses/${courseData.id}/question-sets`, {
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  signal: abortController.signal,
                });
                
                if (qsResponse.ok) {
                  const questionSets = await qsResponse.json();
                  targetCourse = {
                    ...courseData,
                    questionSets: questionSets
                  };
                  if (import.meta.env.DEV) {
                    console.log(`Fetched ${questionSets.length} question sets for course ${courseData.courseNumber}`);
                  }
                } else {
                  if (import.meta.env.DEV) {
                    console.error(`Failed to fetch question sets for course ${courseData.courseNumber}`);
                  }
                  targetCourse = courseData; // Use course data without question sets
                }
              } else {
                if (import.meta.env.DEV) {
                  console.log(`Found course in array: ${targetCourse.courseNumber}`);
                }
              }
            } else {
              // If not found, default to first available course
              if (import.meta.env.DEV) {
                console.warn(`Course with id '${courseIdParam}' not found. Using first available course.`);
              }
              targetCourse = courses.find(course => course.courseNumber === 'CPCU 500') || courses[0];
            }
          } catch (error) {
            if (import.meta.env.DEV) {
              console.error('Error fetching course by external ID:', error);
            }
            targetCourse = courses[0];
          }
        } else {
          // No course_id parameter, default to first available course with question sets
          const firstCourseWithQuestionSets = courses.find(course => 
            course.questionSets && course.questionSets.length > 0
          );
          
          if (firstCourseWithQuestionSets) {
            targetCourse = firstCourseWithQuestionSets;
            if (import.meta.env.DEV) {
              console.log(`No course_id parameter, using first available course: ${firstCourseWithQuestionSets.courseNumber}`);
            }
          } else {
            // No courses with question sets available
            targetCourse = courses[0];
            if (import.meta.env.DEV) {
              console.log('No courses have question sets, using first course');
            }
          }
        }
      
      // Set current course globally for other components
      (window as any).currentCourse = targetCourse;
      
      // Log all courses and their question sets for debugging (only in development)
      if (import.meta.env.DEV) {
        console.log('All courses with question sets:', courses.map(c => ({
          id: c.id,
          courseNumber: c.courseNumber,
          courseTitle: c.courseTitle,
          externalId: c.externalId,
          questionSetCount: c.questionSets?.length || 0
        })));
      }
      
      // Find first question set
      if (targetCourse.questionSets && targetCourse.questionSets.length > 0) {
        // Sort question sets by their number
        const sortedQuestionSets = [...targetCourse.questionSets].sort((a, b) => {
          const aNum = parseInt(a.title.match(/\d+/)?.[0] || '0');
          const bNum = parseInt(b.title.match(/\d+/)?.[0] || '0');
          return aNum - bNum;
        });
        
        const firstQuestionSet = sortedQuestionSets[0];
        
        if (import.meta.env.DEV) {
          console.log(`Navigating to question set: ${firstQuestionSet.title} (ID: ${firstQuestionSet.id})`);
        }
        
        // Navigate to the question set practice page
        setLocation(isDemo ? `/demo/question-set/${firstQuestionSet.id}` : `/question-set/${firstQuestionSet.id}`);
      } else {
        if (import.meta.env.DEV) {
          console.error('No question sets available for the selected course', {
          courseId: targetCourse?.id,
          courseNumber: targetCourse?.courseNumber,
          courseTitle: targetCourse?.courseTitle,
          hasQuestionSets: !!targetCourse?.questionSets,
          questionSetsArray: targetCourse?.questionSets,
          allCoursesWithQuestionSets: courses.filter(c => c.questionSets && c.questionSets.length > 0).map(c => c.courseNumber)
        });
        }
        
        // Check if any course has question sets
        const anyCoursesWithQuestionSets = courses.some(c => c.questionSets && c.questionSets.length > 0);
        
        if (!targetCourse) {
          alert('The selected course could not be found. Please contact your administrator.');
        } else if (!anyCoursesWithQuestionSets) {
          alert('No courses have question sets configured yet. Please contact your administrator to set up practice content.');
        } else {
          const courseName = targetCourse.courseNumber || 'Unknown Course';
          alert(`The course "${courseName}" doesn't have any question sets. Please contact your administrator or select a different course.`);
        }
      }
        } catch (error) {
          if (import.meta.env.DEV) {
            console.error('Error processing course selection:', error);
          }
          alert('An error occurred while loading your course. Please refresh the page and try again.');
        }
      };
      
      processCourseSelection().catch(error => {
        if (import.meta.env.DEV) {
          console.error('Failed to process course selection:', error);
        }
        // Don't show alert if user is not authenticated, as they'll be redirected
        if (user) {
          alert('An error occurred while loading your course. Please refresh the page and try again.');
        }
      });
    }
    
    // Cleanup function to abort pending operations
    return () => {
      abortController.abort();
    };
  }, [coursesLoading, userLoading, courses, setLocation, isDemo, user]);

  // Show loading state while processing
  if (coursesLoading || userLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <GraduationCap className="mx-auto h-12 w-12 text-primary animate-pulse mb-4" />
          <p className="text-muted-foreground">Loading your courses...</p>
        </div>
      </div>
    );
  }

  // Keep showing loading while redirect happens
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <GraduationCap className="mx-auto h-12 w-12 text-primary animate-pulse mb-4" />
        <p className="text-muted-foreground">Preparing your assessment...</p>
      </div>
    </div>
  );
}
