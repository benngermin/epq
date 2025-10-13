# Exam Practice Questions

## Overview
This project is an AI-powered platform for insurance professional certification exam preparation. It provides adaptive learning experiences for certifications like CPCU and AIC, aiming to be a comprehensive and effective tool for exam success.

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
The platform features a React.js frontend (TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, Wouter) and an Express.js backend (TypeScript). Data persistence uses PostgreSQL (Neon serverless) with Drizzle ORM. Authentication is managed via Passport.js with AWS Cognito SSO and local authentication, using express-session for session management. Vite handles building, and deployment is on Replit.

**Core Features:**
- **Multi-Modal Authentication**: Supports AWS Cognito SSO for enterprises and local authentication for administrators, with 7-day session persistence.
- **Course Management System**: Handles CPCU and AIC programs, dynamic content loading, external ID mapping, and content import via Bubble.io.
- **Question Set System**: Manages question versioning, tracks progress, provides analytics, and supports randomized question ordering.
- **AI-Powered Tutoring**: Offers a context-aware chatbot using OpenRouter API with configurable AI models, prompt versioning, response logging, user feedback, and static explanations for specific questions.
- **Admin Dashboard**: Provides tools for user, course, and question set management, AI settings, analytics, bulk import/export, and activity logs.
- **Performance Optimizations**: Includes database connection pooling with circuit breaker, retry mechanisms, lazy loading, database indexing, and health monitoring.
- **UI/UX Decisions**: Optimized for mobile readability with widened message cards, fixed accessibility for submit buttons, proper safe area insets for iOS, and improved sticky footer behavior.
- **Static Answer Support**: Allows questions to provide pre-written explanations using `isStaticAnswer` and `staticExplanation`. The upload system uses a three-field matching (Course + Question Set Title + Question Number) for reliable question identification and preservation of static explanations during content refreshes.
- **Prompting Strategy**: AI maintains full conversation context through multi-turn message history, eliminating the need for additional prompt injection.

## External Dependencies
- **Database**: PostgreSQL (Neon serverless)
- **Authentication**: AWS Cognito (for SSO)
- **AI Integration**: OpenRouter API
- **Content Import**: Bubble.io

## Recent Changes (October 12, 2025)
- **Fixed Static Explanations Generation**:
  - Fixed JavaScript error in admin panel where `questionId` was not defined in mutation callback - now correctly uses `variables` parameter
  - Fixed issue where only the letter (e.g., "C") was sent to AI instead of complete answer
  - Now sends full correct answer with both letter and text (e.g., "C. Average value method")
  - Answer choices are now formatted with letters for better readability in prompts
  - Selected answer is also formatted with complete text for comparison context
  - Added comprehensive logging to verify all inputs sent to OpenRouter API
  - Automatically switches to static mode when generating explanation
  - This ensures AI models receive complete context for generating accurate explanations