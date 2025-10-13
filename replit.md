# Insurance Exam Practice Application

## Overview
A comprehensive web application for insurance exam preparation with AI-powered chat support and practice questions. The application provides practice exams with static explanations and AI chat assistance for incorrect answers.

## Recent Changes

### October 13, 2024 - Deployment Provisioning Optimization
- **Removed Heavy Dependencies**:
  - Removed `canvas` package from dependencies (not used in runtime code)
  - Moved `playwright` from dependencies to devDependencies (only needed for testing)
  - Uninstalled 30 GTK/Xorg system packages (cairo, pango, gtk3, etc.) that were only needed for canvas
- **Results**: 
  - Removed 31 unnecessary packages from production dependencies
  - Dramatically reduced provisioning time by eliminating compilation of graphics libraries
  - Prevented ~1GB browser binary downloads from blocking deployment
  - Application now provisions quickly without hanging on VM setup

### October 13, 2024 - Critical Deployment Syntax Errors Fixed
- **Fixed Parse-Time Syntax Errors**:
  - Fixed variable reference before declaration: moved healthcheck route after `const app = express()`
  - Fixed malformed `server.listen()` call with invalid syntax mixing function arguments and object properties
  - Fixed undefined `IS_DEPLOYMENT` reference by using consistent `IS_DEPLOY` constant throughout
- **Result**: Application now starts successfully and passes Replit provision phase

### October 13, 2024 - Production Deployment Fixes
- **Fixed Production Build Issues**:
  - Added `pg` dependency required by `connect-pg-simple`
  - Updated build scripts to separate client and server builds
  - Changed server output to `.mjs` format for proper ESM support
- **Lazy Loading & Dynamic Imports**:
  - Updated `server/vite.ts` to use dynamic imports (dev-only)
  - Updated `vite.config.ts` to conditionally load dev plugins
  - Prevents dev dependencies from loading in production
- **Database Initialization**:
  - Implemented lazy DB initialization in `server/db.ts`
  - Updated all database consumers to get DB at runtime
  - Fixed module-time throws that could crash production
- **Environment & Deployment**:
  - Updated `server/index.ts` with proper dev/prod split
  - Added IS_DEPLOYMENT check for Replit deployments
  - Proper static file serving in production mode
- **Session Store**:
  - Session store already properly guarded with DATABASE_URL check

### October 13, 2024 - Bug Fixes Implementation
- **Fixed TypeScript Errors**: 
  - Added missing `and` import from drizzle-orm
  - Fixed type casting for error handling 
  - Replaced undefined `QuestionVersion` type with proper type inference
  - Corrected property name from `questionSetNumber` to `questionSetTitle`
- **Fixed Empty Catch Block**:
  - Added proper error logging in development environment for course info fetching during bulk refresh
- **Fixed Console Logging Security**:
  - Wrapped sensitive conversation history logging in development environment checks
- **SessionStorage Access**:
  - Verified existing checks for sessionStorage availability are properly in place
- **Cognito Auth Error Handling**:
  - Confirmed proper error page redirects are already implemented

### October 13, 2024 - HTML-Wrapped Markdown Fix
- **Issue**: Bold markdown syntax (e.g., `**Correct Answer:**`) was displaying literally instead of rendering as bold
- **Root Cause**: Static explanations from the server come wrapped in HTML tags (e.g., `<p>**Correct Answer:**...</p>`). The client's `isHtmlContent()` function detected the HTML wrapper first and skipped markdown processing entirely
- **Solution**: Added hybrid content detection:
  1. Check if content has both HTML tags AND markdown syntax
  2. If both present, extract text content from HTML (stripping tags)
  3. Process the extracted text as markdown
  4. Enhanced markdown pattern detection for better accuracy
- **Components Updated**:
  - `client/src/lib/markdown-processor.tsx` - Enhanced `isMarkdownContent()` detection patterns
  - `client/src/components/static-explanation.tsx` - Added HTML-wrapped markdown extraction logic
- **Result**: Static explanations now correctly render markdown even when wrapped in HTML tags

### October 12, 2024 - Markdown Rendering Styles
- **Issue**: Static explanations were displaying raw markdown syntax (e.g., `**text**`) instead of rendering formatted text
- **Root Cause**: The Tailwind Typography plugin's `prose` class wasn't properly styling `<strong>` and `<em>` tags
- **Solution**: Added explicit CSS rules in `client/src/index.css` for proper markdown rendering
- **Components Updated**:
  - `client/src/index.css` - Added prose styling for markdown elements
  - `server/utils/batch-queries.ts` - Fixed camelCase conversion for static fields
- **Result**: Markdown syntax like `**Correct Answer:**` now renders as bold text properly

## Key Features
- Practice exam questions with immediate feedback
- Static explanations for incorrect answers
- AI chat support for additional help
- Question set management
- Progress tracking
- Admin panel for content management

## Technology Stack
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL (Neon-backed)
- **ORM**: Drizzle
- **Authentication**: Cognito SSO and local authentication

## Project Architecture
```
├── client/               # Frontend React application
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── pages/       # Page components
│   │   ├── hooks/       # Custom React hooks
│   │   └── lib/         # Utility functions and helpers
├── server/              # Backend Express server
│   ├── routes.ts        # API routes
│   ├── storage.ts       # Storage interface
│   └── utils/           # Server utilities
└── shared/              # Shared types and schemas
    └── schema.ts        # Drizzle database schema
```

## Markdown Processing Pipeline
1. **Detection**: `isMarkdownContent()` checks for markdown patterns
2. **Processing**: `processMarkdown()` converts markdown to HTML using unified/remark/rehype
3. **Rendering**: `HtmlLinkRenderer` safely renders the HTML with proper styling
4. **Styling**: Prose class applies typography styles for bold, italic, lists, etc.

## Database Schema
- Questions and question versions with support for multiple question types
- Static explanations with markdown support
- User progress tracking
- Course and question set organization

## Development Notes
- Always use `npm run db:push` for database migrations
- Frontend runs on port 5000 (integrated with backend)
- Markdown explanations require at least 10 characters of content
- Static explanations fall back to AI chat if validation fails