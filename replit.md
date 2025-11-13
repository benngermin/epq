# Insurance Exam Practice Application

## Overview
A comprehensive web application designed for insurance exam preparation. It features practice questions, immediate feedback with static explanations for incorrect answers, and AI-powered chat support for additional guidance. The project aims to provide an effective and interactive learning experience for users preparing for insurance certification exams, with ambitions to capture a significant market share in professional test preparation.

## User Preferences
I prefer iterative development with regular, small commits. I value clear, concise explanations and prefer to be asked before major architectural changes are made. Do not make changes to the folder `shared/`.

## Recent Changes (October 2025)
- Fixed question numbering display bug where all questions showed as "Question 1" in the practice UI  
- Resolved progress tracking issue that prevented updates when completing questions
- Centralized ordinal field assignment in backend (batchFetchQuestionsWithVersions) for consistent numbering
- Updated all frontend components to use backend-provided ordinal instead of local state indices
- Added optimized endpoints for demo (/api/demo/question-sets/:id/optimized) and mobile-view (/api/mobile-view/question-sets/:id/optimized) paths to ensure ordinal field consistency
- Unified frontend data fetching to use optimized endpoints across all authentication modes (authenticated, demo, mobile-view)
- **Fixed Bubble API 401 error in production**: Corrected BUBBLE_BASE_URL configuration to always use version-test endpoint (the Content Repository only has version-test, not live)
- Added comprehensive diagnostic endpoint `/api/admin/bubble/test-auth` to help debug environment-specific issues
- **Fixed mobile-view progress tracking**: Demo and mobile-view endpoints now persist user answers to the database using session-based identification. Progress is maintained across page reloads and sessions
- **Removed Final Refresh functionality**: Completely removed the one-time migration feature that disabled Bubble.io integration after completion. The regular "Refresh All" bulk refresh operation continues to work normally and is not restricted
- **Fixed mobile-view answer submission**: Resolved issue where duplicate route definitions prevented proper progress tracking in the sidebar. Removed conflicting endpoint that returned incorrect response format, ensuring the correct endpoint returns `isCorrect`, `chosenAnswer`, and `questionId` fields
- **Updated mobile-view API path**: Fixed submitAnswerMutation to use the correct `/api/mobile-view/` prefix when in mobile-view mode, ensuring answers are properly persisted and progress is tracked
- **Mobile-view drag-and-drop filtering**: Implemented automatic filtering of drag-and-drop questions when `/mobile-view` is in the URL path. The mobile-view endpoint filters out all drag-and-drop questions and recalculates ordinal numbers to maintain sequential numbering (1, 2, 3...) without gaps. This ensures a smoother experience for mobile/webview users who may have difficulty with drag-and-drop interactions
- **Fixed chatbot message ordering issue**: Resolved a critical bug in the SimpleStreamingChat component where AI responses were appearing out of chronological order. The issue affected both mobile and desktop views, causing follow-up AI responses to appear at the top of the chat instead of at the bottom. Fixed by:
  - Changing message insertion from prepend to append for proper chronological flow
  - Improving message ID tracking for follow-up responses to ensure correct message updates
  - Adding safeguards to prevent duplicate initial AI responses
  - Implementing proper cleanup and state management when switching between questions

## Recent Changes (November 2025)
- **Reverted AI-only course filtering** (November 13, 2025): Initially added filtering to show only AI courses, but reverted this change when it was discovered to be hiding valid courses. The real issue was that production and development databases are separate, so courses added to production don't automatically appear in development. Solution: Use the CSV upload feature in Admin Panel → Content Management → Static Explanations → Upload Courses to import production courses into development.
- **Improved mobile-view feedback submission**: Fixed critical keyboard overlap issues on mobile devices when submitting feedback. Implemented keyboard-aware positioning for the FeedbackModal and navigation controls specifically for the `/mobile-view` path. Changes include:
  - Created a Visual Viewport API-based keyboard detection hook that properly handles orientation changes and baseline viewport height tracking
  - Updated FeedbackModal to dynamically position above the keyboard on mobile-view paths with scrollable content areas
  - Fixed navigation buttons to avoid keyboard overlap by adjusting their position when keyboard is visible
  - Prevented unwanted keyboard activation by disabling autofocus on mobile-view paths
  - Enhanced overall mobile responsiveness for better user experience when providing feedback
- **Fixed chat interface keyboard overlap**: Updated SimpleStreamingChat component to be keyboard-aware on mobile-view paths. The chat input and buttons now properly position themselves above the keyboard when it appears, preventing the keyboard from covering the interface elements
- **Flutter WebView keyboard compatibility**: Implemented a dual-strategy keyboard detection system that automatically switches between Visual Viewport API (for browsers) and focus/blur event detection (for Flutter WebViews). The system now:
  - Detects when running in /mobile-view path or WebView environment
  - Falls back to window.innerHeight tracking with focus/blur events for Flutter compatibility
  - Provides a global function `window.__flutterKeyboardHeightUpdate` that Flutter apps can call to directly communicate keyboard height
  - Ensures keyboard-aware positioning works in both mobile browsers and Flutter app WebViews
- **Fixed mobile-view feedback submission error**: Resolved the "Failed to submit feedback" error by updating the mobile-view feedback endpoint to include all required context fields (courseId, questionSetId, loid, etc.) that were missing. Mobile feedback now includes proper course context and user attribution (using 'Mobile User' placeholder) ensuring successful submission and integration with Notion/Slack tracking systems
- **Fixed mobile-view and demo feedback database constraint error** (November 11, 2025): Resolved a critical issue where mobile-view and demo feedback submissions were failing with 500 errors due to foreign key constraint violations. The endpoints were attempting to use special user IDs (-1 for demo, -2 for mobile-view) that didn't exist in the users table. Fixed by using NULL for user_id instead, which respects the foreign key constraint while properly identifying unauthenticated feedback submissions

## System Architecture
The application follows a client-server architecture.
- **Frontend**: Built with React, TypeScript, Vite, Tailwind CSS, and shadcn/ui for a modern, responsive user interface. UI/UX emphasizes a clean, intuitive design suitable for both desktop and mobile views, including specific considerations for webview environments.
- **Backend**: Implemented using Node.js and Express in TypeScript, providing a robust API layer.
- **Data Layer**: Utilizes PostgreSQL as the primary database, managed with Drizzle ORM. The schema supports various question types, static explanations, user progress tracking, and course/question set organization.
- **Chat System**: Features real-time AI chat support implemented with Server-Sent Events (SSE) for efficient, low-latency communication.
- **Content Rendering**: Static explanations support markdown rendering, even when embedded within HTML, processed via a pipeline that includes detection, markdown-to-HTML conversion, and safe HTML rendering with Tailwind Typography for consistent styling.
- **Authentication**: Integrates Cognito SSO and local authentication for secure user access.
- **Key Features**: Includes practice exams, AI chat assistance, question set management, and user progress tracking.

## External Dependencies
- **Database**: PostgreSQL (Neon-backed)
- **Authentication**: AWS Cognito
- **AI/LLM**: OpenRouter (for AI chat functionality)
- **Frontend Frameworks**: React, Vite
- **Styling**: Tailwind CSS, shadcn/ui
- **ORM**: Drizzle
- **Markdown Processing**: unified/remark/rehype libraries