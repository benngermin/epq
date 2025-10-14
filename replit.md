# Insurance Exam Practice Application

## Overview
A comprehensive web application for insurance exam preparation with AI-powered chat support and practice questions. The application provides practice exams with static explanations and AI chat assistance for incorrect answers.

## Recent Changes

### October 14, 2024 - Mobile Modal Responsiveness
- **Issue**: "Before You Start" modal was touching the screen edges on mobile devices and was too tall
- **Solution**: Added responsive Tailwind classes for better mobile display:
  1. Width: `max-w-[calc(100%-2rem)]` on mobile, `sm:max-w-2xl` on desktop to ensure spacing from edges
  2. Height: Added `max-h-[85vh]` with `overflow-y-auto` to constrain height and enable scrolling
  3. Text sizing: Implemented responsive text sizes (`text-sm sm:text-base`) for better mobile readability
  4. Spacing: Reduced padding and spacing on mobile (`p-3 sm:p-4`, `space-y-4 sm:space-y-6`)
- **Components Updated**: 
  - `client/src/components/before-you-start-modal.tsx` - Complete responsive design overhaul
- **Result**: Modal now displays properly on mobile devices with appropriate spacing and sizing

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