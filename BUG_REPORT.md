# Bug Report - Exam Practice Questions (EPQ) Application

## Analysis Date: August 5, 2025

After conducting a comprehensive analysis of your application, I've identified several potential bugs and areas of concern. Here's a detailed report:

## 1. CRITICAL: Memory Leak in usePerformanceMonitor Hook

**Location**: `client/src/hooks/use-performance-monitor.ts`

**Issue**: The useEffect hook has an incorrect dependency array. The hook records the render start time when the effect runs, but the cleanup function calculates render time using the start time from when the effect ran, not when the component actually started rendering.

**Impact**: Performance metrics will be inaccurate, potentially leading to false positives in performance monitoring.

**Fix Required**: The effect should run on every render (empty dependency array) rather than when componentName changes.

## 2. WARNING: Event Listener Memory Leak in useIsMobile Hook

**Location**: `client/src/hooks/use-mobile.tsx`

**Issue**: The code uses `removeEventListener` which is deprecated. Should use the modern `removeEventListener` method properly.

**Impact**: Minor memory leak as event listeners may not be properly cleaned up in some browsers.

**Fix Required**: Update to use the modern event listener API consistently.

## 3. MODERATE: Race Condition in streamOpenRouterToBuffer

**Location**: `server/routes.ts` (lines 299-320)

**Issue**: The while loop reading from the response stream doesn't properly handle all edge cases. If the stream is aborted or times out, the reader might not be properly cancelled in all scenarios.

**Impact**: Could lead to hanging connections or incomplete responses in edge cases.

**Fix Required**: Ensure reader.cancel() is called in all error paths and add proper try-finally blocks.

## 4. MODERATE: Missing Error Handling in Cognito Auth Callback

**Location**: `server/cognito-auth.ts` (lines 113-128)

**Issue**: Session save error handling redirects to a JSON response but the client might expect a redirect during the OAuth flow.

**Impact**: Users might see raw JSON error instead of a proper error page during SSO failures.

**Fix Required**: Redirect to an error page instead of returning JSON during OAuth flow errors.

## 5. WARNING: Potential Session Race Condition

**Location**: `server/auth.ts` (lines 185-188)

**Issue**: The `req.login()` callback is not properly awaited, which could lead to the response being sent before the session is fully established.

**Impact**: In rare cases, the user might appear logged in on the client but the session isn't fully saved on the server.

**Fix Required**: Promisify req.login or ensure proper session handling.

## 6. MINOR: Inefficient Question Status Calculation

**Location**: `client/src/components/question-navigation.tsx` (lines 30-38)

**Issue**: The questionStatuses array is recalculated on every render without memoization, potentially causing performance issues with large question sets.

**Impact**: Unnecessary re-renders and calculations, especially with 100+ questions.

**Fix Required**: Use useMemo to memoize the calculation.

## 7. WARNING: Missing Await in Bulk Import Operations

**Location**: `server/routes.ts` (lines 2095-2098)

**Issue**: The `storage.importQuestions` and `storage.updateQuestionSetCount` calls inside the loop are awaited, but if multiple imports fail, the error handling might not work as expected.

**Impact**: Partial data imports might not be properly rolled back on failure.

**Fix Required**: Consider implementing transaction support for bulk operations.

## 8. MINOR: Stale Closure Risk in Active Streams Cleanup

**Location**: `server/routes.ts` (lines 185-197)

**Issue**: The setInterval cleanup function for activeStreams might reference stale data if the Map is modified during iteration.

**Impact**: Memory leaks if streams aren't properly cleaned up.

**Fix Required**: Use proper iteration with defensive copying.

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

## Summary

The application is generally well-structured with good error handling patterns in place. Most issues found are minor to moderate and relate to:
- Memory management in React hooks
- Race conditions in async operations
- Session handling edge cases
- Performance optimizations

**Critical Issues**: 1 (Performance monitoring accuracy)
**Moderate Issues**: 3 (Race conditions, session handling)
**Minor Issues**: 5 (Performance, memory leaks)

## Recommendations

1. **Immediate**: Fix the usePerformanceMonitor hook dependency array
2. **High Priority**: Address race conditions in streaming and session handling
3. **Medium Priority**: Add memoization for expensive calculations
4. **Low Priority**: Improve CSP configuration and optimize database queries

The application appears stable for production use, but addressing these issues will improve reliability and performance, especially under high load conditions.