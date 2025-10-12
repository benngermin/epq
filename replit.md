# Exam Practice Questions

## Overview
This project is an advanced AI-powered platform designed for insurance professional certification exam preparation. It offers intelligent, adaptive learning experiences tailored to individual student needs, supporting multiple certification paths such as CPCU and AIC programs. The platform aims to provide a comprehensive and effective tool for certification exam success.

## User Preferences
### Communication Style
- Technical documentation should be comprehensive
- Code should follow TypeScript best practices
- Use clear, descriptive variable names
- Implement proper error handling throughout

### Development Practices
- Always use the storage interface for database operations
- Validate all input data with Zod schemas
- Use React Query for all data fetching
- Implement loading states for async operations
- Handle errors gracefully with user-friendly messages

### Testing & Quality
- Test with both SSO and local authentication
- Verify course loading with URL parameters
- Check question navigation and answer submission
- Validate AI chatbot responses
- Monitor database connection stability

### Global Preferences
- **Change Control**: Never modify any prompts, LLMs, model settings, or edit/delete/write data without explicit user approval.
- **Communication**: Briefly state plan, why, and potential impacts; outline numbered steps for non-trivial work and await go-ahead. Clarify anything unclear immediately. Summarize actions and suggest next steps upon completion.
- **Coding Standards**: Write readable, modular code with descriptive names, minimal comments, and consistent formatting (4-space indent, lines ~≤80 chars). Implement robust error handling.
- **Data Handling & Safety**: Use anonymized/mock data for sensitive scenarios. Back up affected code/data before risky changes and explain rollback procedures.
- **Testing & Version Control**: Add unit tests for new features, targeting ≥80% coverage on critical paths. Run tests and report failures before finalizing.
- **Dependencies, Research & Response Style**: Use latest stable libraries. Cite external research. Keep responses focused and concise, using code examples when helpful.

## System Architecture
The platform is built with a React.js frontend (TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, Wouter) and an Express.js backend (TypeScript). It uses PostgreSQL (Neon serverless) with Drizzle ORM for data persistence. Authentication is managed via Passport.js with AWS Cognito SSO and local authentication, with session management using express-session. Vite is used for building, and deployment is on Replit.

**Core Features:**
- **Multi-Modal Authentication**: AWS Cognito SSO for enterprise, local authentication for admins, with 7-day session persistence.
- **Course Management System**: Supports CPCU and AIC, dynamic loading, external ID mapping, and Bubble.io integration for content import.
- **Question Set System**: Includes question versioning, progress tracking, analytics, and randomized ordering.
- **AI-Powered Tutoring**: Context-aware chatbot using OpenRouter API, configurable AI models, prompt versioning, response logging, user feedback, and static explanations for specific questions bypassing AI.
- **Admin Dashboard**: User, course, and question set management, AI settings, analytics, bulk import/export, and activity logs.
- **Performance Optimizations**: Database connection pooling with circuit breaker, retry mechanisms, lazy loading, database indexes, and health monitoring.
- **UI/UX Decisions**: Widened and centered assistant message cards for mobile readability, fixed accessibility for submit buttons, proper safe area insets for iOS, and improved sticky footer behavior.
- **Static Answer Support**: Questions can be marked with `isStaticAnswer` and `staticExplanation` to provide pre-written explanations instead of AI responses. The upload system uses three-field matching (Course + Question Set Title + Question Number) for reliable question identification.
- **Three-Field Matching System**: Static explanations upload now uses deterministic matching based on course number, question set title (case-insensitive), and question number position. This replaces the previous unreliable text-based matching that could lose questions.
- **Prompting Strategy**: AI maintains full conversation context through multi-turn message history, removing the need for additional prompt injection for follow-up messages.

## Recent Changes (October 12, 2025)
- **Implemented Mobile SSO Authentication Endpoint**:
  - Added `/auth/mobile-sso` endpoint for direct JWT authentication from mobile app
  - Validates AWS Cognito ID tokens against JWKS endpoint using RS256 algorithm
  - Implements critical audience (aud) claim validation to prevent cross-application token usage
  - Validates courseId as 4-digit integer (1000-9999 range)
  - Creates/updates users based on Cognito sub and email
  - Maps courses using external IDs (e.g., CPCU 500 = 8433)
  - Includes rate limiting and comprehensive error handling
  - All errors redirect to `/auth/cognito` for fallback authentication
  - Success redirects to `/course/{courseId}` with authenticated session

## Recent Changes (October 10, 2025 - Update 3)
- **Fixed All Critical Question Editor Bugs**:
  - **Multiple Choice Answer Editing**: Fixed focus loss by changing Save button from conditional rendering to always rendered with visibility toggle - users can now edit answer text freely
  - **Select From List Correct Answer**: Added support for simple select_from_list questions to properly handle correct answer dropdown selection
  - **Answer Option Management**: Removed "Add Choice" button for multiple_choice, select_from_list, and multiple_response (enforces exactly 4 options)
  - **Acceptable Answers**: Verified "Add Acceptable Answer" button works correctly for numerical_entry and short_answer types
  - **Static Explanation Generation**: Removed ALL hardcoded/fallback prompts - now uses EXACTLY what admin saves in prompt textbox
    - Added support for all 6 template variables: {{QUESTION_TEXT}}, {{ANSWER_CHOICES}}, {{CORRECT_ANSWER}}, {{SELECTED_ANSWER}}, {{LEARNING_CONTENT}}, {{COURSE_MATERIAL}}
    - Returns proper error (400) if no prompt configured instead of using fallbacks
  - **Question Versioning**: Verified working correctly with ONE TRUE VALUE per question - not causing editing bugs

## Recent Changes (October 10, 2025)
- **Added Delete Confirmation Modals for Answer Management**:
  - Implemented AlertDialog confirmation modals when deleting answer choices and acceptable answers
  - Added special validation to prevent deleting the correct answer without first selecting a new correct answer
  - For correct answer deletion: Users must select a new correct answer before confirming deletion
  - For regular answer choices and acceptable answers: Simple confirmation modal to prevent accidental deletions
  - Modals are integrated for question types: `multiple_choice`, `short_answer`, and `numerical_entry`
  - Clear user-friendly messages in modals explain the action and its consequences

- **Fixed Answer Choices and Acceptable Answers Management**:
  - Fixed issue where adding answer choices/acceptable answers didn't show new input fields immediately
  - Modified save logic to preserve empty strings in arrays during editing (allows working with empty fields)
  - Added validation to prevent saving completely empty answer choices or acceptable answers
  - Shows descriptive toast messages when validation fails: "You need to enter text into all answer choices/acceptable answers"
  - Delete functionality now properly removes items and persists changes after saving
  - Changes ensure smooth editing workflow: add empty fields → fill them in → save when complete

## Previous Changes (October 10, 2025)
- **Fixed Question Editor Save Functionality**:
  - Fixed critical bug where answer choices, drop zones, and other question-specific elements weren't being saved
  - Updated API validation schemas to include missing fields: `dropZones`, `correctOrder`, `matchingPairs`, `allowMultiple`
  - Changed `answerChoices` validation from strict string array to flexible type to support various question formats
  - Applied fixes to both update (`PUT /api/admin/question-versions/:id`) and create (`POST /api/admin/questions/create-with-version`) endpoints
  - Changes now persist correctly when editing questions in the admin panel

- **Fixed Critical Question Ordering and Archiving Inconsistency**:
  - Resolved issue where admin panel changes (reordering, archiving, editing) weren't reflecting on the front-end
  - Updated `batchFetchQuestionsWithVersions` to sort by `displayOrder` instead of `originalQuestionNumber`
  - Added `includeArchived` parameter to properly filter archived questions for front-end while preserving admin functionality
  - Front-end now correctly excludes archived questions and displays them in the same order as the admin panel
  - Ensured single source of truth: admin panel question set configuration is what users see on the front-end

## Previous Changes (October 2025)
- **Fixed Question Set Title Display Issue**: 
  - Added missing API endpoint `/api/admin/question-set/:id` to fetch single question set details
  - Changed route from plural to singular to avoid conflict with `/api/admin/question-sets/:courseId`
  - Updated frontend to use new endpoint and force cache refresh
  - Question set titles now properly display as "Question Set 1", "Question Set 2", or "Question Set 3"
  
- **Admin Question Editor UI Improvements**: Enhanced visual indicators for correct answers
  - Updated header display to show actual course numbers (e.g., "AIC 300 - Question set 1") instead of database IDs
  - Added subtle green background shading to visually highlight correct answers without text labels
  - Correct answers now display with green-50 background, green border, and green text for the option letter
  - Improved readability for administrators managing question sets
  
- **Enhanced Drag-and-Drop Interface**: Implemented professional drag-and-drop reordering with visual feedback
  - Added blue animated drop zone indicators showing exactly where questions will land
  - Questions become semi-transparent when dragged with smooth transitions
  - Enhanced grip handles with hover effects for better visual affordance
  - Cards show shadow and border during drag operations
  - Fixed bug where archived questions lost their order when active questions were reordered
  - Question numbers now update dynamically to reflect new positions after reordering
  - Added tooltip showing original question number for reference
  - Created demo page at /dragdrop-demo showcasing all enhancements

## Previous Changes (October 2025)
- **Admin Interface Expansion**: Implemented comprehensive admin interface for direct question management, replacing external refresh pipeline
  - Added database fields: `is_archived`, `display_order`, `last_modified` for questions table
  - Created `openrouter_config` table for AI settings management
  - Implemented 11 new storage methods for question CRUD operations
  - Built full-featured admin UI with inline editing, drag-and-drop reordering, and archive/recover functionality
  - Integrated OpenRouter API for AI-powered static explanation generation with configurable models
  - Added explanation mode switching (AI vs Static) with confirmation modals
  - Implemented remix functionality for creating new question versions
  - OpenRouter configuration UI in admin panel for model selection and system message customization
  
## Previous Changes (September 2025)
- **Refactored Static Explanations Upload**: Implemented three-field matching algorithm using Course Number + Question Set Title + Question Number for reliable question identification
- **CSV Format Update**: Upload CSV now requires Course, Question Set, Question Number, and Final Static Explanation fields (LOID and Question Text are now optional)
- **Improved Matching Logic**: Normalized course numbers, case-insensitive question set matching, and proper handling of ambiguous matches
- **Frontend Updates**: Admin upload page now displays three matching fields clearly and removes dependency on text matching
- **Fixed Static Explanation Preservation During Refresh**: Updated `updateQuestionsForRefresh` method to preserve static explanations when creating new question versions during refresh operations. Previously, static explanations were being lost when new versions were created.
- **Content-Based Question Matching**: Completely rewrote the question refresh matching algorithm to use content similarity (Levenshtein distance) instead of position-based matching. This ensures static explanations are preserved even when questions are deleted from the source data and all subsequent questions shift positions. The new algorithm uses multi-factor scoring: content similarity (80 points) + LOID bonus (20 points) + position as tiebreaker.
- **Enhanced Database Schema for Matching**: Added tracking columns to questions table (`content_fingerprint`, `last_matched_at`, `match_confidence`) and created `question_match_history` table to log all matching decisions for debugging and analysis.
- **Comprehensive Logging**: Added extensive debug logging throughout the matching process to track each matching decision, confidence scores, and preservation of static explanations.

## External Dependencies
- **Database**: PostgreSQL (Neon serverless)
- **Authentication**: AWS Cognito (for SSO)
- **AI Integration**: OpenRouter API
- **Content Import**: Bubble.io (for content import)