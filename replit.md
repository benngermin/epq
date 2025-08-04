# Exam Practice Questions (EPQ)

## Overview

EPQ is a comprehensive online test-preparation platform designed for The Institutes’ certification courses. The application delivers question sets, progress analytics, and AI-powered learning assistance to help students prepare for their examinations.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query (React Query) for server-state management
- **UI Framework**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens
- **Build Tool**: Vite for fast development and optimized builds

### Backend Architecture
- **Runtime**: Node.js (ES modules) with Express.js server
- **Language**: TypeScript
- **API Design**: RESTful API with structured error handling
- **Authentication**: Passport.js with AWS Cognito SSO + local strategy (admin-only)
- **Session Management**: express-session with PostgreSQL store (connect-pg-simple)

### Database Architecture
- **Database**: PostgreSQL 16
- **ORM**: Drizzle ORM with @neondatabase/serverless driver
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Connection**: Neon serverless for scalable database connections
- **Mapping Table**: `course_external_mappings` lets multiple external IDs (AI and non-AI Moodle variants) map to a single course

## Key Components

### Authentication System
- Dual authentication support: AWS Cognito SSO (primary) and local authentication (admin-only)
- Session-based authentication using Passport.js
- Password hashing with Node.js crypto (scrypt)
- Role-based access control (`is_admin` flag)
- Secure session configuration with PostgreSQL-backed session store
- **Important**: Non-SSO login is restricted to admin users only  
- Admin privileges are controlled by the `is_admin` flag in the **users** table (seeded admin: `benn@modia.ai`). Additional admins can be created via the Admin Panel or migrations.

### Question Management
- Hierarchical structure: Courses → Question Sets → Questions → Question Versions
- Support for multiple question versions with different topic focus
- Original question numbering and LOID (Learning Objective ID) tracking
- JSON storage for answer choices with correct-answer tracking
- Supported question types  
  - Multiple Choice  
  - Fill in the Blank (case-sensitive, with acceptable answers)  
  - True/False  
  - Pick from List (single & multi-select)  
  - Matching (drag-and-drop pairs)  
  - Ordering (drag-and-drop sequence)

### Question-Set Practice Engine
- Generates dynamic practice sessions directly from **question_set** pools (legacy `practice_tests` table has been removed)
- Progress tracking and answer persistence per session
- Question navigation with status indicators (answered / unanswered)
- Card-flip mechanism to reveal correct answers and AI feedback

### AI Integration
- **OpenRouter API** provides a single gateway to multiple LLM providers
- **Default model**: Google **Gemini 2.5 Flash** (8 K-token context, low-latency)
- Additional curated options: Google Gemini 2.5 Pro, OpenAI GPT-4o, Anthropic Claude Opus 4
- Context-aware chatbot delivers step-by-step explanations and links answers to course materials
- All AI parameters (model, temperature, max tokens) are adjustable in the Admin Panel

### Admin Panel
- Course and question-set management
- User management and role assignment
- AI configuration and prompt management
- Question-set import options  
  - JSON file import for individual sets  
  - **Bubble API Integration** for bulk import (with course filter, batch selection, automatic course creation)

## Data Flow

1. **User Authentication** → session persisted in PostgreSQL  
2. **Course Selection** → users browse or deep-link via `courseId` URL param  
3. **Practice Session** → question order randomized; progress stored  
4. **Answer Processing** → validation & correctness indicators saved  
5. **AI Assistance** → incorrect answers trigger OpenRouter explanation  
6. **Analytics** → per-user performance tracked and surfaced in UI

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: Serverless PostgreSQL driver
- **drizzle-orm**: Typed ORM
- **drizzle-zod**: Schema generation & validation
- **@tanstack/react-query**: Server-state management
- **passport**: Authentication middleware
- **express-session**: Session management
- **connect-pg-simple**: PostgreSQL-backed session store
- **class-variance-authority**: Variant-based styling helper
- **cmdk**: Command-palette UI toolkit

### UI Dependencies
- **@radix-ui/\***: Accessible UI primitives
- **tailwindcss**: Utility-first CSS framework
- **lucide-react**: Icon library
- **class-variance-authority**: Tailwind variant composition
- **cmdk**: Command menu component
- **react-hook-form**: Form management
- **zod**: Schema validation

### AI Integration
- **OpenRouter API** (requires `OPENROUTER_API_KEY` in environment)

## Deployment Strategy

### Replit Deployment
- Configured for Replit Autoscale
- PostgreSQL 16 module integration
- Automatic environment variable management
- Development & production build scripts

### Environment Configuration
- `DATABASE_URL` – PostgreSQL connection string  
- `SESSION_SECRET` – cookie-signing secret  
- `OPENROUTER_API_KEY` – AI functionality  
- `REPLIT_DOMAINS` (auto-set) – sent as `HTTP-Referer` to OpenRouter  
- `NODE_ENV` – environment flag

### Build Process
1. Frontend bundles with Vite → `dist/public`
2. Backend bundles with esbuild → `dist/index.js`
3. Static assets served from build directory
4. Production optimizations: tree-shaking & minification


## Recent Highlights (Jan – Jul 2025)

* **Schema Upgrade (Jul 24)** — `title` → `courseNumber`, added `courseTitle`, removed `description`; full DB migration & API update completed.
* **New Question Types (Jan 23)** — drag-and-drop ordering, numerical entry, short answer, multi-response, and select-list; UI & validation logic added.
* **Content-Import Pipeline (Jul 22–30)** — Bubble.io learning-object import, external-ID mapping table (32 AI + non-AI IDs), and dashboard lookup endpoint.
* **AI & Chatbot**

  * Default model switched to **Gemini 2.5 Flash**; curated model list trimmed.
  * HTML renderer upgraded for rich tags; adaptive polling + 8 K-token context.
* **Auth & Access** — environment-aware SSO flow, direct URL deep-links (`courseId` & `assignmentName`), admin-only dashboards, simplified auth UI.
* **Performance & Stability** — streaming memory-leak fix, session-write reduction, retry logic for DB & SSE, connection-pool tuning, Neon termination guard.
* **UI/UX** — responsive header fix, question-type badges, mobile nav overhaul, collapsible progress sidebar.
* **Legacy Cleanup** — removed `practice_tests` tables & routes; practice now driven solely by `question_sets`.