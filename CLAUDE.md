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

### Replit-Specific Configurations

#### Environment Detection
```javascript
const isReplitEnv = Boolean(
  process.env.REPL_ID || 
  process.env.REPLIT_DEV_DOMAIN ||
  process.env.REPLIT_DB_URL ||
  req.get('host')?.includes('.replit.')
);
```

#### Required Environment Variables
- `DATABASE_URL` - PostgreSQL connection (Neon)
- `SESSION_SECRET` - Session encryption
- `OPENROUTER_API_KEY` - AI chatbot integration
- `COGNITO_*` - AWS SSO configuration
- `BUBBLE_API_KEY` - Content repository integration

#### Node.js & Dependencies
- Uses `tsx` for TypeScript execution
- Drizzle ORM v0.39.1 for database
- ESM module system
- Vite for frontend bundling

### Testing
- **Test Command**: `npm run test:validation`
- **Test File**: `test-validation.ts`
- **Coverage**: 30+ test cases for all question types and edge cases

### Import Process Updates
- Questions normalized during import from Bubble
- Applied in `/api/admin/bubble/update-all-question-sets`
- Prevents blank pattern mismatches

### Critical Implementation Notes

1. **No Partial Credit**: All questions require complete correctness
2. **JSON Safety**: All JSON parsing wrapped in try-catch with fallbacks
3. **Logging**: Debug mode respects `NODE_ENV` and Replit environment
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
└── routes.ts                   # Updated endpoints (lines 1185-1198, 1263-1276)
```

### Development Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run test:validation` - Run answer validation tests
- `npm run db:push` - Push database schema changes

### Deployment Process
1. Push to GitHub: `git push origin main`
2. Pull in Replit: `git pull origin main`
3. Test: `npm run test:validation`
4. Restart: `npm run dev`