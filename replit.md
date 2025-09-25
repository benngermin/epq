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

## Recent Changes (September 2025)
- **Refactored Static Explanations Upload**: Implemented three-field matching algorithm using Course Number + Question Set Title + Question Number for reliable question identification
- **CSV Format Update**: Upload CSV now requires Course, Question Set, Question Number, and Final Static Explanation fields (LOID and Question Text are now optional)
- **Improved Matching Logic**: Normalized course numbers, case-insensitive question set matching, and proper handling of ambiguous matches
- **Frontend Updates**: Admin upload page now displays three matching fields clearly and removes dependency on text matching
- **Fixed Static Explanation Preservation During Refresh**: Updated `updateQuestionsForRefresh` method to preserve static explanations when creating new question versions during refresh operations. Previously, static explanations were being lost when new versions were created.

## External Dependencies
- **Database**: PostgreSQL (Neon serverless)
- **Authentication**: AWS Cognito (for SSO)
- **AI Integration**: OpenRouter API
- **Content Import**: Bubble.io (for content import)