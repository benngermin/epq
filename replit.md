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

## Recent Changes

Recent Updates:
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