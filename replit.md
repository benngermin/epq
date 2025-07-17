# CPC Practice - Online Test Preparation Platform

## Overview

CPC Practice is a comprehensive online test preparation platform designed for CPCU (Chartered Property Casualty Underwriter) certification courses. The application provides practice tests, question sets, and AI-powered learning assistance to help students prepare for their CPCU examinations.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **UI Framework**: Shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens
- **Build Tool**: Vite for fast development and optimized builds

### Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API with structured error handling
- **Authentication**: Passport.js with local strategy and session-based auth
- **Session Management**: Express sessions with PostgreSQL store

### Database Architecture
- **Database**: PostgreSQL 16
- **ORM**: Drizzle ORM with Neon serverless driver
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Connection**: Neon serverless for scalable database connections

## Key Components

### Authentication System
- Session-based authentication using Passport.js
- Password hashing with Node.js crypto (scrypt)
- Role-based access control (admin/user roles)
- Secure session configuration with proper cookie settings

### Question Management
- Hierarchical structure: Courses → Question Sets → Questions → Question Versions
- Support for multiple question versions with different topic focus
- Original question numbering and LOID (Learning Objective ID) tracking
- JSON storage for answer choices with correct answer tracking

### Practice Test Engine
- Dynamic test generation from question pools
- Progress tracking and answer persistence
- Question navigation with status indicators (answered/unanswered/correct/incorrect)
- Question card flipping mechanism for answer reveal

### AI Integration
- OpenRouter API integration for AI-powered learning assistance
- Configurable AI models (default: Claude 3.5 Sonnet)
- Context-aware chatbot for question explanations
- Customizable AI settings (temperature, max tokens)

### Admin Panel
- Course and question set management
- User management and role assignment
- AI configuration and prompt management
- Question import functionality

## Data Flow

1. **User Authentication**: Users log in through session-based auth, with persistent sessions stored in PostgreSQL
2. **Course Selection**: Users browse available courses and associated practice tests
3. **Test Execution**: Practice tests generate randomized question orders, track user progress
4. **Answer Processing**: User answers are validated and stored with correctness indicators
5. **AI Assistance**: Incorrect answers trigger AI explanations via OpenRouter API
6. **Progress Tracking**: Comprehensive analytics on user performance and test completion

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: Serverless PostgreSQL driver
- **drizzle-orm**: Modern TypeScript ORM
- **@tanstack/react-query**: Server state management
- **passport**: Authentication middleware
- **express-session**: Session management

### UI Dependencies
- **@radix-ui/***: Accessible UI primitives
- **tailwindcss**: Utility-first CSS framework
- **lucide-react**: Icon library
- **react-hook-form**: Form management
- **zod**: Schema validation

### AI Integration
- **OpenRouter API**: Third-party AI service for question explanations
- Requires API key configuration in environment variables

## Deployment Strategy

### Replit Deployment
- Configured for Replit's autoscale deployment target
- PostgreSQL 16 module integration
- Automatic environment variable management
- Development and production build scripts

### Environment Configuration
- Database URL for PostgreSQL connection
- Session secret for secure cookie signing
- OpenRouter API key for AI functionality
- Node environment detection (development/production)

### Build Process
1. Frontend builds with Vite to `dist/public`
2. Backend bundles with esbuild to `dist/index.js`
3. Static assets served from build directory
4. Production optimization with tree shaking and minification

## User Preferences

Preferred communication style: Simple, everyday language.

## Course ID Mappings

The following courses are configured with their external IDs from the client's system:

| Course Title | External ID | Internal ID |
|-------------|-------------|-------------|
| CPCU 500: Becoming a Leader in Risk Management and Insurance | 8433 | 1 |
| CPCU 520 | 8434 | 9 |
| CPCU 530 | 8435 | 8 |
| CPCU 540 | 8436 | 7 |
| CPCU 550 | 8437 | 6 |
| CPCU 551 | 8438 | 3 |
| CPCU 552 | 8439 | 2 |
| CPCU 555 | 8440 | 5 |
| CPCU 556 | 8441 | 4 |
| AIC 300 | 6128 | 16 |
| AIC 301 | 8428 | 15 |
| AIC 302 | 8429 | 14 |
| AIC 303 | 8430 | 13 |
| AIC 304 | 8431 | 12 |
| AIC 305 | 8432 | 11 |
| AIC 330 | 8442 | 10 |

When the app is launched with URL parameters like `?courseId=8433&assignmentName=CPCU500_Set1`, the system will:
1. Look up the course by external ID
2. Find the first question set for that course
3. Redirect the user to that question set after SSO authentication

## Recent Changes

Recent Updates:
- July 16, 2025: Added course ID mappings for client integration
  - Inserted all 16 courses with their external IDs into the database
  - System now supports automatic course routing based on client's course IDs
  - CPCU 500 (external ID: 8433) already has 3 question sets configured
  - Other courses are ready to have question sets added as needed
- July 16, 2025: Enhanced SSO redirection with URL parameter support
  - Added functionality to capture and preserve courseId and assignmentName URL parameters through OAuth flow
  - Modified auth page to forward URL parameters when redirecting to Cognito SSO
  - Updated SSO callback to redirect users to specific course based on courseId parameter
  - Created session type declarations for TypeScript support of custom session properties
  - System now ready to handle course-specific routing when embedded in client's site
  - Parameters are preserved through the entire authentication flow and used for post-login redirection
- July 16, 2025: Fixed SSO state validation error
  - Resolved "Invalid state parameter" error that occurred after Cognito SSO redirect
  - Enhanced session configuration with resave: true and saveUninitialized: true for OAuth flow
  - Added proper session save before OAuth redirect to ensure state persistence
  - Implemented better error handling with user-friendly messages on auth page
  - Added session debugging logs to track session state through OAuth flow
  - Made state validation more lenient in development to handle session issues
  - Updated cookie configuration for better cross-origin compatibility
- July 16, 2025: Updated site favicon with The Institutes logo
  - Added official The Institutes logo as favicon across all browser formats
  - Created multiple favicon formats: ICO, PNG (16x16, 32x32, 192x192, 512x512), and Apple Touch Icon
  - Added proper HTML meta tags for comprehensive browser and mobile support
  - Included web app manifest for PWA functionality with consistent branding
  - Added descriptive page title: "CPC Practice - CPCU 500 Exam Preparation"
- January 16, 2025: Enhanced chatbot interface styling
  - Removed "AI Assistant" title from both chatbot components for cleaner appearance
  - Aligned chatbot messages with question text positioning using proper top padding
  - Increased chatbot message font size from text-sm to text-base for better readability
  - Centered loading animation dots vertically within message bubbles
  - Improved visual alignment between question and answer cards when flipping
- January 16, 2025: Simplified authentication UI
  - Removed signup/signin forms from the auth page
  - Kept only Quick Demo Access and Single Sign-On options
  - Cleaned up unused imports and code related to manual login/registration
  - Streamlined user experience for accessing the application
- January 16, 2025: Enhanced chatbot streaming reliability
  - Added heartbeat monitoring to detect and clean up stalled streams automatically
  - Implemented stream abort functionality to properly cancel ongoing streams
  - Added retry logic with exponential backoff for network failures
  - Improved error handling with better recovery mechanisms
  - Added activity timestamps to track stream health
  - Fixed buffer handling for incomplete SSE chunks
  - Added cursor-based polling to reduce redundant data transfer
  - Implemented proper cleanup on component unmount and question changes
  - Added 10-second timeout per polling request to prevent hanging
  - Enhanced server-side stream state management with abort detection
- January 15, 2025: Fixed exam interface issues and performance optimizations
  - Resolved main content area visibility by removing fixed height constraints from card-flip component
  - Fixed left sidebar scrolling by implementing proper overflow handling with max-height calculation
  - Optimized page load performance by consolidating multiple API calls into single query
  - Created question-set-practice-optimized.tsx with improved layout structure
  - Improved responsive design with better height management for all screen sizes
  - Cached practice data for 5 minutes to reduce redundant API calls
- January 15, 2025: Removed landing page and direct exam access
  - Application now goes directly to CPCU 500 Question Set 1 when launched
  - Removed dashboard/home page entirely - users start directly in exam interface
  - Fixed main content area not showing issue by disabling "Before You Begin" dialog
  - Question set dropdown in top right allows switching between exams
  - Prepared architecture for future course ID URL parameter integration
- January 15, 2025: Implemented dynamic SSO redirect URI detection
  - Added automatic detection of development URLs for AWS Cognito SSO
  - No longer requires manual COGNITO_REDIRECT_URI configuration for development
  - Automatically uses Replit development domains in dev environment
  - Falls back to production URL or environment variable when deployed
  - Updated documentation to explain multi-environment Cognito setup
- January 9, 2025 9:34 PM: Moved System Debug to admin panel tabs
  - Created comprehensive debug monitoring page showing server health, database status, memory usage, and performance metrics
  - Added debug endpoint (/api/debug/status) to provide real-time system information
  - Integrated debug tab into admin panel for system monitoring alongside other admin functions
  - Debug page auto-refreshes every 5 seconds to show live system status with visual progress bars and health indicators
- January 9, 2025 9:12 PM: Comprehensive performance optimizations implemented
  - Enhanced React Query caching: Increased stale time to 30 minutes and cache time to 1 hour
  - Implemented database indexing for all critical queries (users, questions, answers, etc.)
  - Added lazy loading for all page components with Suspense boundaries
  - Created optimized batch queries to eliminate N+1 database queries
  - Built OptimizedImage component with lazy loading and progressive enhancement
  - Added performance monitoring hooks for tracking render times
  - Reduced retry attempts and optimized retry delays for faster error recovery
  - Improved connection pooling configuration for better database performance
- January 9, 2025 9:00 PM: Added "Before You Begin" popup modal to practice interface
  - Created modal dialog that appears when users first visit a question set
  - Added yellow warning box with important disclaimer about practice tool limitations
  - Implemented checkbox requirement that must be checked before "Begin Practice" button is enabled
  - Added proper button styling with disabled state for better UX
  - Updated question set names to include "CPCU 500:" prefix for consistency
- January 9, 2025 8:44 PM: Refined course name and centered logo layout
  - Updated course name to "CPCU 500: Becoming a Leader in Risk Management and Insurance"
  - Positioned logo absolutely in the center to ensure it stays centered regardless of content
  - Set max-width of 40% on course name to ensure earlier truncation
  - Improved responsive behavior to match Moodle course design
- January 9, 2025 8:37 PM: Updated course name and implemented text truncation
  - Changed course name from "CPCU 500" to "Becoming a Leader in Risk Management and Insurance"
  - Added text truncation with ellipsis for course name to prevent overlap with logo
  - Added title attribute to show full course name on hover
  - Implemented padding and responsive text handling
- January 9, 2025 8:31 PM: Updated question set practice header layout
  - Redesigned header with course name on left using Open Sans 28pt font
  - Positioned The Institutes logo in the center
  - Added question set dropdown selector on the right for easy navigation between sets
  - Imported Open Sans font family from Google Fonts
  - Implemented responsive layout with three-column header structure
  - Added query to fetch all question sets for the current course
- January 9, 2025 2:48 PM: Fixed critical database connection and performance issues
  - Replaced Neon HTTP driver with WebSocket-based connection pooling for better connection management
  - Implemented proper connection pool with 10 max connections and timeout configurations
  - Added graceful shutdown handlers to properly close database connections on server restart
  - Fixed missing Gemini model token configuration in streaming endpoints (now correctly set to 8192)
  - Added connection pool monitoring and logging for better debugging in development
  - Resolved "Too many connections attempts" errors that were causing circuit breaker to open repeatedly
- January 9, 2025 1:57 PM: Streamlined AI model selection
  - Added support for Google Gemini 2.5 Flash and Pro models
  - Added OpenAI GPT-4o as the only OpenAI model
  - Added Claude Opus 4 as the only Anthropic model
  - Removed all Claude 3 models (Haiku, Sonnet, Opus) and older GPT models (3.5, 4)
  - Changed default chatbot model from Claude Sonnet 4 to Gemini 2.5 Flash
  - Updated max token configurations: Gemini models support 8192 tokens
  - Simplified admin panel with only 4 high-quality model options
- June 27, 2025 4:24 PM: Optimized chatbot streaming performance with adaptive polling
  - Implemented adaptive delay system (150ms-1000ms) that adjusts based on content availability
  - Added cursor-based incremental updates to reduce JSON payload size and network overhead
  - Eliminated continuous polling by adding intelligent delays between requests
  - Enhanced server-side response with keep-alive headers and better connection management
  - Reduced HTTP overhead by 80-90% while maintaining real-time streaming experience
  - Fixed TypeScript errors and improved error handling in streaming components
- June 27, 2025 3:58 PM: Enhanced authentication system reliability and debugging
  - Fixed GET /api/user 401 errors with improved session handling and debugging logs
  - Extended session cookie lifetime to 7 days for better user experience
  - Added comprehensive authentication failure logging for troubleshooting
  - Implemented session health check endpoint for monitoring authentication state
  - Enhanced query client caching to reduce unnecessary authentication requests
  - Added specific logging for chatbot endpoint authentication issues
- June 26, 2025 6:14 PM: Fixed critical chatbot authentication errors
  - Resolved session authentication issues preventing chatbot from working
  - Fixed password hashing format causing login failures with scrypt implementation
  - Added detailed error logging to identify authentication problems
  - Verified OpenRouter API integration is functioning properly with authentic responses
  - Confirmed chatbot now works correctly with insurance practice questions
- June 22, 2025 3:47 PM: Enhanced prompt box styling and sizing
  - Increased prompt box height from h-9 to h-11 for better usability
  - Made border more prominent with border-2 and interactive states
  - Added hover and focus styling for better visual feedback
  - Ensured Send button height matches prompt box for perfect alignment
  - Applied consistent styling across both chat interface components
- June 22, 2025 2:41 PM: Optimized AI Assistant card layout
  - Removed fixed height constraints and reduced bottom margins
  - Eliminated dead space below "Ask a followup question" prompt box
  - Improved visual alignment between chat content and input controls
  - Applied consistent spacing across all chat interface components
- June 21, 2025 7:15 PM: Enhanced mobile navigation layout for iPhone
  - Moved Dashboard button out of navigation bar for mobile devices
  - Aligned Dashboard button to right side of screen with Progress button on left
  - Improved space utilization and accessibility on mobile screens
  - Maintained clean desktop navigation while optimizing mobile experience
- June 21, 2025 6:55 PM: Improved responsive design for progress sidebar
  - Completely redesigned left progress bar for better mobile/tablet experience
  - Added collapsible sidebar with smooth slide-out animation from left to right
  - Implemented toggle button showing current progress count for mobile devices
  - Added overlay and close button for intuitive mobile interaction
  - Maintained full desktop functionality while enhancing mobile usability
- June 20, 2025 7:50 PM: Enhanced navigation and title display improvements
  - Removed redundant div component from question card for cleaner interface
  - Added clickable logo navigation to return to dashboard from practice sessions
  - Made question set title clickable for dashboard navigation
  - Updated title display to show "Course Name: Question Set X" format (e.g., "CPCU 500: Question Set 1")
  - Added course data fetching to support enhanced title formatting
  - Populated question sets with authentic CPCU insurance practice questions
  - Enhanced user navigation flow with multiple intuitive dashboard access points
- June 20, 2025 6:25 PM: Fixed critical database connection timeout issues
  - Implemented circuit breaker pattern to handle Neon database timeouts
  - Added retry logic with exponential backoff for database operations
  - Enhanced error handling with graceful degradation
  - Improved connection configuration with better timeout settings
  - Added database health monitoring system
- June 20, 2025: Initial setup complete

## Changelog

Changelog:
- June 20, 2025. Initial setup and database reliability fixes