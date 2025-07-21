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
      console.log('Dashboard: Processing course selection', {
        coursesCount: courses.length,
        firstCourse: courses[0],
        hasQuestionSets: courses[0]?.questionSets !== undefined,
        questionSetsCount: courses[0]?.questionSets?.length
      });
      
      // Parse URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      const courseIdParam = urlParams.get('course_id')?.toLowerCase();
      const assignmentName = urlParams.get('assignment_name')?.toLowerCase();
      
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
        // Try to find matching course by external ID
        const foundCourse = courses.find(course => 
          course.externalId?.toLowerCase() === courseIdParam
        );
        
        if (foundCourse) {
          targetCourse = foundCourse;
          console.log(`Found course by external ID: ${foundCourse.title}`);
        } else {
          // If not found, log warning and find first course with question sets
          console.warn(`Course with id '${courseIdParam}' not found. Finding first course with question sets.`);
          targetCourse = courses.find(course => 
            course.questionSets && course.questionSets.length > 0
          ) || courses[0];
        }
      } else {
        // No course_id parameter, find first course with question sets
        const courseWithQuestionSets = courses.find(course => 
          course.questionSets && course.questionSets.length > 0
        );
        
        if (courseWithQuestionSets) {
          targetCourse = courseWithQuestionSets;
          console.log(`No course_id parameter, using first course with question sets: ${courseWithQuestionSets.title}`);
        } else {
          // Fallback to first course if none have question sets
          targetCourse = courses[0];
          console.log('No courses have question sets, using first course');
        }
      }
      
      // Set current course globally for other components
      (window as any).currentCourse = targetCourse;
      
      // Log all courses and their question sets for debugging
      console.log('All courses with question sets:', courses.map(c => ({
        id: c.id,
        title: c.title,
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
          courseId: targetCourse.id,
          courseTitle: targetCourse.title,
          hasQuestionSets: !!targetCourse.questionSets,
          questionSetsArray: targetCourse.questionSets,
          allCoursesWithQuestionSets: courses.filter(c => c.questionSets && c.questionSets.length > 0).map(c => c.title)
        });
        
        // Check if any course has question sets
        const anyCoursesWithQuestionSets = courses.some(c => c.questionSets && c.questionSets.length > 0);
        
        if (!anyCoursesWithQuestionSets) {
          alert('No courses have question sets configured yet. Please contact your administrator to set up practice content.');
        } else {
          alert(`The course "${targetCourse.title}" doesn't have any question sets. Please contact your administrator or select a different course.`);
        }
      }
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
