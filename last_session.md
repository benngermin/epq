# SSE Streaming Issue - Session Summary

**Date:** October 16, 2025
**Status:** 🔴 UNRESOLVED - Client fetch hangs indefinitely
**Repository:** https://github.com/benngermin/epq.git
**Branch:** main
**Last Commit:** c03af7b - "Ensure server sends initial messages immediately to the client"

---

## 🎯 Core Issue

**Symptom:** When a user answers a question incorrectly, the AI chatbot interface displays a loading animation indefinitely with no response ever appearing.

**Root Cause:** Client-side `fetch()` request to `/api/chatbot/stream-sse` hangs and never resolves. The fetch promise never completes, preventing the ReadableStream from being established.

---

## 📊 Current Behavior

### Client Side (Browser Console Logs)
```
[SSE Hook] startStream called with: {questionVersionId: 18198, chosenAnswer: 'A', userMessage: undefined}
[SSE Hook] Fetching SSE endpoint: /api/chatbot/stream-sse
[...hangs here indefinitely - no further logs...]
```

**Expected but missing logs:**
- `[SSE Hook] Response received:` ❌ Never appears
- `[SSE Hook] Reader obtained` ❌ Never appears
- `[SSE Hook] Reading chunk` ❌ Never appears

### Server Side (Server Console Logs)
```
[streamOpenRouterDirectly] Function called with messages count: 2
[streamOpenRouterDirectly] Response status: 200 true
[streamOpenRouterDirectly] Sending SSE chunk to client: data: {"type":"chunk","content":"..."}
[...hundreds of successful chunks sent...]
```

**Server is working correctly:**
- ✅ Receives request from client
- ✅ Connects to OpenRouter API
- ✅ Receives streaming chunks from OpenRouter
- ✅ Formats and sends SSE messages: `data: {"type":"chunk","content":"..."}\n\n`
- ✅ Flushes after each chunk

---

## 🔧 Fixes Already Attempted

### Fix #1: Content Format (APPLIED ✅)
**Issue:** Server was sending incremental delta chunks instead of accumulated response
**Location:** `server/routes.ts:2321`
**Change:**
```typescript
// Before
content: content  // Only delta chunk

// After
content: fullResponse  // Accumulated response
```
**Result:** Did not resolve the hanging issue

### Fix #2: Response Streaming (APPLIED ✅)
**Issue:** Missing reader null check
**Location:** `server/routes.ts:2258-2263`
**Change:** Added null check for `response.body?.getReader()`
**Result:** Did not resolve the hanging issue

### Fix #3: Initial Flush (APPLIED ✅)
**Issue:** Initial "connected" message not flushed
**Location:** `server/routes.ts:1903-1908`
**Change:**
```typescript
res.write('data: {"type":"connected"}\n\n');
// Added flush immediately
if ((res as any).flush) {
  (res as any).flush();
}
```
**Result:** Did not resolve the hanging issue

---

## 🔍 Technical Analysis

### The Disconnect
1. **Server perspective:** Everything works perfectly
   - Receives POST to `/api/chatbot/stream-sse`
   - Processes request through `requireAuth` and `aiRateLimiter` middleware
   - Calls `streamOpenRouterDirectly()` function
   - Successfully streams content from OpenRouter
   - Sends formatted SSE chunks: `data: {"type":"chunk","content":"..."}\n\n`
   - Flushes after each write

2. **Client perspective:** Complete failure
   - Initiates fetch to `/api/chatbot/stream-sse`
   - Fetch promise never resolves
   - No response object received
   - No error thrown
   - Request appears to hang indefinitely in "pending" state

### Probable Root Causes

#### Theory #1: Middleware Blocking (MOST LIKELY)
The `requireAuth` or `aiRateLimiter` middleware may be preventing the response from reaching the client, even though server logs show the handler executes.

**Evidence:**
- Request reaches the endpoint handler (server logs confirm)
- Client never receives response (no response object in client logs)
- No errors on either side

**Files to investigate:**
- `server/middleware/admin.ts` (requireAuth)
- `server/middleware/rate-limiter.ts` (aiRateLimiter)

#### Theory #2: Response Headers Issue
SSE-specific headers may not be set correctly or may be overridden by middleware.

**Current headers (line 1898-1901):**
```typescript
res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache, no-transform');
res.setHeader('Connection', 'keep-alive');
res.setHeader('X-Accel-Buffering', 'no');
```

**Potential issue:** Headers might be set after the response has already been committed by middleware.

#### Theory #3: CORS or Proxy Issue
The request may be blocked at the network layer by CORS policy or reverse proxy configuration.

**To check:**
- Browser Network tab for CORS errors
- Response headers in Network tab
- Proxy configuration (if behind Replit proxy)

#### Theory #4: Response Not Properly Initialized
The Express response stream may not be properly initialized for SSE before writing.

**Solution to try:** Explicitly set status code before headers:
```typescript
res.status(200); // Add this line
res.setHeader('Content-Type', 'text/event-stream');
// ... rest of headers
```

---

## 🧪 Diagnostic Steps for Next Session

### Step 1: Add Pre-Handler Logging
In `server/routes.ts` at line 1892, before the handler:
```typescript
app.post("/api/chatbot/stream-sse",
  (req, res, next) => {
    console.log('[SSE MIDDLEWARE] Request received, passing to requireAuth');
    next();
  },
  requireAuth,
  (req, res, next) => {
    console.log('[SSE MIDDLEWARE] Passed requireAuth, passing to aiRateLimiter');
    next();
  },
  aiRateLimiter.middleware(),
  (req, res, next) => {
    console.log('[SSE MIDDLEWARE] Passed aiRateLimiter, entering handler');
    next();
  },
  async (req, res) => {
    console.log('[SSE HANDLER] Handler started');
    // ... existing handler code
```

### Step 2: Test Direct Response
Temporarily replace the handler with a simple response:
```typescript
app.post("/api/chatbot/stream-sse", requireAuth, aiRateLimiter.middleware(), async (req, res) => {
  console.log('[SSE TEST] Sending immediate test response');
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.write('data: {"type":"test","message":"immediate response"}\n\n');
  res.end();
});
```

**Expected:** If this works, the issue is in the streaming logic. If not, it's middleware or network.

### Step 3: Check Network Tab
In browser DevTools Network tab:
- Look for the `/api/chatbot/stream-sse` request
- Check the Status (should be 200)
- Check Response Headers (should include `content-type: text/event-stream`)
- Check if request is "pending" forever or actually fails
- Look for CORS errors in Console

### Step 4: Bypass Authentication
Temporarily test without auth to isolate middleware:
```typescript
// Temporarily remove requireAuth
app.post("/api/chatbot/stream-sse", aiRateLimiter.middleware(), async (req, res) => {
  // ... handler code
```

---

## 📁 Key Files

### Client Side
- **SSE Hook:** `client/src/hooks/use-sse-stream.ts`
  - Lines 43-55: Fetch initiation
  - Lines 71-73: Reader initialization
  - Lines 79-117: Stream reading loop

- **Chat Component:** `client/src/components/simple-streaming-chat.tsx`
  - Lines 49-92: useSSEStream hook initialization with callbacks
  - Lines 159-164: startStream invocation

### Server Side
- **Routes:** `server/routes.ts`
  - Lines 1892-1945: POST `/api/chatbot/stream-sse` endpoint
  - Lines 2170-2289: `streamOpenRouterDirectly()` function
  - Lines 2315-2328: Chunk sending logic with flush

- **Middleware:**
  - `server/middleware/admin.ts` - requireAuth implementation
  - `server/middleware/rate-limiter.ts` - aiRateLimiter implementation

---

## 🚨 Critical Observations

1. **Server logs show complete success** - All chunks processed and sent
2. **Client never receives initial response** - Fetch promise never resolves
3. **No errors on either side** - Silent failure mode
4. **All three attempted fixes failed** - Content format, null checks, and flush
5. **Issue appears to be at the transport layer** - Between server write and client receive

---

## ✅ Next Actions

### Immediate
1. Add comprehensive middleware logging to trace request flow
2. Check browser Network tab for actual HTTP response details
3. Test with simplified handler (immediate response, no streaming)
4. Verify SSE headers are reaching the client

### If Middleware Issue
- Investigate `requireAuth` and `aiRateLimiter` implementations
- Check if they properly support streaming responses
- Verify they don't buffer or transform the response

### If Network/Proxy Issue
- Check Replit proxy configuration
- Test locally without proxy
- Verify CORS headers for SSE requests

### If Headers Issue
- Set response status explicitly before headers
- Try different header combinations
- Check Express SSE examples for proper initialization

---

## 📌 Working Code Reference

The server-side streaming implementation IS working correctly. The issue is purely about the response reaching the client.

**Confirmed working:**
- OpenRouter API integration ✅
- Chunk processing and formatting ✅
- SSE message formatting ✅
- Flush after each write ✅

**Not working:**
- Client receiving the response ❌
- Fetch promise resolving ❌
- ReadableStream being established ❌

---

## 🔗 References

- **OpenRouter Streaming:** https://openrouter.ai/docs#streaming
- **SSE Specification:** https://html.spec.whatwg.org/multipage/server-sent-events.html
- **Express Streaming:** https://expressjs.com/en/api.html#res.write
- **Fetch API Streams:** https://developer.mozilla.org/en-US/docs/Web/API/Streams_API

---

## 💡 Alternative Approaches

If SSE continues to fail, consider:

1. **WebSocket fallback** - More reliable for bidirectional streaming
2. **Polling with long timeout** - Original approach that worked
3. **Chunked transfer encoding** - Different streaming approach
4. **Cloud function proxy** - External service to handle streaming

---

**Last Updated:** October 16, 2025, 3:30 PM
**Session ID:** SSE-Debug-Session-2
**Priority:** HIGH - Blocking production feature
