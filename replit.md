# Insurance Exam Practice Application

## Overview
A comprehensive web application for insurance exam preparation with AI-powered chat support and practice questions. The application provides practice exams with static explanations and AI chat assistance for incorrect answers.

## Recent Changes (October 12, 2024)

### Markdown Rendering Fix
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