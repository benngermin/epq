# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Information
- **GitHub Repository**: https://github.com/benngermin/epq.git
- **Main Branch**: main
- **Purpose**: Educational Platform for Questions (EPQ) - A comprehensive question/answer testing system

## Answer Validation System (Fixed January 2025)

### Issue Context
The EPQ system was incorrectly marking correct answers as wrong for various question types, particularly:
- drag_and_drop
- multiple_response  
- select_from_list
- Questions with multiple blanks

### Solution Architecture

#### Core Validation Module
- **Location**: `server/utils/answer-validation.ts`
- **Purpose**: Centralized validation for all 7 question types
- **Key Features**:
  - Safe JSON parsing with fallback handling
  - Type-specific validation logic
  - Order-insensitive comparison for sets/zones
  - Case sensitivity support

#### Blank Normalization
- **Location**: `server/utils/blank-normalizer.ts`
- **Patterns Handled**: `blank_n`, `[]`, `***`, `___`
- **Applied During**: Question import process
- **Output**: Standardized `___` format

#### Question Types & Validation Rules

1. **multiple_choice**: Simple string comparison (case-insensitive)
2. **numerical_entry**: Exact match or within acceptable_answers array
3. **short_answer**: 
   - Supports multiple blanks (JSON format: `{"1":"answer1","2":"answer2"}`)
   - Joins blanks with comma-space for validation
   - Case sensitivity configurable
4. **select_from_list**:
   - Single dropdown: Direct string comparison
   - Multiple dropdowns: JSON object with position keys `{"1":"choice1","2":"choice2"}`
5. **drag_and_drop**:
   - Answer format: `{"zone_1":["Item1","Item2"],"zone_2":["Item3"]}`
   - Accepts both `zone_1` and `1` key formats
   - Order within zones doesn't matter
6. **multiple_response**:
   - Answer format: `["Option1","Option2","Option3"]`
   - Order of selections doesn't matter
   - All correct options must be selected (no partial credit)
7. **either_or**: Binary choice, simple string comparison

### Database Storage Details
- **Answers stored as**: Text strings in `chosen_answer` column
- **Complex types**: Stored as JSON strings, parsed during validation
- **drag_and_drop**: `correct_answer` stored as JSON string
- **multiple_response**: `correct_answer` stored as JSON string array

### Environment Configuration

#### Required Environment Variables
- `DATABASE_URL` - PostgreSQL connection (Neon)
- `SESSION_SECRET` - Session encryption
- `OPENROUTER_API_KEY` - AI chatbot integration
- `COGNITO_*` - AWS SSO configuration
- `BUBBLE_API_KEY` - Content repository integration

#### Technology Stack
- **Backend**: Node.js with TypeScript (tsx runtime)
- **Database**: PostgreSQL (Neon) with Drizzle ORM
- **Frontend**: React with Vite bundling
- **Module System**: ESM
- **Authentication**: AWS Cognito SSO with local fallback

### Testing
- **Test Command**: `npm run test:validation`
- **Test File**: `test-validation.ts`
- **Coverage**: 30+ test cases for all question types and edge cases

### Import & Refresh System (Updated January 2025)

#### Key Improvements
- **UPDATE vs DELETE**: All refresh operations now UPDATE existing questions instead of deleting them
- **ID Preservation**: Question IDs remain unchanged, protecting analytics data
- **Blank Normalization**: Applied during all imports/refreshes
- **Bulk Operations**: Supports batch processing with progress tracking
- **Real-time Progress**: SSE (Server-Sent Events) for live progress updates
- **Enhanced Error Reporting**: Detailed error messages with course context

#### Refresh Endpoints
1. **Bulk Refresh**: `/api/admin/bubble/bulk-refresh-question-sets` (GET with SSE)
   - Uses Server-Sent Events for real-time progress updates
   - Processes 5 question sets at a time
   - Live progress indicator updates as sets complete
   - Enhanced error tracking with:
     - Question set name and ID
     - Associated course name and ID
     - Detailed error message and resolution hints
   - Visual error indicators on failed question sets
   - Confirmation modal prevents accidents

2. **Individual Refresh**: `/api/admin/question-sets/:id/update-from-bubble`
   - Updates single question set
   - Preserves all question IDs
   - Uses `updateQuestionsForRefresh` method

3. **Update All**: `/api/admin/bubble/update-all-question-sets`
   - Imports new question sets
   - Updates existing ones
   - Conditional logic based on existence

#### Storage Implementation
- **Method**: `updateQuestionsForRefresh()` in `server/storage.ts`
- **Purpose**: Updates questions while preserving IDs
- **Features**: 
  - Updates existing questions by matching `originalQuestionNumber`
  - Adds new questions if they don't exist
  - Updates or creates question versions
  - All wrapped in database transactions

#### UI Components
- **Location**: `client/src/pages/admin-panel.tsx`
- **Refresh All Button**: Top-right of Content Management tab
- **Features**:
  - Confirmation modal with clear warning
  - Real-time progress indicator updates live via SSE
  - Enhanced error display showing:
    - Question set title with course context
    - Specific error message
    - Detailed resolution instructions
    - Visual highlighting of failed sets (red background)
  - Failed question sets marked with:
    - Red background and border
    - "⚠️ Refresh Failed" badge
    - Inline error details
  - Continues on error, tracks all failures

#### Best Practices
- **Always use UPDATE**: Never DELETE questions during refresh
- **Preserve IDs**: Critical for maintaining analytics integrity
- **Batch Operations**: Process in groups of 5 to avoid timeouts
- **Error Handling**: Continue on failure, report all errors
- **User Feedback**: Show progress and clear error messages

### Critical Implementation Notes

1. **No Partial Credit**: All questions require complete correctness
2. **JSON Safety**: All JSON parsing wrapped in try-catch with fallbacks
3. **Environment-Aware Logging**: Debug mode respects `NODE_ENV` settings
4. **Backward Compatibility**: Handles existing data formats
5. **Performance**: Validation logic optimized for large question sets

### Common Gotchas
- Frontend sends answers as JSON strings, not objects
- `allow_multiple` field always true for multiple_response type
- Case sensitivity default is false unless explicitly set
- Empty/whitespace-only answers always marked incorrect
- Malformed JSON treated as incorrect answer

### File Structure
```
server/
├── utils/
│   ├── answer-validation.ts    # Main validation logic
│   ├── blank-normalizer.ts     # Blank pattern handling
│   └── debug-utils.ts         # Safe logging
├── test/
│   └── answer-validation.test.ts
└── routes.ts                   # API endpoints and refresh logic
```

### Development Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run test:validation` - Run answer validation tests
- `npm run db:push` - Push database schema changes

### Deployment Process
1. Push to GitHub: `git push origin main`
2. Pull in production: `git pull origin main`
3. Install dependencies: `npm install`
4. Run tests: `npm run test:validation`
5. Restart application: `npm run dev`

---

## Database Architecture (Updated January 2025)

### Current Schema
- **Junction Table Architecture**: Question sets are shared across courses via `course_question_sets` table
- **Deduplication**: 50% reduction in question sets (82 → 41) through intelligent matching
- **Database**: PostgreSQL (Neon) with Drizzle ORM
- **Key Tables**:
  - `courses` (includes `baseCourseNumber` for AI/Non-AI pairing)
  - `question_sets` (no direct course relationship)
  - `course_question_sets` (junction table linking courses to question sets)
  - `questions` and `question_versions` (with new `isActive` field for version tracking)

---

## Question Versioning System Update (January 2025)

### Overview
Implemented a proper question versioning system that preserves historical data instead of overwriting it. This ensures analytics integrity and enables rollback capabilities.

### Key Changes
1. **Schema Update**: Added `isActive` boolean field to `question_versions` table
2. **Import Logic Rewrite**: Modified `updateQuestionsForRefresh()` to create new versions when content changes instead of overwriting existing versions
3. **Version Management**: 
   - Each question can have multiple versions (v1, v2, v3, etc.)
   - Only ONE version per question is marked as active
   - Previous versions remain in database for historical reference
   - Version numbers auto-increment when content changes

### Technical Implementation
- **Files Modified**:
  - `shared/schema.ts`: Added `isActive` field to questionVersions table
  - `server/storage.ts`: Rewrote `updateQuestionsForRefresh()` with version comparison logic
  - `server/utils/blank-normalizer.ts`: Fixed import paths for proper module resolution
- **Migration Scripts Created**:
  - `server/scripts/delete-all-questions.ts`: Cleanup script for fresh start
  - `server/scripts/test-single-refresh.ts`: Testing script for validation
  - `server/scripts/refresh-all-questions.ts`: Bulk refresh script for all question sets

### Benefits
- **No Data Loss**: Historical versions preserved for audit trail
- **Analytics Integrity**: User answers always linked to the version they saw
- **Change Tracking**: Know exactly what changed and when
- **Rollback Capability**: Can revert to previous versions if needed

---

## AI Assistant Conversation History Fix (January 2025)

### Issue Context
The AI assistant was losing system prompt context in multi-turn conversations, causing inconsistent responses after the first message. The system prompt contains crucial instructions that guide the AI's behavior and must persist throughout the entire conversation.

### Root Cause
Client-side code was not sending conversation history (containing the system prompt) in follow-up API requests to the server, causing the server to initialize empty conversation history and lose the original system prompt.

### Solution Implementation
**Files Modified:**
- `client/src/components/chat-interface.tsx` - Added conversation history state management
- `server/routes.ts` - Modified stream endpoints to return conversation history

**Key Features:**
- **Bi-directional sync**: Client sends conversation history to server, server returns updated history
- **System prompt preservation**: System message always maintained as first message in conversation thread
- **Proper thread structure**: Maintains `system → assistant → user → assistant → user...` format
- **Automatic reset**: Conversation history clears when questions change
- **Backward compatibility**: No breaking changes to existing API contracts

### Technical Details
1. **Client State Management**: Added `conversationHistory` state to track server-side conversation format
2. **API Integration**: All streaming requests now include `conversationHistory` parameter
3. **Server Response**: Stream completion returns updated conversation history to client
4. **Context Preservation**: Every OpenRouter API call includes complete conversation history with system prompt

### Benefits
- ✅ System prompt persists across all multi-turn conversations
- ✅ Full conversation context maintained for AI responses
- ✅ No context loss between follow-up messages
- ✅ Consistent AI behavior throughout conversation sessions

---


### Development Workflow Instructions
When working on new features or fixes, use git commit messages that clearly describe the changes. Follow the established patterns for comprehensive commit messages with technical details.

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.