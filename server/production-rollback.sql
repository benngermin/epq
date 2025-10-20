-- PRODUCTION ROLLBACK SCRIPT FOR FINAL REFRESH
-- Use this script only in case of critical issues after final refresh
-- This script should be executed with extreme caution

-- Step 1: Backup current state before rollback (CRITICAL)
-- CREATE BACKUP OF THE DATABASE BEFORE RUNNING THIS SCRIPT

-- Step 2: Reset final refresh flags
UPDATE app_settings 
SET value = 'false', updated_at = NOW() 
WHERE key = 'finalRefreshCompleted';

UPDATE app_settings 
SET value = 'false', updated_at = NOW() 
WHERE key = 'finalRefreshInProgress';

-- Step 3: If question versions were corrupted, revert to previous active versions
-- This query identifies questions with potential issues
WITH version_audit AS (
  SELECT 
    question_id,
    MAX(id) as latest_version_id
  FROM question_versions
  WHERE is_active = false
  GROUP BY question_id
)
SELECT 
  q.id as question_id,
  q.question_text as current_question,
  qv.question_text as previous_version_text,
  qv.id as previous_version_id
FROM questions q
JOIN version_audit va ON q.id = va.question_id
JOIN question_versions qv ON qv.id = va.latest_version_id
WHERE q.updated_at >= (NOW() - INTERVAL '1 day'); -- Only check recently updated questions

-- Step 4: Manual review required
-- Review the above query results before proceeding
-- If rollback is needed for specific questions, use:
/*
UPDATE question_versions
SET is_active = false
WHERE question_id = [QUESTION_ID] AND is_active = true;

UPDATE question_versions
SET is_active = true
WHERE id = [PREVIOUS_VERSION_ID];
*/

-- Step 5: Clear any locks or temporary data
DELETE FROM app_settings 
WHERE key LIKE 'refresh_%' 
AND key NOT IN ('finalRefreshCompleted', 'finalRefreshInProgress');

-- Step 6: Verify rollback
SELECT 
  key,
  value,
  updated_at
FROM app_settings
WHERE key IN ('finalRefreshCompleted', 'finalRefreshInProgress');

-- Step 7: Check data consistency after rollback
SELECT 
  'Questions with multiple active versions' as check_name,
  COUNT(*) as issue_count
FROM (
  SELECT question_id
  FROM question_versions
  WHERE is_active = true
  GROUP BY question_id
  HAVING COUNT(*) > 1
) duplicates;

-- IMPORTANT NOTES:
-- 1. This rollback does NOT restore deleted data
-- 2. This rollback does NOT undo question content changes
-- 3. The Bubble.io integration remains disabled in the code
-- 4. To fully restore Bubble functionality, code deployment rollback is required
-- 5. Always create a full backup before running any rollback scripts

-- END OF ROLLBACK SCRIPT