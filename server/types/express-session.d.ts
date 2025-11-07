import 'express-session';

declare module 'express-session' {
  interface SessionData {
    state?: string;
    courseId?: string;
    courseNumber?: string;
    assignmentName?: string;
  }
}