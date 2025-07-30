import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { GraduationCap } from "lucide-react";
import { useEffect } from "react";
import type { Course, QuestionSet } from "@shared/schema";

export default function Dashboard() {
  const { user, isLoading: userLoading } = useAuth();
  const [, setLocation] = useLocation();
  
  // Version indicator to verify new dashboard loads
  console.log("Dashboard Version: 3.0 - Direct-to-Assessment");
  console.log("Features: URL parameter based course resolution");

  const { data: courses, isLoading: coursesLoading } = useQuery<any[]>({
    queryKey: ["/api/courses"],
    enabled: !!user, // Only fetch when user is authenticated
  });

  useEffect(() => {
    // Process once we have courses data
    if (!coursesLoading && !userLoading && courses && courses.length > 0) {
      const processCourseSelection = async () => {
        console.log('Dashboard: Processing course selection', {
          coursesCount: courses.length,
          firstCourse: courses[0],
          hasQuestionSets: courses[0]?.questionSets !== undefined,
          questionSetsCount: courses[0]?.questionSets?.length
        });
        
        // Parse URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        // Check for both course_id and courseId parameters (support both formats, case-insensitive)
        const courseIdParam = urlParams.get('course_id') || urlParams.get('courseId') || urlParams.get('course_ID');
        const assignmentName = urlParams.get('assignment_name') || urlParams.get('assignmentName');
        
        // Store assignment name for future use
        if (assignmentName) {
          (window as any).currentAssignmentName = assignmentName;
        }
        
        // Log parameter parsing
        console.log('URL Parameters:', {
          course_id: courseIdParam,
          assignment_name: assignmentName
        });
        
        let targetCourse: any;
        
        if (courseIdParam) {
          // Fetch course by external ID using the API endpoint
          try {
            const response = await fetch(`/api/courses/by-external-id/${courseIdParam}`, {
              headers: {
                'Content-Type': 'application/json',
              },
              credentials: 'include',
            });
            
            if (response.ok) {
              const courseData = await response.json();
              console.log(`API returned course:`, courseData);
              
              // Find the full course object with question sets from the courses array
              targetCourse = courses.find(c => c.id === courseData.id);
              
              if (!targetCourse) {
                console.log(`Course ${courseData.courseNumber} (ID: ${courseData.id}) not in courses array, fetching question sets...`);
                // Course exists but isn't in the courses array, fetch its question sets
                const qsResponse = await fetch(`/api/courses/${courseData.id}/question-sets`, {
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                });
                
                if (qsResponse.ok) {
                  const questionSets = await qsResponse.json();
                  targetCourse = {
                    ...courseData,
                    questionSets: questionSets
                  };
                  console.log(`Fetched ${questionSets.length} question sets for course ${courseData.courseNumber}`);
                } else {
                  console.error(`Failed to fetch question sets for course ${courseData.courseNumber}`);
                  targetCourse = courseData; // Use course data without question sets
                }
              } else {
                console.log(`Found course in array: ${targetCourse.courseNumber}`);
              }
            } else {
              // If not found, default to CPCU 500
              console.warn(`Course with id '${courseIdParam}' not found. Defaulting to CPCU 500.`);
              targetCourse = courses.find(course => course.courseNumber === 'CPCU 500') || courses[0];
            }
          } catch (error) {
            console.error('Error fetching course by external ID:', error);
            targetCourse = courses.find(course => course.courseNumber === 'CPCU 500') || courses[0];
          }
        } else {
          // No course_id parameter, default to CPCU 500
          const cpcu500 = courses.find(course => course.courseNumber === 'CPCU 500');
          
          if (cpcu500) {
            targetCourse = cpcu500;
            console.log('No course_id parameter, defaulting to CPCU 500');
          } else {
            // Fallback to first course if CPCU 500 not found
            targetCourse = courses[0];
            console.log('CPCU 500 not found, using first course');
          }
        }
      
      // Set current course globally for other components
      (window as any).currentCourse = targetCourse;
      
      // Log all courses and their question sets for debugging
      console.log('All courses with question sets:', courses.map(c => ({
        id: c.id,
        courseNumber: c.courseNumber,
        courseTitle: c.courseTitle,
        externalId: c.externalId,
        questionSetCount: c.questionSets?.length || 0
      })));
      
      // Find first question set
      if (targetCourse.questionSets && targetCourse.questionSets.length > 0) {
        // Sort question sets by their number
        const sortedQuestionSets = [...targetCourse.questionSets].sort((a, b) => {
          const aNum = parseInt(a.title.match(/\d+/)?.[0] || '0');
          const bNum = parseInt(b.title.match(/\d+/)?.[0] || '0');
          return aNum - bNum;
        });
        
        const firstQuestionSet = sortedQuestionSets[0];
        
        console.log(`Navigating to question set: ${firstQuestionSet.title} (ID: ${firstQuestionSet.id})`);
        
        // Navigate to the question set practice page
        setLocation(`/question-set/${firstQuestionSet.id}`);
      } else {
        console.error('No question sets available for the selected course', {
          courseId: targetCourse?.id,
          courseNumber: targetCourse?.courseNumber,
          courseTitle: targetCourse?.courseTitle,
          hasQuestionSets: !!targetCourse?.questionSets,
          questionSetsArray: targetCourse?.questionSets,
          allCoursesWithQuestionSets: courses.filter(c => c.questionSets && c.questionSets.length > 0).map(c => c.courseNumber)
        });
        
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
    };
    
    processCourseSelection();
    }
  }, [coursesLoading, userLoading, courses, setLocation]);

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
