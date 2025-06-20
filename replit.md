# CPC Practice Test Application

## Overview

This is a full-stack web application designed for insurance professionals preparing for CPCU (Chartered Property Casualty Underwriter) certification exams. The application provides interactive practice tests with AI-powered explanations and feedback to help users learn from their mistakes.

## System Architecture

The application follows a modern full-stack architecture with a clear separation between client and server:

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight router)
- **State Management**: TanStack Query (React Query) for server state
- **UI Framework**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens
- **Build Tool**: Vite with hot module replacement

### Backend
- **Runtime**: Node.js with Express.js
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Passport.js with local strategy and session management
- **Session Storage**: PostgreSQL-backed sessions via connect-pg-simple
- **AI Integration**: OpenRouter API for chatbot functionality

## Key Components

### Database Schema
The application uses a relational database structure with the following key entities:
- **Users**: Authentication and user management
- **Courses**: Different certification courses (CPCU 500, etc.)
- **Question Sets**: Collections of questions within courses
- **Questions**: Individual questions with metadata
- **Question Versions**: Multiple versions of questions with different topic focuses
- **Practice Tests**: Test configurations and runs
- **User Answers**: Answer tracking and performance analytics
- **AI Settings**: Configuration for AI chatbot behavior

### Authentication System
- Session-based authentication using express-session
- Password hashing with Node.js crypto (scrypt)
- Admin role support for content management
- Protected routes with automatic redirect to login

### Question Management
- Hierarchical structure: Courses → Question Sets → Questions → Question Versions
- Support for multiple question versions with different topic focuses
- Original question number tracking and LOID (Learning Objective ID) mapping
- JSON storage for answer choices and metadata

### AI Chatbot Integration
- OpenRouter API integration for AI-powered explanations
- Context-aware responses based on user's chosen vs. correct answers
- Configurable AI model settings (temperature, max tokens, model selection)
- Chat interface appears when users answer incorrectly

### Test Engine
- Randomized question order for each test run
- Progress tracking and answer persistence
- Question navigation with status indicators (answered/correct/incorrect)
- Resume capability for incomplete tests

## Data Flow

1. **User Authentication**: Users log in through Passport.js local strategy
2. **Course Selection**: Users browse available courses and question sets
3. **Test Initialization**: System creates test run with randomized question order
4. **Question Presentation**: Questions are served with answer choices
5. **Answer Submission**: Answers are validated and stored with correctness flag
6. **AI Feedback**: Incorrect answers trigger AI explanations via OpenRouter
7. **Progress Tracking**: System maintains test state and completion status

## External Dependencies

### Core Dependencies
- **Database**: PostgreSQL (configured via DATABASE_URL)
- **AI Service**: OpenRouter API (requires OPENROUTER_API_KEY)
- **Session Storage**: PostgreSQL-backed sessions

### Development Tools
- **TypeScript**: Type safety across frontend and backend
- **Drizzle Kit**: Database migrations and schema management
- **ESBuild**: Production bundling for server code
- **Tailwind CSS**: Utility-first styling

### UI Components
- **Radix UI**: Accessible primitive components
- **shadcn/ui**: Pre-built component library
- **Lucide React**: Icon library

## Deployment Strategy

The application is configured for Replit deployment with the following setup:

### Environment Requirements
- Node.js 20
- PostgreSQL 16
- Environment variables: DATABASE_URL, SESSION_SECRET, OPENROUTER_API_KEY

### Build Process
1. Frontend: Vite builds React application to `dist/public`
2. Backend: ESBuild bundles server code to `dist/index.js`
3. Assets: Static files served from build output

### Production Configuration
- Session security with secure cookies in production
- Database connection pooling via Neon serverless
- Error handling and logging
- CORS and security headers

## Changelog
- June 20, 2025. Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.