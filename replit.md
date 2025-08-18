# Exam Practice Questions

## Overview
An advanced AI-powered platform for insurance professional certification exam preparation, offering intelligent, adaptive learning experiences tailored to individual student needs. The platform supports multiple certification paths including CPCU (Chartered Property Casualty Underwriter) and AIC (Associate in Claims) programs.

## Recent Changes (January 2025)
- **UI/UX Improvements**: 
  - Widened and centered assistant message cards for better mobile readability
  - Fixed Submit Answer button accessibility on mobile by adjusting scroll areas and z-index stacking
  - Added proper safe area insets for iOS devices
  - Improved sticky footer behavior to prevent content overlap

## Project Architecture

### Technology Stack
- **Frontend**: React.js with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui components
- **State Management**: TanStack Query (React Query) v5
- **Routing**: Wouter
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL (Neon serverless)
- **ORM**: Drizzle ORM
- **Authentication**: Passport.js with AWS Cognito SSO and local auth
- **AI Integration**: OpenRouter API for intelligent tutoring
- **Session Management**: Express-session with PostgreSQL store
- **Build Tools**: Vite
- **Deployment**: Replit

### Core Features
1. **Multi-Modal Authentication**
   - AWS Cognito Single Sign-On (SSO) for enterprise users
   - Local authentication for admin users
   - Session persistence with 7-day expiration

2. **Course Management System**
   - Support for CPCU and AIC certification courses
   - Dynamic course loading via URL parameters
   - External course ID mapping for integration with external LMS
   - Bubble.io integration for content import

3. **Question Set System**
   - Question versioning system
   - Progress tracking and analytics
   - Randomized question ordering

4. **AI-Powered Tutoring**
   - Context-aware chatbot for question explanations
   - Configurable AI models
   - Prompt versioning system
   - Response logging for quality monitoring
   - User feedback system with thumbs up/down ratings
   - Detailed feedback modal for negative responses

5. **Admin Dashboard**
   - User management
   - Course and question set management
   - AI settings configuration
   - Analytics and reporting
   - Bulk import/export capabilities
   - Comprehensive activity logs

6. **Performance Optimizations**
   - Database connection pooling with circuit breaker
   - Retry mechanisms for database operations
   - Lazy loading for code splitting
   - Database indexes for query optimization
   - Health monitoring system

## Database Schema

### Core Tables
- **users**: User accounts with SSO and local auth support
- **courses**: Course definitions with external ID mapping
- **question_sets**: Collections of questions per course
- **questions**: Individual question definitions
- **question_versions**: Versioned question content
- **user_test_runs**: Test session tracking
- **user_answers**: Answer recording and scoring
- **course_materials**: Learning object content
- **chatbot_logs**: AI interaction tracking
- **chatbot_feedback**: User feedback on AI responses
- **user_course_progress**: Progress tracking
- **daily_activity_summary**: Analytics aggregation

### Key Relationships
- Courses → Question Sets (1:many)
- Question Sets → Questions (1:many)
- Questions → Question Versions (1:many)
- Users → Test Runs → Answers

## API Architecture

### Authentication Endpoints
- `POST /api/auth/login` - Local authentication
- `GET /api/auth/cognito/login` - SSO initiation
- `GET /api/auth/cognito/callback` - SSO callback
- `POST /api/auth/logout` - Session termination
- `GET /api/user` - Current user info

### Course Management
- `GET /api/courses` - List all courses
- `GET /api/courses/by-external-id/:id` - Get course by external ID
- `GET /api/question-sets/:courseId` - Get question sets for course

### Practice Test System
- `POST /api/test-runs` - Start new test run
- `POST /api/test-runs/:id/answers` - Submit answer
- `GET /api/test-runs/:id` - Get test run details
- `GET /api/test-runs/:id/results` - Get test results

### AI Chatbot
- `POST /api/chatbot/stream` - Stream AI responses
- `GET /api/admin/chatbot-logs` - View interaction logs

### Admin APIs
- `GET /api/admin/*` - Various admin endpoints
- `POST /api/admin/import/*` - Bulk import endpoints
- `GET /api/admin/logs/*` - Analytics endpoints

## Security Features

### Headers & CORS
- XSS Protection headers
- Content Security Policy
- CORS with credential support
- HTTPS enforcement in production

### Authentication Security
- Password hashing with scrypt
- Timing-safe password comparison
- Session cookies with httpOnly flag
- Admin role verification
- SSO integration with AWS Cognito

### Database Security
- Connection pooling with limits
- Query timeout configuration
- Prepared statements via Drizzle ORM
- Circuit breaker for connection failures

## Development Workflow

### Local Development
1. **Environment Variables Required**:
   - `DATABASE_URL` - PostgreSQL connection string
   - `SESSION_SECRET` - Session encryption key
   - `COGNITO_DOMAIN` - AWS Cognito domain
   - `COGNITO_CLIENT_ID` - Cognito app client ID
   - `COGNITO_CLIENT_SECRET` - Cognito app client secret
   - `COGNITO_REDIRECT_URI` - OAuth callback URL
   - `OPENROUTER_API_KEY` - AI service API key

2. **Start Development Server**:
   ```bash
   npm run dev
   ```
   This starts both Express backend (port 5000) and Vite frontend

3. **Database Migrations**:
   ```bash
   npm run db:push
   ```
   Push schema changes to database

### Project Structure
```
/
├── client/               # Frontend React application
│   ├── src/
│   │   ├── pages/       # Route components
│   │   ├── components/  # Reusable UI components
│   │   ├── hooks/       # Custom React hooks
│   │   ├── contexts/    # React contexts
│   │   ├── lib/         # Utilities and clients
│   │   └── styles/      # Global styles
│   └── index.html
├── server/              # Backend Express application
│   ├── index.ts        # Server entry point
│   ├── routes.ts       # API route definitions
│   ├── storage.ts      # Data access layer
│   ├── db.ts          # Database connection
│   ├── auth.ts        # Authentication setup
│   ├── cognito-auth.ts # SSO implementation
│   └── utils/         # Utility functions
├── shared/             # Shared types and schemas
│   └── schema.ts      # Database schema & types
└── package.json       # Dependencies
```

# Custom Global Preferences

These rules apply to all interactions and code. Deviate only if explicitly told to.

### 1) Change Control
- **Never modify any prompts without explicit user approval.**
- **Never change LLMs or model settings without confirmation.**
- **Never edit, delete, or write data (DBs, files, inputs) without approval in this conversation.**

### 2) Communication (Plan → Clarify → Close)
- **Plan:** Briefly state what you’ll do, why, and potential impacts; for non-trivial work, outline numbered steps and wait for the go-ahead.
- **Clarify:** Ask immediately if anything is unclear or conflicting.
- **Close:** Summarize what you did and suggest next steps.

### 3) Coding Standards
- Write readable code: descriptive names, comments only for non-obvious logic, DRY.
- Keep it modular: small, reusable functions/components.
- Consistent formatting: 4-space indent; keep lines ~≤80 chars where practical; avoid needless complexity.
- Robust errors: handle exceptions, log meaningfully, return user-friendly messages.
- Performance & security: validate inputs, avoid inefficient loops, never hard-code secrets.

### 4) Data Handling & Safety
- Use anonymized or mock data for sensitive scenarios whenever possible.
- Back up affected code/data before risky changes and explain how to roll back.

### 5) Testing & Version Control
- Add unit tests for new functions/features; target ≥80% coverage on critical paths.
- Run tests and report any failures before finalizing.

### 6) Dependencies, Research & Response Style
- Use latest stable libraries after confirming stack compatibility.
- If you research externally, cite sources and briefly state why they’re relevant.
- Keep responses focused and concise; include code snippets/examples when helpful.

## Recent Changes & Updates

### Latest Updates (August 2025)
- Implemented comprehensive question type support (multiple choice, fill-in-blank, numerical, etc.)
- Added Bubble.io integration for content import
- Enhanced admin dashboard with detailed analytics
- Implemented course external ID mapping system
- Added database health monitoring and circuit breaker
- Optimized database connection pooling
- Added comprehensive logging system
- **Bug Fixes (August 14, 2025)**:
  - Fixed duplicate security headers in server/index.ts
  - Fixed memory leak in stream cleanup (now cleans up error streams)
  - Added user validation for stream abort endpoint to prevent unauthorized access
  - Improved stream ownership validation for security
- **Conversation History Update (August 18, 2025)**:
  - Fixed follow-up message handling to use multi-turn conversation history
  - Removed additional prompt injection for follow-up messages
  - AI now maintains full conversation context naturally through message history
  - Follow-up messages simply append to existing conversation thread

### Known Features
- URL parameter-based course selection (course_id, assignment_name)
- Question versioning for content updates
- Real-time AI tutoring with streaming responses
- Comprehensive test analytics and reporting
- Bulk import/export capabilities
- Session persistence across page refreshes

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

## Deployment Configuration

### Replit Setup
- Application runs on port 5000
- Automatic HTTPS in production
- Environment variables configured in Replit Secrets
- PostgreSQL database provisioned through Replit

### Production Considerations
- Enable SSO for enterprise users
- Configure proper session secrets
- Set up monitoring for database health
- Review and adjust AI model settings
- Configure backup and recovery procedures

## Troubleshooting Guide

### Common Issues
1. **Authentication Problems**
   - Check session cookie settings
   - Verify Cognito configuration
   - Ensure CORS headers are correct

2. **Database Connection Issues**
   - Monitor circuit breaker status
   - Check connection pool settings
   - Review retry mechanism logs

3. **Course Loading Problems**
   - Verify external ID mappings
   - Check URL parameter parsing
   - Validate course data integrity

4. **AI Chatbot Issues**
   - Verify OpenRouter API key
   - Check prompt configuration
   - Review response streaming setup

## Future Enhancements

### Planned Features
- Advanced analytics dashboard
- Mobile-responsive design improvements
- Offline practice mode
- Performance tracking over time
- Custom learning paths
- Integration with more LMS platforms

### Technical Improvements
- Implement caching strategy
- Add comprehensive test coverage
- Optimize bundle size
- Enhance error recovery mechanisms
- Add real-time collaboration features

## Maintenance Notes

### Regular Tasks
- Monitor database performance indexes
- Review AI interaction logs for quality
- Check authentication token expiration
- Update course content as needed
- Backup database regularly

### Performance Monitoring
- Track API response times
- Monitor database query performance
- Review error logs regularly
- Check memory usage patterns
- Analyze user engagement metrics

---

*Last Updated: August 2025*
*Version: 3.0*