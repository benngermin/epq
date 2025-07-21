import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { GraduationCap } from "lucide-react";
import { useEffect } from "react";
import type { Course, QuestionSet } from "@shared/schema";

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  // Version indicator to verify new dashboard loads
  console.log("Dashboard Version: 3.0 - Direct-to-Assessment");
  console.log("Features: URL parameter based course resolution");

  const { data: courses = [], isLoading } = useQuery<(Course & { questionSets: QuestionSet[] })[]>({
    queryKey: ["/api/courses"],
  });

  useEffect(() => {
    // Only process once we have courses data
    if (!isLoading && courses && courses.length > 0 && user) {
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
      
      let targetCourse: Course & { questionSets: QuestionSet[] };
      
      if (courseIdParam) {
        // Try to find matching course by external ID
        const foundCourse = courses.find(course => 
          course.externalId?.toLowerCase() === courseIdParam
        );
        
        if (foundCourse) {
          targetCourse = foundCourse;
          console.log(`Found course by external ID: ${foundCourse.title}`);
        } else {
          // If not found, log warning and use first course
          console.warn(`Course with id '${courseIdParam}' not found. Using first course.`);
          targetCourse = courses[0];
        }
      } else {
        // No course_id parameter, use first course
        targetCourse = courses[0];
        console.log('No course_id parameter, using first course');
      }
      
      // Set current course globally for other components
      (window as any).currentCourse = targetCourse;
      
      // Find first question set
      if (targetCourse.questionSets && targetCourse.questionSets.length > 0) {
        const firstQuestionSet = targetCourse.questionSets
          .sort((a, b) => {
            const aNum = parseInt(a.title.match(/\d+/)?.[0] || '0');
            const bNum = parseInt(b.title.match(/\d+/)?.[0] || '0');
            return aNum - bNum;
          })[0];
        
        console.log(`Navigating to question set: ${firstQuestionSet.title}`);
        
        // Navigate to the question set practice page
        setLocation(`/question-set/${firstQuestionSet.id}`);
      } else {
        console.error('No question sets available for the selected course');
        // Could show an error state here
      }
    }
  }, [isLoading, courses, user, setLocation]);

  // Show loading state while processing
  if (isLoading || !user) {
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
