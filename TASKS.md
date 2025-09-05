# EPQ Question Set Migration Tasks

This file tracks all tasks for migrating from duplicate question sets to a shared question set architecture using junction tables. **Cross out completed tasks as work progresses.**

## Phase 1: Local Development & Schema Changes

### 1.1 Database Schema Updates (`shared/schema.ts`)
- [ ] Remove `courseId` field from `questionSets` table definition
- [ ] Remove `isAi` field from `questionSets` table definition  
- [ ] Add `baseCourseNumber` field to `courses` table definition
- [ ] Create new `courseQuestionSets` junction table with:
  - [ ] `id` (serial primary key)
  - [ ] `courseId` (foreign key to courses)
  - [ ] `questionSetId` (foreign key to questionSets)
  - [ ] `displayOrder` (integer for ordering)
  - [ ] `createdAt` (timestamp)
  - [ ] Unique constraint on (courseId, questionSetId)
- [ ] Update TypeScript types for all modified tables
- [ ] Update Drizzle relations to reflect new many-to-many relationship
- [ ] Add new insert/select schemas for `courseQuestionSets`

### 1.2 Storage Layer Updates (`server/storage.ts`)
- [ ] Modify `getQuestionSetsByCourse()` method to use junction table JOIN query
- [ ] Add `createCourseQuestionSetMapping()` method for linking courses to question sets
- [ ] Add `removeCourseQuestionSetMapping()` method for unlinking
- [ ] Add `getCoursesForQuestionSet()` method to find all courses using a question set
- [ ] Add `getCoursesByBaseCourseNumber()` method to group AI/Non-AI courses
- [ ] Update `importQuestions()` method to work with shared question sets
- [ ] Update `updateQuestionsForRefresh()` method to handle junction table relationships
- [ ] Add methods to interface definition for all new functions
- [ ] Update existing methods that assume direct courseId on questionSets

### 1.3 API Routes Updates (`server/routes.ts`)
- [ ] Update `/api/courses/:id/question-sets` to use new junction table query
- [ ] Add `/api/admin/question-sets-with-courses` endpoint for admin panel
- [ ] Update question set import endpoints to handle course associations
- [ ] Update refresh endpoints to work with shared question sets
- [ ] Ensure all existing endpoints continue to work with new schema
- [ ] Add endpoint for managing course-questionset relationships in admin

### 1.4 Migration Scripts Creation (`server/scripts/`)
- [ ] Create `analyze-duplicate-questionsets.ts` script to:
  - [ ] Identify courses with same baseCourseNumber
  - [ ] Find duplicate question sets between AI/Non-AI course pairs
  - [ ] Generate deduplication report
  - [ ] Validate question content matches between duplicates
- [ ] Create `migrate-to-shared-questionsets.ts` script to:
  - [ ] Connect to both old and new databases
  - [ ] Extract all data from old database (READ ONLY)
  - [ ] Populate `baseCourseNumber` field based on `courseNumber`
  - [ ] Deduplicate question sets by content comparison
  - [ ] Create junction table entries for course-questionset relationships
  - [ ] Migrate all related data (questions, versions, user data)
  - [ ] Generate detailed migration report with statistics
- [ ] Create `validate-migration.ts` script to:
  - [ ] Verify data integrity after migration
  - [ ] Check all courses have correct question sets
  - [ ] Validate no data loss occurred
  - [ ] Run test queries to ensure functionality
- [ ] Create `rollback-migration.ts` script for emergency rollback capability

### 1.5 Frontend Updates
- [ ] Update admin panel (`client/src/pages/admin-panel.tsx`) to:
  - [ ] Show which courses share each question set
  - [ ] Display course relationships in question set management
  - [ ] Add UI for managing course-questionset associations
  - [ ] Update question set import/refresh UI if needed
- [ ] Verify student-facing functionality requires no changes
- [ ] Test question set display in course selection
- [ ] Test question answering functionality remains unchanged

### 1.6 Testing & Validation
- [ ] Create unit tests for new storage methods
- [ ] Create integration tests for new API endpoints
- [ ] Test migration scripts with sample data locally
- [ ] Verify existing functionality still works
- [ ] Test edge cases (orphaned question sets, missing relationships)

## Phase 2: GitHub & New Replit App Creation

### 2.1 Code Repository Updates
- [ ] Commit all local changes with clear commit messages
- [ ] Push changes to GitHub repository
- [ ] Create pull request if using feature branch workflow
- [ ] Tag release version for migration milestone

### 2.2 New Replit App Setup  
- [ ] Create new Replit app by importing from GitHub repository
- [ ] Verify new app has separate development and production databases
- [ ] Configure environment variables in new Replit app:
  - [ ] `DATABASE_URL` for development database
  - [ ] `DATABASE_URL` for production database  
  - [ ] `SESSION_SECRET`
  - [ ] `OPENROUTER_API_KEY`
  - [ ] `COGNITO_*` variables
  - [ ] `BUBBLE_API_KEY`
- [ ] Run `npm install` to install dependencies
- [ ] Run `npm run db:push` to create new schema in development database
- [ ] Run `npm run db:push` on production database to create schema
- [ ] Verify app starts successfully in development mode

## Phase 3: Data Migration

### 3.1 Database Connection Setup
- [ ] Obtain old database credentials (current live app)
- [ ] Obtain new database credentials (new app's production database)
- [ ] Test connections to both databases
- [ ] Verify read-only access to old database
- [ ] Verify write access to new database
- [ ] Create database connection utility for migration scripts

### 3.2 Migration Execution
- [ ] Run analysis script on old database to understand data structure
- [ ] Review deduplication report for accuracy
- [ ] Execute migration script with comprehensive logging
- [ ] Monitor migration progress and handle any errors
- [ ] Generate final migration report with statistics:
  - [ ] Number of courses migrated
  - [ ] Number of question sets before/after deduplication
  - [ ] Number of users migrated
  - [ ] Number of question sets, questions, versions migrated
  - [ ] Any data transformation issues encountered

### 3.3 Data Validation
- [ ] Run validation script to check migration integrity
- [ ] Verify course count matches expected numbers
- [ ] Verify question set relationships are correct
- [ ] Verify no duplicate question sets remain
- [ ] Verify user data migrated correctly
- [ ] Check sample user test runs and answers
- [ ] Validate admin users have correct permissions

## Phase 4: Testing & Validation

### 4.1 Development Database Testing
- [ ] Test user registration and login flow
- [ ] Test course selection and question set display
- [ ] Test question answering for all question types
- [ ] Test AI chatbot functionality
- [ ] Test admin panel functionality
- [ ] Test question set import/refresh functionality
- [ ] Test user progress tracking and analytics

### 4.2 Integration Testing
- [ ] Test complete user journey from login to completion
- [ ] Test admin workflows (user management, content management)
- [ ] Test error handling and edge cases
- [ ] Test performance with realistic data volume
- [ ] Test mobile and desktop user interfaces

### 4.3 Data Integrity Verification
- [ ] Compare key metrics between old and new systems
- [ ] Verify user progress data is preserved
- [ ] Check that shared question sets work correctly
- [ ] Validate analytics data integrity
- [ ] Test backup and restore procedures

## Phase 5: Production Cutover

### 5.1 Pre-Cutover Checklist
- [ ] All testing phases completed successfully
- [ ] Migration validation passed
- [ ] Rollback procedures tested and documented
- [ ] Stakeholder approval obtained
- [ ] Maintenance window scheduled if needed
- [ ] Monitoring and alerting configured for new app

### 5.2 Production Deployment
- [ ] Final data sync from old database if needed
- [ ] Switch domain DNS to point to new Replit app
- [ ] Monitor new app performance and error rates
- [ ] Verify user login and core functionality works
- [ ] Monitor for any reported issues from users

### 5.3 Post-Cutover Activities
- [ ] Monitor system performance for 24-48 hours
- [ ] Validate user activity and engagement metrics
- [ ] Address any reported issues immediately  
- [ ] Document any lessons learned
- [ ] Schedule old app deprecation after stability confirmed
- [ ] Update any external integrations or documentation

## Phase 6: Cleanup & Documentation

### 6.1 System Cleanup
- [ ] Archive old Replit app (do not delete immediately)
- [ ] Update monitoring and backup systems
- [ ] Clean up temporary migration scripts and files
- [ ] Update system documentation with new architecture

### 6.2 Team Handover
- [ ] Update CLAUDE.md with post-migration architecture notes
- [ ] Document any new operational procedures
- [ ] Create troubleshooting guide for common issues
- [ ] Update development setup instructions for new schema

---

## Emergency Procedures

### If Migration Fails
- [ ] Execute rollback script to revert changes
- [ ] Switch DNS back to old app if domain was switched
- [ ] Investigate and document failure cause
- [ ] Fix issues and restart migration process

### If Data Corruption Detected  
- [ ] Immediately stop new app if live
- [ ] Switch back to old app to maintain service
- [ ] Investigate data corruption scope and cause
- [ ] Restore from backup if available
- [ ] Re-run migration with fixes

---

## Notes Section
(Add any additional notes, discoveries, or changes that come up during development)
