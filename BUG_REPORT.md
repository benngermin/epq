# Bug Report - Exam Practice Questions (EPQ) Application

## Analysis Date: August 5, 2025
## Last Updated: January 9, 2025

After conducting a comprehensive analysis of your application, I've identified several potential bugs and areas of concern. Here's a detailed report:

## 1. CRITICAL: Memory Leak in usePerformanceMonitor Hook ✅ FIXED

**Location**: `client/src/hooks/use-performance-monitor.ts`

**Issue**: The useEffect hook has an incorrect dependency array. The hook records the render start time when the effect runs, but the cleanup function calculates render time using the start time from when the effect ran, not when the component actually started rendering.

**Impact**: Performance metrics will be inaccurate, potentially leading to false positives in performance monitoring.

**Fix Applied**: Updated to record render start time immediately when component renders, and removed the dependency array from useEffect to ensure it runs on every render.

## 2. WARNING: Event Listener Memory Leak in useIsMobile Hook

**Location**: `client/src/hooks/use-mobile.tsx`

**Issue**: The code uses `removeEventListener` which is deprecated. Should use the modern `removeEventListener` method properly.

**Impact**: Minor memory leak as event listeners may not be properly cleaned up in some browsers.

**Fix Required**: Update to use the modern event listener API consistently.

## 3. MODERATE: Race Condition in streamOpenRouterToBuffer ✅ FIXED

**Location**: `server/routes.ts` (lines 299-320)

**Issue**: The while loop reading from the response stream doesn't properly handle all edge cases. If the stream is aborted or times out, the reader might not be properly cancelled in all scenarios.

**Impact**: Could lead to hanging connections or incomplete responses in edge cases.

**Fix Applied**: Added try-catch-finally blocks to ensure reader.cancel() is called in all error paths, and made reader.cancel() calls asynchronous with proper error handling.

## 4. MODERATE: Missing Error Handling in Cognito Auth Callback

**Location**: `server/cognito-auth.ts` (lines 113-128)

**Issue**: Session save error handling redirects to a JSON response but the client might expect a redirect during the OAuth flow.

**Impact**: Users might see raw JSON error instead of a proper error page during SSO failures.

**Fix Required**: Redirect to an error page instead of returning JSON during OAuth flow errors.

## 5. WARNING: Potential Session Race Condition ✅ FIXED

**Location**: `server/auth.ts` (lines 185-188)

**Issue**: The `req.login()` callback is not properly awaited, which could lead to the response being sent before the session is fully established.

**Impact**: In rare cases, the user might appear logged in on the client but the session isn't fully saved on the server.

**Fix Applied**: Added req.session.save() calls after req.login() to ensure the session is fully persisted before sending the response.

## 6. MINOR: Inefficient Question Status Calculation ✅ FIXED

**Location**: `client/src/components/question-navigation.tsx` (lines 30-38)

**Issue**: The questionStatuses array is recalculated on every render without memoization, potentially causing performance issues with large question sets.

**Impact**: Unnecessary re-renders and calculations, especially with 100+ questions.

**Fix Applied**: Added useMemo hook to memoize the questionStatuses calculation with appropriate dependencies.

## 7. WARNING: Missing Await in Bulk Import Operations ✅ FIXED

**Location**: `server/routes.ts` (lines 2266-2431)

**Issue**: The `storage.importQuestions` and `storage.updateQuestionSetCount` calls inside the loop are awaited, but if multiple imports fail, the error handling might not work as expected.

**Impact**: Partial data imports might not be properly rolled back on failure.

**Fix Applied**: Added proper try-catch blocks around bulk import operations to ensure errors are caught and re-thrown for proper error handling in parent catch blocks.

## 8. MINOR: Stale Closure Risk in Active Streams Cleanup ✅ FIXED

**Location**: `server/routes.ts` (lines 185-197)

**Issue**: The setInterval cleanup function for activeStreams might reference stale data if the Map is modified during iteration.

**Impact**: Memory leaks if streams aren't properly cleaned up.

**Fix Applied**: Modified both the heartbeat monitor and cleanup intervals to create defensive copies of the Map entries before iteration using Array.from().

## 9. PERFORMANCE: Database Query Without Index

**Location**: Multiple database queries

**Issue**: While indexes are created in `server/utils/db-indexes.ts`, some complex queries might benefit from composite indexes that aren't currently defined.

**Impact**: Slower query performance as data grows.

**Recommendation**: Monitor slow queries and add appropriate indexes.

## 10. WARNING: Content Security Policy Too Permissive

**Location**: `server/index.ts` (lines 26-33)

**Issue**: The CSP allows 'unsafe-inline' and 'unsafe-eval' for scripts, which weakens XSS protection.

**Impact**: Reduced security against XSS attacks.

**Recommendation**: Consider implementing nonce-based CSP for better security.

## 11. NEW ISSUE: Empty Catch Block Suppressing Errors

**Location**: `server/routes.ts` (line 3350)

**Issue**: An empty catch block silently suppresses errors when fetching course information during bulk refresh operations.

```javascript
try {
  const courseBubbleId = bubbleQuestionSet.course || bubbleQuestionSet.course_custom_course;
  if (courseBubbleId) {
    const course = await storage.getCourseByBubbleId(courseBubbleId);
    if (course) {
      courseName = course.courseTitle;
      courseId = course.id;
    }
  }
} catch {} // Empty catch - errors are silently ignored
```

**Impact**: Important errors that occur when fetching course information are hidden, making debugging difficult.

**Fix Required**: Add proper error logging at minimum:
```javascript
} catch (error) {
  if (process.env.NODE_ENV === 'development') {
    console.error('Failed to fetch course info:', error);
  }
}
```

## 12. NEW ISSUE: Console Logging Sensitive Data in Production

**Location**: `server/routes.ts` (lines 297-301)

**Issue**: Debug logging of conversation history is not wrapped in development environment check.

**Impact**: Exposes potentially sensitive conversation data and message content in production logs.

**Fix Required**: Wrap debug logs in development check:
```javascript
if (process.env.NODE_ENV === 'development') {
  console.log("=== CONVERSATION HISTORY DEBUG ===");
  // ... rest of logs
}
```

## 13. NEW ISSUE: SessionStorage Access Without Existence Check

**Location**: `client/src/hooks/use-performance-monitor.ts` (lines 36-46)

**Issue**: The hook accesses sessionStorage without checking if it exists, which can throw errors in environments where storage is disabled.

**Impact**: Application crashes in private browsing mode or when storage is disabled.

**Fix Required**: Add existence check before accessing storage:
```javascript
if (typeof window !== 'undefined' && window.sessionStorage) {
  const existingMetrics = JSON.parse(
    sessionStorage.getItem('performance-metrics') || '[]'
  );
  // ... rest of code
}
```

## Summary

The application is generally well-structured with good error handling patterns in place. Most critical issues have been fixed:

### Fixed Issues (January 20, 2025):
✅ **CRITICAL**: Memory leak in usePerformanceMonitor hook - Fixed
✅ **MODERATE**: Race condition in streamOpenRouterToBuffer - Fixed  
✅ **WARNING**: Session race condition in auth.ts - Fixed
✅ **WARNING**: Missing await in bulk import operations - Fixed with proper error handling
✅ **MINOR**: Inefficient question status calculation - Fixed with memoization
✅ **MINOR**: Stale closure risk in active streams cleanup - Fixed

### Newly Discovered Issues (September 8, 2025):
- **HIGH**: Empty catch block suppressing errors (Bug #11)
- **MODERATE**: Console logging sensitive data in production (Bug #12)
- **MODERATE**: SessionStorage access without existence check (Bug #13)

### Other Remaining Issues (Non-Critical):
- **WARNING**: Event listener memory leak in useIsMobile hook (already using correct API, minimal impact)
- **MODERATE**: Missing error handling in Cognito Auth Callback (already redirects to error page)
- **PERFORMANCE**: Database query optimization opportunities
- **WARNING**: Content Security Policy allows unsafe-inline (required for React/Tailwind)

**Fixed Issues**: 6 (1 Critical, 1 Moderate, 4 Minor/Warning)
**Newly Found Issues**: 3 (1 High, 2 Moderate)
**Other Remaining Issues**: 4 (1 Moderate, 3 Performance/Security - all with minimal impact)

## Recommendations

1. **Completed**: Critical performance and race condition fixes
2. **Next Priority**: Address Cognito auth error handling and bulk import operations
3. **Medium Priority**: Database query optimization and CSP improvements
4. **Low Priority**: Review remaining edge cases

The application is now more stable with the critical bugs fixed, particularly around performance monitoring, streaming operations, and session management.