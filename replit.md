# CPC Practice Platform

## Overview

The CPC Practice Platform is a comprehensive web application designed for insurance professionals studying for CPCU (Chartered Property Casualty Underwriter) certifications. The platform provides practice tests, question banks, and AI-powered assistance to help users prepare for their exams.

## System Architecture

### Frontend Architecture
- **Framework**: React 18+ with TypeScript for type safety
- **Styling**: Tailwind CSS with shadcn/ui component library
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query for server state management
- **Form Handling**: React Hook Form with Zod validation
- **UI Components**: Comprehensive component library based on Radix UI primitives

### Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Authentication**: Passport.js with local strategy and session-based auth
- **Session Storage**: PostgreSQL-backed session store using connect-pg-simple
- **API Integration**: OpenRouter API for AI chatbot functionality

### Development Environment
- **Build Tool**: Vite for fast development and optimized production builds
- **Deployment**: Replit-optimized with autoscale deployment target
- **Database Migrations**: Drizzle Kit for schema management
- **TypeScript**: Full-stack type safety with shared schema types

## Key Components

### Authentication System
- User registration and login with encrypted password storage using Node.js crypto
- Session-based authentication with secure cookie configuration
- Role-based access control (admin/user permissions)
- Demo login functionality for quick access

### Question Management
- Hierarchical structure: Courses → Question Sets → Questions → Question Versions
- Support for multiple question versions with different topic focuses
- Original question numbering and LOID (Learning Objective ID) tracking
- JSON-based answer choices storage with correct answer validation

### Practice Test Engine
- Randomized question selection from question sets
- Progress tracking with answered/unanswered question status
- Question navigation with visual indicators (correct/incorrect/unanswered)
- Session persistence across browser refreshes

### AI Assistant Integration
- OpenRouter API integration for conversational AI support
- Context-aware responses based on question content and user answers
- Configurable AI model settings (temperature, max tokens, model selection)
- Prompt versioning system for consistent AI behavior

### Admin Panel
- Course and question set management
- User management and analytics
- AI settings configuration
- Question import functionality from JSON files

## Data Flow

### Question Practice Flow
1. User selects a course and practice test
2. System generates randomized question order
3. Questions are served one at a time with answer choices
4. User selections are tracked and validated
5. AI assistant provides contextual help when requested
6. Progress is saved and can be resumed

### AI Assistant Flow
1. User requests help on a specific question
2. System constructs context with question text and user's answer
3. Request sent to OpenRouter API with configured parameters
4. AI response processed and displayed to user
5. Conversation history maintained during session

### Admin Management Flow
1. Admin creates courses and question sets
2. Questions imported from structured JSON files
3. Question versions created with topic focus and answer choices
4. Practice tests configured with question count and selection criteria
5. AI settings managed through configuration interface

## External Dependencies

### Core Dependencies
- **Database**: PostgreSQL for primary data storage
- **AI Service**: OpenRouter API for chatbot functionality
- **UI Framework**: React with TypeScript
- **ORM**: Drizzle ORM for database operations
- **Authentication**: Passport.js for user authentication
- **Session Store**: connect-pg-simple for PostgreSQL session storage

### Development Dependencies
- **Vite**: Build tool and development server
- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: Component library built on Radix UI
- **TanStack Query**: Data fetching and caching
- **Zod**: Schema validation
- **React Hook Form**: Form management

### API Integrations
- **OpenRouter**: Third-party AI API for conversational assistance
- **Replit**: Platform-specific optimizations and deployment

## Deployment Strategy

### Environment Configuration
- Environment variables for database connection, API keys, and secrets
- Development/production environment detection
- Replit-specific domain handling for API requests

### Build Process
- Vite builds frontend assets to `dist/public`
- esbuild bundles backend code to `dist/index.js`
- Shared schema types ensure consistency between frontend and backend

### Database Strategy
- Drizzle migrations for schema versioning
- PostgreSQL as primary database with connection pooling
- Session storage integrated with main database

### Security Considerations
- Password hashing using Node.js scrypt with salt
- Secure session configuration with httpOnly cookies
- CSRF protection through session validation
- Environment-based secret management

## Changelog

```
Changelog:
- June 20, 2025. Initial setup
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```