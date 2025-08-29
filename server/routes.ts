import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { z } from "zod";
import { 
  insertCourseSchema, insertQuestionSetSchema, insertAiSettingsSchema,
  insertPromptVersionSchema, questionImportSchema, insertUserAnswerSchema, courseMaterials, type QuestionImport,
  promptVersions, questionSets, courses, questions, questionVersions
} from "@shared/schema";
import { db } from "./db";
import { withRetry } from "./utils/db-retry";
import { withCircuitBreaker } from "./utils/connection-pool";
import { eq, sql, desc, asc, inArray } from "drizzle-orm";
import { batchFetchQuestionsWithVersions } from "./utils/batch-queries";
import { getDebugStatus } from "./debug-status";
import { handleDatabaseError } from "./utils/error-handler";
import { getTodayEST } from "./utils/logger";
import { generalRateLimiter, authRateLimiter, aiRateLimiter } from "./middleware/rate-limiter";

// Custom error class for HTTP errors
class HttpError extends Error {
  status: number;
  
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'HttpError';
  }
}

// Type assertion helper for authenticated requests
function assertAuthenticated(req: Request): asserts req is Request & { user: NonNullable<Express.User> } {
  if (!req.isAuthenticated() || !req.user) {
    throw new HttpError('Authentication required', 401);
  }
}

// OpenRouter integration
async function callOpenRouter(prompt: string, settings: any, userId?: number, systemMessage?: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    return "I'm sorry, but the AI assistant is not configured. Please contact your administrator to set up the OpenRouter API key.";
  }

  const startTime = Date.now();
  const modelName = settings?.modelName || "anthropic/claude-3.5-sonnet";
  const temperature = 0; // Always use deterministic output
  
  // Set max tokens to 32000 for all models as requested
  let maxTokens = 32000; // Use 32000 tokens for all API calls

  try {
    const messages = [];
    if (systemMessage) {
      messages.push({ role: "system", content: systemMessage });
    }
    messages.push({ role: "user", content: prompt });

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.REPLIT_DOMAINS?.split(',')[0] || process.env.APP_URL || "http://localhost:5000",
      },
      body: JSON.stringify({
        model: modelName,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Removed OpenRouter error logging
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      return "I'm sorry, I received an unexpected response from the AI service.";
    }
    
    const aiResponse = data.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";
    const responseTime = Date.now() - startTime;

    // Log the interaction
    try {
      await storage.createChatbotLog({
        userId,
        modelName,
        systemMessage,
        userMessage: prompt,
        aiResponse,
        temperature: 0, // Always deterministic
        maxTokens,
        responseTime,
      });
    } catch (logError) {
      // Removed chatbot interaction logging
    }
    
    return aiResponse;
  } catch (error) {
    const errorResponse = "I'm sorry, there was an error connecting to the AI service. Please try again later.";
    
    // Log the error interaction
    try {
      await storage.createChatbotLog({
        userId,
        modelName,
        systemMessage,
        userMessage: prompt,
        aiResponse: errorResponse,
        temperature: 0,
        maxTokens,
        responseTime: Date.now() - startTime,
      });
    } catch (logError) {
      // Removed chatbot error logging
    }
    
    return errorResponse;
  }
}

// In-memory store for active streams - declare at module level
const activeStreams = new Map<string, { 
  chunks: string[], 
  done: boolean, 
  error?: string,
  lastActivity: number,
  aborted?: boolean,
  conversationHistory?: Array<{ role: string, content: string }> // Store conversation history
}>();

// Heartbeat interval to detect stalled streams
const STREAM_HEARTBEAT_INTERVAL = 30000; // 30 seconds
const STREAM_TIMEOUT = 120000; // 2 minutes

// Store interval IDs for cleanup
let streamHeartbeatInterval: NodeJS.Timeout;
let streamCleanupInterval: NodeJS.Timeout;

// Start heartbeat monitor for streams
streamHeartbeatInterval = setInterval(() => {
  const now = Date.now();
  // Create a copy of the entries to avoid modification during iteration
  const streamEntries = Array.from(activeStreams.entries());
  
  streamEntries.forEach(([streamId, stream]) => {
    if (!stream.done && !stream.aborted && (now - stream.lastActivity) > STREAM_TIMEOUT) {
      // Stream timeout - marking as done
      stream.error = "Stream timed out. Please try again.";
      stream.done = true;
    }
  });
}, STREAM_HEARTBEAT_INTERVAL);

// Track streams being cleaned up to prevent race conditions
const cleaningStreams = new Set<string>();

// Cleanup function to prevent memory leaks
function cleanupStream(streamId: string) {
  // Prevent concurrent cleanup of the same stream
  if (cleaningStreams.has(streamId)) {
    return;
  }
  
  cleaningStreams.add(streamId);
  
  try {
    const stream = activeStreams.get(streamId);
    if (stream) {
      // Clear large data first
      stream.chunks = [];
      // Clear error stream data to prevent memory leak
      if (stream.error) {
        stream.error = undefined;
      }
      // Then delete the stream
      activeStreams.delete(streamId);
    }
  } catch (error) {
    console.error('Error cleaning up stream:', error);
    // Force delete even if there was an error
    activeStreams.delete(streamId);
  } finally {
    cleaningStreams.delete(streamId);
  }
}

// Clean up old streams periodically to prevent memory buildup
streamCleanupInterval = setInterval(() => {
  const now = Date.now();
  const oldStreamAge = 5 * 60 * 1000; // 5 minutes (reduced from 10)
  const staleStreamAge = 10 * 60 * 1000; // 10 minutes for stale streams
  
  // Create a copy of the stream IDs to avoid modification during iteration
  const streamIds = Array.from(activeStreams.keys());
  
  streamIds.forEach((streamId) => {
    const stream = activeStreams.get(streamId);
    if (!stream) return; // Stream may have been deleted already
    
    // Clean up completed/aborted streams after 5 minutes
    if ((stream.done || stream.aborted) && (now - stream.lastActivity) > oldStreamAge) {
      cleanupStream(streamId);
    }
    // Force clean up any stream older than 10 minutes regardless of state
    else if ((now - stream.lastActivity) > staleStreamAge) {
      // Force cleaning stale stream
      stream.done = true;
      stream.error = "Stream expired";
      cleanupStream(streamId);
    }
  });
  
  // Also log current stream count for monitoring
  if (activeStreams.size > 10) {
    // High number of active streams
  }
}, 60000); // Run every minute

// Cleanup intervals on process termination
let shutdownInProgress = false;

const shutdownCleanup = () => {
  if (shutdownInProgress) return;
  shutdownInProgress = true;
  
  if (streamHeartbeatInterval) clearInterval(streamHeartbeatInterval);
  if (streamCleanupInterval) clearInterval(streamCleanupInterval);
  
  // Clear all active streams
  activeStreams.forEach((stream, streamId) => {
    stream.done = true;
    stream.error = 'Server shutting down';
  });
  activeStreams.clear();
  cleaningStreams.clear();
};

process.on('SIGINT', shutdownCleanup);
process.on('SIGTERM', shutdownCleanup);
process.on('exit', shutdownCleanup);

// Streaming OpenRouter integration for buffer approach
async function streamOpenRouterToBuffer(
  prompt: string, 
  settings: any, 
  streamId: string, 
  userId?: number, 
  systemMessage?: string,
  conversationHistory?: Array<{ role: string, content: string }>
) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  const stream = activeStreams.get(streamId);
  if (!stream) {
    return;
  }
  
  if (!apiKey) {
    stream.error = "I'm sorry, but the AI assistant is not configured. Please contact your administrator to set up the OpenRouter API key.";
    stream.done = true;
    return;
  }

  const startTime = Date.now();
  const modelName = settings?.modelName || "anthropic/claude-3.5-sonnet";
  const temperature = 0;
  
  // Set max tokens to 32000 for all models as requested
  let maxTokens = 32000; // Use 32000 tokens for all API calls

  try {
    let messages = [];
    
    // If we have conversation history, use it instead of creating a new conversation
    if (conversationHistory && conversationHistory.length > 0) {
      messages = [...conversationHistory];
      // Add the new user message to the existing conversation
      messages.push({ role: "user", content: prompt });
    } else {
      // Initial conversation - use system message if provided
      if (systemMessage) {
        messages.push({ role: "system", content: systemMessage });
      }
      messages.push({ role: "user", content: prompt });
    }

    // Log the complete API request for debugging
    // OpenRouter API call
    console.log('Timestamp:', new Date().toISOString());
    console.log('Model:', modelName);
    console.log('Temperature:', temperature);
    console.log('Max Tokens:', maxTokens);
    console.log('Messages being sent:');
    messages.forEach((msg, index) => {
      console.log(`Message ${index + 1} (${msg.role}):`);
      console.log('Content length:', msg.content.length, 'characters');
      console.log('Full content:', msg.content);
    });
    console.log('=========================\n');

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.REPLIT_DOMAINS?.split(',')[0] || process.env.APP_URL || "http://localhost:5000",
      },
      body: JSON.stringify({
        model: modelName,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // OpenRouter API error
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    let fullResponse = "";
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error("No response stream available");
    }

    let buffer = '';
    let isDone = false;
    const streamStartTime = Date.now();
    const STREAM_MAX_DURATION = 60000; // 60 seconds max for a single stream
    
    try {
      while (true) {
        // Check if stream was aborted
        if (stream.aborted) {
          await reader.cancel();
          break;
        }
        
        // Check if stream has been running too long
        if (Date.now() - streamStartTime > STREAM_MAX_DURATION) {
          // Stream exceeded max duration
          stream.error = "Response took too long. Please try again.";
          await reader.cancel();
          break;
        }

        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }
      
      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;
      
      // Process complete lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (line.trim() === '') continue;
        
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          
          if (data === '[DONE]') {
            isDone = true;
            break;
          }
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            
            if (content && typeof content === 'string') {
              fullResponse += content;
              // Store accumulated content, not individual chunks
              stream.chunks = [fullResponse];
              stream.lastActivity = Date.now(); // Update activity timestamp
            }
            
            // Check for finish reason which might indicate premature end
            const finishReason = parsed.choices?.[0]?.finish_reason;
            if (finishReason) {
              if (finishReason === 'length') {
                // Stream hit max token limit
              }
              // Mark as done when we receive a finish reason
              isDone = true;
              break;
            }
          } catch (e) {
            // Log parsing errors for debugging
            if (data && data !== '') {
              // Failed to parse streaming chunk
            }
          }
        }
      }
      
      if (isDone) {
        break;
      }
    }
    
    // Process any remaining data in buffer
    if (buffer.trim() && buffer.startsWith('data: ')) {
      const data = buffer.slice(6).trim();
      if (data && data !== '[DONE]') {
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content && typeof content === 'string') {
            fullResponse += content;
            stream.chunks = [fullResponse];
          }
        } catch (e) {
          console.warn(`Failed to parse final buffer: ${(e as Error).message}`);
        }
      }
    }
    } catch (error) {
      // Stream processing error
      stream.error = error instanceof Error ? error.message : 'Stream processing failed';
      throw error;
    } finally {
      // Always cancel the reader to free resources
      try {
        await reader.cancel();
      } catch (e) {
        // Ignore errors when canceling an already closed reader
      }
    }

    const responseTime = Date.now() - startTime;
    
    // Stream completion details removed

    // Log the complete interaction
    try {
      await storage.createChatbotLog({
        userId,
        modelName,
        systemMessage,
        userMessage: prompt,
        aiResponse: fullResponse,
        temperature: 0,
        maxTokens,
        responseTime,
      });
    } catch (logError) {
      // Removed chatbot interaction logging
    }
    
    // Mark stream as done after successful completion
    stream.done = true;
    stream.chunks = [fullResponse]; // Ensure final content is set

  } catch (error) {
    // OpenRouter streaming error
    const errorResponse = "I'm sorry, there was an error connecting to the AI service. Please try again later.";
    
    stream.error = errorResponse;
    stream.done = true;
    
    // Log the error interaction
    try {
      await storage.createChatbotLog({
        userId,
        modelName,
        systemMessage,
        userMessage: prompt,
        aiResponse: errorResponse,
        temperature: 0,
        maxTokens,
        responseTime: Date.now() - startTime,
      });
    } catch (logError) {
      // Removed chatbot error logging
    }
  }

  
  // Don't set individual cleanup timeout - let the global cleanup handle it
  // This prevents double cleanup and timing conflicts
}

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Middleware to check admin access
  const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    // Only allow users with admin flag (demo user restricted in production)
    if (!req.user.isAdmin || (process.env.NODE_ENV === "production" && req.user.email === "demo@example.com")) {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  };

  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated() || !req.user) {
      // Only log errors for non-user endpoint requests to reduce noise
      if (req.path !== '/api/user') {
        console.error(`Authentication failed for ${req.method} ${req.path}:`, {
          isAuthenticated: req.isAuthenticated(),
          hasUser: !!req.user,
          isChatbotEndpoint: req.path.includes('/chatbot')
        });
      }
      return res.status(401).json({ message: "Authentication required" });
    }
    next();
  };

  // Course routes
  app.get("/api/courses", requireAuth, async (req, res) => {
    try {
      const allCourses = await storage.getAllCourses();
      
      // Return all courses without deduplication since we now use mapping table
      const uniqueCourses = allCourses.filter(course => {
        // Special case: Show Test Course only to benn@modia.ai
        if (course.courseNumber === 'Test Course') {
          return req.user?.email === 'benn@modia.ai';
        }
        
        // Filter out test/invalid courses that don't follow CPCU or AIC naming pattern
        const hasStandardName = course.courseNumber.match(/^(CPCU|AIC)\s+\d+/) || 
                               (course.externalId && course.externalId.match(/(CPCU|AIC)\s+\d+/));
        return hasStandardName;
      });
      
      const coursesWithProgress = await Promise.all(
        uniqueCourses.map(async (course) => {
          // Get question sets for this course
          const questionSets = await storage.getQuestionSetsByCourse(course.id);
          const questionSetsWithCounts = await Promise.all(
            questionSets.map(async (questionSet) => {
              const questions = await storage.getQuestionsByQuestionSet(questionSet.id);
              return {
                ...questionSet,
                questionCount: questions.length,
              };
            })
          );

          // Calculate progress based on course completion
          const courseProgress = await storage.getUserCourseProgress(req.user!.id, course.id);
          const progressPercentage = courseProgress.totalAnswers > 0 
            ? Math.round((courseProgress.correctAnswers / courseProgress.totalAnswers) * 100)
            : 0;

          return {
            ...course,
            progress: progressPercentage,
            questionSets: questionSetsWithCounts,
          };
        })
      );
      
      // Sort courses to show those with question sets first, then by course number
      coursesWithProgress.sort((a, b) => {
        // First priority: courses with question sets
        const aHasQuestionSets = a.questionSets && a.questionSets.length > 0;
        const bHasQuestionSets = b.questionSets && b.questionSets.length > 0;
        
        if (aHasQuestionSets && !bHasQuestionSets) return -1;
        if (!aHasQuestionSets && bHasQuestionSets) return 1;
        
        // Second priority: alphabetical by course number
        return a.courseNumber.localeCompare(b.courseNumber);
      });
      
      res.json(coursesWithProgress);
    } catch (error) {
      console.error("Error fetching courses:", error);
      res.status(500).json({ message: "Failed to fetch courses" });
    }
  });

  app.get("/api/courses/with-question-sets", requireAuth, async (req, res) => {
    try {
      const courses = await storage.getCoursesWithQuestionSets();
      res.json(courses);
    } catch (error) {
      console.error("Error fetching courses with question sets:", error);
      res.status(500).json({ message: "Failed to fetch courses with question sets" });
    }
  });

  app.get("/api/courses/by-external-id/:externalId", requireAuth, async (req, res) => {
    try {
      const { externalId } = req.params;
      
      // Validate external ID format - should be alphanumeric and not too long
      if (!externalId || externalId.length > 100 || !/^[a-zA-Z0-9_\-\s]+$/.test(externalId)) {
        return res.status(400).json({ message: "Invalid external ID format" });
      }
      
      // Sanitize the external ID to prevent injection attacks
      const sanitizedExternalId = externalId.trim();
      
      
      const course = await storage.getCourseByExternalId(sanitizedExternalId);
      
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }
      
      res.json(course);
    } catch (error) {
      console.error("Error fetching course by external ID:", error);
      res.status(500).json({ message: "Failed to fetch course" });
    }
  });

  app.get("/api/courses/:id", requireAuth, async (req, res) => {
    try {
      const courseId = parseInt(req.params.id);
      
      if (isNaN(courseId)) {
        return res.status(400).json({ message: "Invalid course ID" });
      }
      
      const course = await storage.getCourse(courseId);
      
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }
      
      res.json(course);
    } catch (error) {
      console.error("Error fetching course:", error);
      res.status(500).json({ message: "Failed to fetch course" });
    }
  });

  app.post("/api/courses", requireAdmin, async (req, res) => {
    try {
      const courseData = insertCourseSchema.parse(req.body);
      const course = await storage.createCourse(courseData);
      res.status(201).json(course);
    } catch (error) {
      console.error("Error creating course:", error);
      res.status(400).json({ message: "Invalid course data" });
    }
  });

  app.put("/api/courses/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const courseData = insertCourseSchema.partial().parse(req.body);
      const course = await storage.updateCourse(id, courseData);
      
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }
      
      res.json(course);
    } catch (error) {
      console.error("Error updating course:", error);
      res.status(400).json({ message: "Invalid course data" });
    }
  });

  app.delete("/api/courses/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteCourse(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Course not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting course:", error);
      res.status(500).json({ message: "Failed to delete course" });
    }
  });

  // Bulk insert courses with external IDs
  app.post("/api/admin/courses/bulk", requireAdmin, async (req, res) => {
    try {
      const coursesData = z.array(z.object({
        courseNumber: z.string(),
        courseTitle: z.string(),
        externalId: z.string()
      })).parse(req.body);
      
      const results = [];
      for (const courseData of coursesData) {
        try {
          // Check if course with external ID already exists
          const existing = await storage.getCourseByExternalId(courseData.externalId);
          if (existing) {
            results.push({ ...existing, status: 'exists' });
          } else {
            const newCourse = await storage.createCourse({
              courseNumber: courseData.courseNumber,
              courseTitle: courseData.courseTitle,
              externalId: courseData.externalId
            });
            results.push({ ...newCourse, status: 'created' });
          }
        } catch (error) {
          results.push({ courseNumber: courseData.courseNumber, courseTitle: courseData.courseTitle, externalId: courseData.externalId, status: 'error', error: String(error) });
        }
      }
      
      res.json(results);
    } catch (error) {
      console.error("Error bulk inserting courses:", error);
      res.status(400).json({ message: "Invalid course data" });
    }
  });

  // Question set routes
  app.get("/api/admin/question-sets", requireAdmin, async (req, res) => {
    try {
      // Get all courses first to include course information
      const courses = await storage.getAllCourses();
      const courseMap = new Map(courses.map(course => [course.id, course]));
      
      // Get all question sets from all courses
      const allQuestionSets = [];
      for (const course of courses) {
        const questionSets = await storage.getQuestionSetsByCourse(course.id);
        allQuestionSets.push(...questionSets);
      }
      
      // Get question count and course info for each question set
      const questionSetsWithDetails = await Promise.all(
        allQuestionSets.map(async (questionSet) => {
          const questions = await storage.getQuestionsByQuestionSet(questionSet.id);
          const course = courseMap.get(questionSet.courseId);
          return {
            ...questionSet,
            questionCount: questions.length,
            course: course
          };
        })
      );
      
      // Sort question sets by title (extracting numbers for proper numerical sorting)
      questionSetsWithDetails.sort((a, b) => {
        const aNum = parseInt(a.title.match(/\d+/)?.[0] || '0');
        const bNum = parseInt(b.title.match(/\d+/)?.[0] || '0');
        return aNum - bNum;
      });
      
      res.json(questionSetsWithDetails);
    } catch (error) {
      console.error("Error fetching all question sets:", error);
      res.status(500).json({ message: "Failed to fetch question sets" });
    }
  });

  app.get("/api/admin/question-sets/:courseId", requireAdmin, async (req, res) => {
    try {
      const courseId = parseInt(req.params.courseId);
      const questionSets = await storage.getQuestionSetsByCourse(courseId);
      
      // Get question count for each question set
      const questionSetsWithCounts = await Promise.all(
        questionSets.map(async (questionSet) => {
          const questions = await storage.getQuestionsByQuestionSet(questionSet.id);
          return {
            ...questionSet,
            questionCount: questions.length
          };
        })
      );
      
      // Sort question sets by title (extracting numbers for proper numerical sorting)
      questionSetsWithCounts.sort((a, b) => {
        const aNum = parseInt(a.title.match(/\d+/)?.[0] || '0');
        const bNum = parseInt(b.title.match(/\d+/)?.[0] || '0');
        return aNum - bNum;
      });
      
      res.json(questionSetsWithCounts);
    } catch (error) {
      console.error("Error fetching question sets:", error);
      res.status(500).json({ message: "Failed to fetch question sets" });
    }
  });

  app.post("/api/admin/question-sets", requireAdmin, async (req, res) => {
    try {
      const questionSetData = insertQuestionSetSchema.parse(req.body);
      const questionSet = await storage.createQuestionSet(questionSetData);
      res.status(201).json(questionSet);
    } catch (error) {
      console.error("Error creating question set:", error);
      res.status(400).json({ message: "Invalid question set data" });
    }
  });

  app.put("/api/admin/question-sets/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const questionSetData = insertQuestionSetSchema.partial().parse(req.body);
      const questionSet = await storage.updateQuestionSet(id, questionSetData);
      
      if (!questionSet) {
        return res.status(404).json({ message: "Question set not found" });
      }
      
      res.json(questionSet);
    } catch (error) {
      console.error("Error updating question set:", error);
      res.status(400).json({ message: "Invalid question set data" });
    }
  });

  app.delete("/api/admin/question-sets/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteQuestionSet(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Question set not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting question set:", error);
      res.status(500).json({ message: "Failed to delete question set" });
    }
  });

  // Import questions to a question set
  app.post("/api/admin/question-sets/:id/import-questions", requireAdmin, async (req, res) => {
    try {
      const questionSetId = parseInt(req.params.id);
      
      if (isNaN(questionSetId)) {
        return res.status(400).json({ message: "Invalid question set ID" });
      }
      
      // Check if question set exists
      const questionSet = await storage.getQuestionSet(questionSetId);
      if (!questionSet) {
        return res.status(404).json({ message: "Question set not found" });
      }
      
      const questionsData = req.body;
      if (!Array.isArray(questionsData)) {
        return res.status(400).json({ message: "Data must be an array of questions" });
      }
      
      let importedCount = 0;
      const errors = [];
      
      for (const questionData of questionsData) {
        try {
          // Validate the question data structure
          if (!questionData.question_number || !questionData.loid || !questionData.versions || !Array.isArray(questionData.versions)) {
            errors.push(`Invalid question structure at index ${questionsData.indexOf(questionData)}`);
            continue;
          }
          
          // Create the question
          const question = await storage.createQuestion({
            questionSetId,
            originalQuestionNumber: questionData.question_number,
            loid: questionData.loid,
          });
          
          // Create versions for the question
          for (const versionData of questionData.versions) {
            await storage.createQuestionVersion({
              questionId: question.id,
              versionNumber: versionData.version_number || 1,
              topicFocus: versionData.topic_focus || '',
              questionText: versionData.question_text || '',
              questionType: versionData.question_type || questionData.type || 'multiple_choice',
              answerChoices: versionData.answer_choices || [],
              correctAnswer: versionData.correct_answer || '',
              acceptableAnswers: versionData.acceptable_answers,
              caseSensitive: versionData.case_sensitive,
              allowMultiple: versionData.allow_multiple,
              matchingPairs: versionData.matching_pairs,
              correctOrder: versionData.correct_order,
              blanks: versionData.blanks,
              dropZones: versionData.drop_zones,
            });
          }
          
          importedCount++;
        } catch (error) {
          console.error(`Error importing question ${questionData.question_number}:`, error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push(`Failed to import question ${questionData.question_number}: ${errorMessage}`);
        }
      }
      
      // Update question count for the question set
      await storage.updateQuestionSetCount(questionSetId);
      
      res.json({
        message: `Successfully imported ${importedCount} out of ${questionsData.length} questions`,
        importedCount,
        totalCount: questionsData.length,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error) {
      console.error("Error importing questions:", error);
      res.status(500).json({ message: "Failed to import questions" });
    }
  });

  // Public endpoint for getting question sets by course ID
  app.get("/api/courses/:courseId/question-sets", requireAuth, async (req, res) => {
    try {
      const courseId = parseInt(req.params.courseId);
      
      if (isNaN(courseId)) {
        return res.status(400).json({ message: "Invalid course ID" });
      }
      
      const questionSets = await storage.getQuestionSetsByCourse(courseId);
      
      // Sort question sets by title (extracting numbers for proper numerical sorting)
      questionSets.sort((a, b) => {
        const aNum = parseInt(a.title.match(/\d+/)?.[0] || '0');
        const bNum = parseInt(b.title.match(/\d+/)?.[0] || '0');
        return aNum - bNum;
      });
      
      res.json(questionSets);
    } catch (error) {
      console.error("Error fetching question sets:", error);
      res.status(500).json({ message: "Failed to fetch question sets" });
    }
  });

  // Question set practice routes
  app.get("/api/question-sets/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user!.id;
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid question set ID" });
      }
      
      const questionSet = await withCircuitBreaker(() => storage.getQuestionSet(id));
      
      if (!questionSet) {
        return res.status(404).json({ message: "Question set not found" });
      }
      
      // User is viewing this question set
      
      // Update daily activity to track unique users
      const today = getTodayEST();
      
      // Note: We're not creating a test run here yet - that happens on first answer
      // This just tracks that the user viewed the question set
      
      res.json(questionSet);
    } catch (error) {
      console.error("Error fetching question set:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('Circuit breaker is OPEN')) {
        res.status(503).json({ message: "Database temporarily unavailable. Please try again in a moment." });
      } else {
        res.status(500).json({ message: "Failed to fetch question set" });
      }
    }
  });

  // Handle optimized endpoint by redirecting to regular endpoints
  app.get("/api/question-sets/:id/optimized", requireAuth, async (req, res) => {
    const questionSetId = parseInt(req.params.id);
    
    try {
      // Get the data using the same logic as the practice-data endpoint
      const [questionSet, questions] = await Promise.all([
        withCircuitBreaker(() => storage.getQuestionSet(questionSetId)),
        withCircuitBreaker(() => batchFetchQuestionsWithVersions(questionSetId))
      ]);
      
      if (!questionSet) {
        return res.status(404).json({ message: "Question set not found" });
      }
      
      // Get course and question sets info
      const [course, courseQuestionSets] = await Promise.all([
        withCircuitBreaker(() => storage.getCourse(questionSet.courseId)),
        withCircuitBreaker(() => storage.getQuestionSetsByCourse(questionSet.courseId))
      ]);
      
      // Sort question sets
      courseQuestionSets.sort((a, b) => {
        const aNum = parseInt(a.title.match(/\d+/)?.[0] || '0');
        const bNum = parseInt(b.title.match(/\d+/)?.[0] || '0');
        return aNum - bNum;
      });
      
      // Return combined data matching the expected format
      res.json({ questionSet, questions, course, courseQuestionSets });
    } catch (error) {
      console.error("Error in optimized endpoint:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('Circuit breaker is OPEN')) {
        res.status(503).json({ message: "Database temporarily unavailable. Please try again in a moment." });
      } else {
        res.status(500).json({ message: "Failed to load practice data" });
      }
    }
  });

  app.get("/api/questions/:questionSetId", requireAuth, async (req, res) => {
    try {
      const questionSetId = parseInt(req.params.questionSetId);
      
      // Use optimized batch query instead of N+1 queries
      const questionsWithLatestVersions = await withCircuitBreaker(() => 
        batchFetchQuestionsWithVersions(questionSetId)
      );
      
      res.json(questionsWithLatestVersions);
    } catch (error) {
      console.error("Error fetching questions:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Provide more specific error messages
      if (errorMessage.includes('Circuit breaker is OPEN')) {
        res.status(503).json({ message: "Database temporarily unavailable. Please try again in a moment." });
      } else {
        res.status(500).json({ message: "Failed to fetch questions" });
      }
    }
  });

  // Removed duplicate endpoint - using the one with circuit breaker at line 1079

  // Test run routes

  app.get("/api/test-runs/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const testRun = await storage.getUserTestRun(id);
      
      if (!testRun) {
        return res.status(404).json({ message: "Test run not found" });
      }

      // Check ownership or admin access
      if (testRun.userId !== req.user!.id && !req.user!.isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      const answers = await storage.getUserAnswersByTestRun(id);
      const questionSet = await storage.getQuestionSet(testRun.questionSetId);
      
      res.json({
        ...testRun,
        answers,
        questionSet,
      });
    } catch (error) {
      console.error("Error fetching test run:", error);
      res.status(500).json({ message: "Failed to fetch test run" });
    }
  });

  app.get("/api/test-runs/:id/question/:index", requireAuth, async (req, res) => {
    try {
      const testRunId = parseInt(req.params.id);
      const questionIndex = parseInt(req.params.index);
      
      const testRun = await storage.getUserTestRun(testRunId);
      
      if (!testRun) {
        return res.status(404).json({ message: "Test run not found" });
      }

      if (testRun.userId !== req.user!.id && !req.user!.isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (questionIndex < 0 || questionIndex >= testRun.questionOrder.length) {
        return res.status(404).json({ message: "Question not found" });
      }

      const questionVersionId = testRun.questionOrder[questionIndex];
      const questionVersion = await storage.getQuestionVersion(questionVersionId);
      
      if (!questionVersion) {
        return res.status(404).json({ message: "Question version not found" });
      }

      const userAnswer = await storage.getUserAnswer(testRunId, questionVersionId);
      
      res.json({
        ...questionVersion,
        questionIndex,
        totalQuestions: testRun.questionOrder.length,
        userAnswer,
      });
    } catch (error) {
      console.error("Error fetching question:", error);
      res.status(500).json({ message: "Failed to fetch question" });
    }
  });

  app.get("/api/test-runs/:id/all-questions", requireAuth, async (req, res) => {
    try {
      const testRunId = parseInt(req.params.id);
      
      const testRun = await storage.getUserTestRun(testRunId);
      
      if (!testRun) {
        return res.status(404).json({ message: "Test run not found" });
      }

      if (testRun.userId !== req.user!.id && !req.user!.isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Fetch all question versions for this test run
      const questionVersions = await Promise.all(
        testRun.questionOrder.map(async (questionVersionId) => {
          const questionVersion = await storage.getQuestionVersion(questionVersionId);
          return questionVersion;
        })
      );

      res.json(questionVersions.filter(q => q !== undefined));
    } catch (error) {
      console.error("Error fetching all questions:", error);
      res.status(500).json({ message: "Failed to fetch questions" });
    }
  });

  app.post("/api/test-runs/:id/answers", requireAuth, async (req, res) => {
    try {
      const testRunId = parseInt(req.params.id);
      const answerData = insertUserAnswerSchema.parse({
        ...req.body,
        userTestRunId: testRunId,
      });

      const testRun = await storage.getUserTestRun(testRunId);
      
      if (!testRun) {
        return res.status(404).json({ message: "Test run not found" });
      }

      if (testRun.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const questionVersion = await storage.getQuestionVersion(answerData.questionVersionId);
      if (!questionVersion) {
        return res.status(404).json({ message: "Question not found" });
      }

      const isCorrect = answerData.chosenAnswer === questionVersion.correctAnswer;
      
      const answer = await storage.createUserAnswer({
        ...answerData,
        isCorrect,
      });

      res.status(201).json({
        ...answer,
        isCorrect,
        correctAnswer: questionVersion.correctAnswer,
      });
    } catch (error) {
      console.error("Error submitting answer:", error);
      res.status(500).json({ message: "Failed to submit answer" });
    }
  });

  app.post("/api/test-runs/:id/complete", requireAuth, async (req, res) => {
    try {
      const testRunId = parseInt(req.params.id);
      const testRun = await storage.getUserTestRun(testRunId);
      
      if (!testRun) {
        return res.status(404).json({ message: "Test run not found" });
      }

      if (testRun.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updatedTestRun = await storage.updateUserTestRun(testRunId, {
        completedAt: new Date(),
      });

      res.json(updatedTestRun);
    } catch (error) {
      console.error("Error completing test:", error);
      res.status(500).json({ message: "Failed to complete test" });
    }
  });

  // Question set answer submission endpoint
  app.post("/api/question-sets/:questionSetId/answer", requireAuth, async (req, res) => {
    try {
      const questionSetId = parseInt(req.params.questionSetId);
      const { questionVersionId, answer } = req.body;
      const userId = req.user!.id;



      if (isNaN(questionSetId)) {
        return res.status(400).json({ message: "Invalid question set ID" });
      }

      if (!questionVersionId || !answer) {
        return res.status(400).json({ message: "Question version ID and answer are required" });
      }

      // Get the question version to validate the answer
      const questionVersion = await withCircuitBreaker(() => storage.getQuestionVersion(questionVersionId));
      if (!questionVersion) {
        return res.status(404).json({ message: "Question version not found" });
      }

      const isCorrect = answer === questionVersion.correctAnswer;

      // Log this practice answer for analytics
      // First, find or create a practice test run for this user and question set
      let testRun = await storage.getActiveUserTestRunForQuestionSet(userId, questionSetId);
      
      if (!testRun) {
        // Create a new test run for this practice session
        
        // Use the optimized batch query to get all question versions at once
        const questionsWithVersions = await withCircuitBreaker(() => 
          batchFetchQuestionsWithVersions(questionSetId)
        );
        
        const questionVersionIds = questionsWithVersions
          .filter(q => q.latestVersion)
          .map(q => q.latestVersion!.id);
        
        testRun = await storage.createUserTestRun({
          userId,
          questionSetId,
          questionOrder: questionVersionIds,
          startedAt: new Date(),
        });
      }

      // Check if user already answered this question in this test run
      const existingAnswer = await storage.getUserAnswer(testRun.id, questionVersionId);
      
      if (!existingAnswer) {
        // Create the answer record
        await storage.createUserAnswer({
          userTestRunId: testRun.id,
          questionVersionId,
          chosenAnswer: answer,
          isCorrect,
          answeredAt: new Date(),
        });
        

        // Update daily activity summary
        const today = getTodayEST();
        
        await storage.updateDailyActivitySummary(today, {
          questionsAnswered: await storage.getDailyQuestionCount(today) + 1,
        });
      }

      // For question set practice, we return the answer validation result
      const answerData = {
        questionVersionId,
        chosenAnswer: answer,
        isCorrect,
        correctAnswer: questionVersion.correctAnswer,
      };

      res.json(answerData);
    } catch (error) {
      console.error("Error submitting answer:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('Circuit breaker is OPEN')) {
        res.status(503).json({ message: "Database temporarily unavailable. Please try again in a moment." });
      } else {
        res.status(500).json({ message: "Failed to submit answer" });
      }
    }
  });

  // Simple chatbot response (non-streaming)
  app.post("/api/chatbot/simple-response", requireAuth, aiRateLimiter.middleware(), async (req, res) => {
    try {
      const { questionVersionId, chosenAnswer, userMessage } = req.body;
      const userId = req.user!.id;

      const questionVersion = await storage.getQuestionVersion(questionVersionId);
      if (!questionVersion) {
        return res.status(404).json({ error: "Question not found" });
      }

      // Get the base question to access LOID
      const baseQuestion = await storage.getQuestion(questionVersion.questionId);
      let courseMaterial = null;
      
      
      if (baseQuestion?.loid) {
        courseMaterial = await storage.getCourseMaterialByLoid(baseQuestion.loid);
        if (courseMaterial) {
        }
      }

      // Get AI settings
      const aiSettings = await storage.getAiSettings();
      if (!aiSettings) {
        return res.status(500).json({ error: "AI settings not configured" });
      }

      // Get active prompt
      const activePrompt = await storage.getActivePromptVersion();
      if (!activePrompt) {
        return res.status(500).json({ error: "No active prompt configured" });
      }

      // Call OpenRouter to get response
      const response = await callOpenRouter(
        activePrompt.promptText,
        aiSettings,
        userId,
        JSON.stringify({
          question: questionVersion.questionText,
          answerChoices: questionVersion.answerChoices,
          correctAnswer: questionVersion.correctAnswer,
          chosenAnswer: chosenAnswer,
          userMessage: userMessage,
          courseMaterial: courseMaterial ? {
            assignment: courseMaterial.assignment,
            content: courseMaterial.content
          } : null
        })
      );

      res.json({ response });
    } catch (error) {
      console.error("Simple chatbot error:", error);
      res.status(500).json({ error: "Failed to get AI response" });
    }
  });

  // Initialize streaming
  app.post("/api/chatbot/stream-init", requireAuth, aiRateLimiter.middleware(), async (req, res) => {
    // Initialize streaming chatbot response
    
    try {
      const { questionVersionId, chosenAnswer, userMessage, isMobile, conversationHistory } = req.body;
      const userId = req.user!.id;

      // Include user ID in stream ID for better tracking and cleanup
      const streamId = `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Clean up any existing streams for this user to prevent conflicts
      const streamEntries = Array.from(activeStreams.entries());
      const userIdPattern = new RegExp(`^${userId}_`);
      for (const [existingStreamId, stream] of streamEntries) {
        // Use regex for more accurate user ID matching
        if (userIdPattern.test(existingStreamId)) {
          // Mark old stream as aborted before deletion
          stream.aborted = true;
          stream.done = true;
          stream.error = "New stream started";
          // Schedule cleanup instead of immediate deletion to allow final fetch
          setTimeout(() => cleanupStream(existingStreamId), 1000);
        }
      }
      
      // Initialize stream with timestamp - use provided conversation history if available
      activeStreams.set(streamId, { 
        chunks: [], 
        done: false, 
        lastActivity: Date.now(),
        aborted: false,
        conversationHistory: conversationHistory || [] // Use provided history or initialize empty
      });
      
      // Start background processing with mobile flag
      processStreamInBackground(streamId, questionVersionId, chosenAnswer, userMessage, req.user!.id, isMobile);
      
      res.json({ streamId });
    } catch (error) {
      // Error initializing stream
      res.status(500).json({ error: "Failed to initialize stream" });
    }
  });

  // Get stream chunk
  app.get("/api/chatbot/stream-chunk/:streamId", requireAuth, async (req, res) => {
    const streamId = req.params.streamId;
    const cursor = parseInt(req.query.cursor as string) || 0;
    const stream = activeStreams.get(streamId);
    
    if (!stream) {
      return res.status(404).json({ error: "Stream not found" });
    }
    
    // Check if stream was aborted
    if (stream.aborted) {
      return res.json({
        content: "",
        newContent: "",
        cursor: 0,
        done: true,
        error: "Stream was aborted"
      });
    }
    
    // Update activity timestamp for active streams
    if (!stream.done) {
      stream.lastActivity = Date.now();
    }
    
    // Get full accumulated content
    const fullContent = stream.chunks.join('');
    
    // Return only new content since cursor position
    const newContent = cursor < fullContent.length ? fullContent.slice(cursor) : '';
    
    // Set appropriate cache headers to reduce overhead
    res.set({
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Content-Type-Options': 'nosniff'
    });
    
    // Final chunk details removed
    
    res.json({
      content: fullContent, // Still send full content for compatibility
      newContent, // New incremental content
      cursor: fullContent.length, // New cursor position
      done: stream.done,
      error: stream.error
    });
    
    // Clean up finished streams
    if (stream.done) {
      // Clear chunks after sending final response
      // Clean up both successful and error streams
      setTimeout(() => {
        cleanupStream(streamId);
      }, 2000); // Slightly longer delay to ensure client gets final response
    }
  });

  // Abort stream endpoint
  app.post("/api/chatbot/stream-abort/:streamId", requireAuth, async (req, res) => {
    const streamId = req.params.streamId;
    const userId = req.user!.id;
    
    // Validate that the stream belongs to the current user
    if (!streamId.startsWith(`${userId}_`)) {
      return res.status(403).json({ error: "Unauthorized to abort this stream" });
    }
    
    const stream = activeStreams.get(streamId);
    
    if (stream) {
      stream.aborted = true;
      stream.done = true;
      stream.error = "Stream aborted by user";
    }
    
    res.json({ success: true });
  });

  // Feedback endpoint for chatbot responses
  app.post("/api/feedback", requireAuth, async (req, res) => {
    try {
      assertAuthenticated(req);
      
      const feedbackSchema = z.object({
        type: z.enum(["positive", "negative"]),
        message: z.string().optional(),
        messageId: z.string(),
        questionVersionId: z.number().optional(),
        conversation: z.array(z.object({
          id: z.string(),
          content: z.string(),
          role: z.enum(["user", "assistant"]),
        })).optional(),
        timestamp: z.string(),
      });

      const parsed = feedbackSchema.parse(req.body);
      
      // Get additional context for feedback and Notion sync
      let questionText = undefined;
      let courseName = undefined;
      let courseNumber = undefined;
      let courseId = undefined;
      let questionSetId = undefined;
      let questionSetTitle = undefined;
      let questionId = undefined;
      let loid = undefined;
      
      if (parsed.questionVersionId) {
        try {
          const questionVersion = await storage.getQuestionVersion(parsed.questionVersionId);
          if (questionVersion) {
            questionText = questionVersion.questionText;
            
            // Get the base question to access LOID and IDs
            const question = await storage.getQuestion(questionVersion.questionId);
            if (question) {
              questionId = question.id;
              loid = question.loid; // Capture the LOID
              
              const questionSet = await storage.getQuestionSet(question.questionSetId);
              if (questionSet) {
                questionSetId = questionSet.id;
                questionSetTitle = questionSet.title;
                
                const course = await storage.getCourse(questionSet.courseId);
                if (course) {
                  courseId = course.id;
                  courseName = course.courseTitle;
                  courseNumber = course.courseNumber; // Capture course number (e.g., "CPCU 500")
                }
              }
            }
          }
        } catch (err) {
          console.error('Error fetching question context:', err);
        }
      }

      // Get the base URL from the request
      const protocol = req.get('x-forwarded-proto') || req.protocol;
      const host = req.get('host');
      const baseUrl = `${protocol}://${host}`;
      
      await storage.createChatbotFeedback({
        userId: req.user.id,
        messageId: parsed.messageId,
        feedbackType: parsed.type,
        feedbackMessage: parsed.message || null,
        questionVersionId: parsed.questionVersionId || null,
        conversation: parsed.conversation || null,
        courseId,
        questionSetId,
        questionId,
        loid,
        userName: req.user.name,
        userEmail: req.user.email,
        questionText,
        courseName,
        courseNumber,
        questionSetTitle,
        baseUrl,
      });

      
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving feedback:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid feedback data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to save feedback" });
    }
  });

  // Helper function to clean course material URLs when on mobile
  function cleanCourseMaterialForMobile(content: string, isMobile: boolean): string {
    if (!isMobile) return content; // Keep everything for desktop
    
    
    // Remove [url=...] ... [/url] patterns from the course material
    let cleaned = content.replace(/\[url=[^\]]+\][^\[]*\[\/url\]/gi, '');
    // Also remove [color=...] tags that often wrap URLs
    cleaned = cleaned.replace(/\[color=[^\]]+\]/gi, '');
    cleaned = cleaned.replace(/\[\/color\]/gi, '');
    
    return cleaned;
  }

  // Background stream processing
  async function processStreamInBackground(streamId: string, questionVersionId: number, chosenAnswer: string, userMessage: string | undefined, userId: number, isMobile?: boolean) {
    const stream = activeStreams.get(streamId);
    if (!stream || stream.aborted) return;
    
    try {

      // Process stream with proper chosenAnswer handling

      const questionVersion = await storage.getQuestionVersion(questionVersionId);
      if (!questionVersion) {
        stream.error = "Question not found";
        stream.done = true;
        return;
      }

      // Get the base question to access LOID
      const baseQuestion = await storage.getQuestion(questionVersion.questionId);
      let courseMaterial = null;
      
      
      if (baseQuestion?.loid) {
        courseMaterial = await storage.getCourseMaterialByLoid(baseQuestion.loid);
        if (courseMaterial) {
        }
      }

      const aiSettings = await storage.getAiSettings();
      const activePrompt = await storage.getActivePromptVersion();
      
      // Get source material for both initial and follow-up responses
      let sourceMaterial = questionVersion.topicFocus || "No additional source material provided.";
      
      if (courseMaterial) {
        // Clean course material for mobile (removes URLs)
        sourceMaterial = cleanCourseMaterialForMobile(courseMaterial.content, isMobile || false);
      } else {
      }
      
      let prompt;
      let systemMessage = undefined;
      
      if (userMessage) {
        // For follow-up messages, simply use the user's message as the prompt
        // The conversation history will be maintained and passed to the API
        prompt = userMessage;
      } else {
        // Initial explanation with variable substitution - this becomes the system message
        systemMessage = activePrompt?.promptText || 
          `Write feedback designed to help students understand why answers to practice questions are correct or incorrect.

First, carefully review the assessment content:

<assessment_item>
{{QUESTION_TEXT}}
</assessment_item>

<answer_choices>
{{ANSWER_CHOICES}}
</answer_choices>

<selected_answer>
{{SELECTED_ANSWER}}
</selected_answer>

<correct_answer>
{{CORRECT_ANSWER}}
</correct_answer>

Next, review the provided source material that was used to create this assessment content:
<course_material>
{{COURSE_MATERIAL}}
</course_material>

Remember, your goal is to support student comprehension through meaningful feedback that is positive and supportive. Ensure that you comply with all of the following criteria:

##Criteria:
- Only use the provided content
- Use clear, jargon-free wording
- State clearly why each choice is ✅ Correct or ❌ Incorrect.
- In 2-4 sentences, explain the concept that makes the choice right or wrong.
- Paraphrase relevant ideas and reference section titles from the Source Material
- End with one motivating tip (≤ 1 sentence) suggesting what to review next.`;
        
        // Format answer choices as a list
        const formattedChoices = questionVersion.answerChoices.join('\n');
        
        // Ensure chosenAnswer is not empty or undefined
        const selectedAnswer = chosenAnswer && chosenAnswer.trim() !== '' ? chosenAnswer : "No answer was selected";

        // Substitute variables in the prompt
        systemMessage = systemMessage
          .replace(/\{\{QUESTION_TEXT\}\}/g, questionVersion.questionText)
          .replace(/\{\{ANSWER_CHOICES\}\}/g, formattedChoices)
          .replace(/\{\{SELECTED_ANSWER\}\}/g, selectedAnswer)
          .replace(/\{\{CORRECT_ANSWER\}\}/g, questionVersion.correctAnswer)
          .replace(/\{\{COURSE_MATERIAL\}\}/g, sourceMaterial);
        
        // For the initial message, the prompt is empty - the system message contains everything
        prompt = "Please provide feedback on my answer.";
        
        // Store the initial system message in conversation history
        if (stream.conversationHistory) {
          stream.conversationHistory.push({ role: "system", content: systemMessage });
        }
      }

      // Call OpenRouter with streaming and conversation history
      await streamOpenRouterToBuffer(prompt, aiSettings, streamId, userId, systemMessage, stream.conversationHistory);
      
      // After successful response, update conversation history
      if (!stream.error && stream.chunks && stream.chunks.length > 0) {
        const aiResponse = stream.chunks[stream.chunks.length - 1];
        if (stream.conversationHistory) {
          // Add user message to history (if not already added)
          if (!userMessage || stream.conversationHistory[stream.conversationHistory.length - 1]?.content !== prompt) {
            stream.conversationHistory.push({ role: "user", content: prompt });
          }
          // Add AI response to history
          stream.conversationHistory.push({ role: "assistant", content: aiResponse });
        }
      }
      
    } catch (error) {
      // Background processing error
      const stream = activeStreams.get(streamId);
      if (stream) {
        stream.error = "Failed to process request";
        stream.done = true;
      }
    }
  }

  // AI chatbot route - non-streaming (fallback)
  app.post("/api/chatbot", requireAuth, async (req, res) => {
    try {
      const { questionVersionId, chosenAnswer, userMessage, isMobile } = req.body;
      
      const questionVersion = await storage.getQuestionVersion(questionVersionId);
      if (!questionVersion) {
        return res.status(404).json({ message: "Question not found" });
      }

      // Get the base question to access LOID
      const baseQuestion = await storage.getQuestion(questionVersion.questionId);
      let courseMaterial = null;
      
      
      if (baseQuestion?.loid) {
        courseMaterial = await storage.getCourseMaterialByLoid(baseQuestion.loid);
        if (courseMaterial) {
        }
      }

      const aiSettings = await storage.getAiSettings();
      const activePrompt = await storage.getActivePromptVersion();
      
      // Get source material for both initial and follow-up responses
      let sourceMaterial = questionVersion.topicFocus || "No additional source material provided.";
      
      if (courseMaterial) {
        // Clean course material for mobile (removes URLs)
        sourceMaterial = cleanCourseMaterialForMobile(courseMaterial.content, isMobile || false);
      } else {
      }
      
      let prompt;
      if (userMessage) {
        // Follow-up question with course material context and selected answer
        const selectedAnswerText = chosenAnswer && chosenAnswer.trim() !== '' ? chosenAnswer : "No answer was selected";
        
        prompt = `${userMessage}

Context: Question was "${questionVersion.questionText}" with choices ${questionVersion.answerChoices.join(', ')}. 
Student selected: ${selectedAnswerText}
The correct answer is ${questionVersion.correctAnswer}.

Relevant course material:
${sourceMaterial}

Please provide a helpful response based on the course material above, keeping in mind what the student selected.`;
        
        // Strip link_handling section if on mobile for follow-up prompts
      } else {
        // Initial explanation with variable substitution
        let systemPrompt = activePrompt?.promptText || 
          `Write feedback designed to help students understand why answers to practice questions are correct or incorrect.

First, carefully review the assessment content:

<assessment_item>
{{QUESTION_TEXT}}
</assessment_item>

<answer_choices>
{{ANSWER_CHOICES}}
</answer_choices>

<selected_answer>
{{SELECTED_ANSWER}}
</selected_answer>

<correct_answer>
{{CORRECT_ANSWER}}
</correct_answer>

Next, review the provided source material that was used to create this assessment content:
<course_material>
{{COURSE_MATERIAL}}
</course_material>

Remember, your goal is to support student comprehension through meaningful feedback that is positive and supportive. Ensure that you comply with all of the following criteria:

##Criteria:
- Only use the provided content
- Use clear, jargon-free wording
- State clearly why each choice is ✅ Correct or ❌ Incorrect.
- In 2-4 sentences, explain the concept that makes the choice right or wrong.
- Paraphrase relevant ideas and reference section titles from the Source Material
- End with one motivating tip (≤ 1 sentence) suggesting what to review next.`;
        
        // Format answer choices as a list
        const formattedChoices = questionVersion.answerChoices.join('\n');

        // Ensure chosenAnswer is not empty or undefined
        const selectedAnswer = chosenAnswer && chosenAnswer.trim() !== '' ? chosenAnswer : "No answer was selected";

        // Substitute variables in the prompt
        systemPrompt = systemPrompt
          .replace(/\{\{QUESTION_TEXT\}\}/g, questionVersion.questionText)
          .replace(/\{\{ANSWER_CHOICES\}\}/g, formattedChoices)
          .replace(/\{\{SELECTED_ANSWER\}\}/g, selectedAnswer)
          .replace(/\{\{CORRECT_ANSWER\}\}/g, questionVersion.correctAnswer)
          .replace(/\{\{COURSE_MATERIAL\}\}/g, sourceMaterial);
        

        
        // Strip link_handling section if on mobile
        
        prompt = systemPrompt;
      }

      const response = await callOpenRouter(prompt, aiSettings, req.user!.id, activePrompt?.promptText);
      res.json({ response });
    } catch (error) {
      console.error("Error calling chatbot:", error);
      res.status(500).json({ message: "Failed to get AI response" });
    }
  });

  // AI Settings admin routes
  app.get("/api/admin/ai-settings", requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getAiSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching AI settings:", error);
      res.status(500).json({ message: "Failed to fetch AI settings" });
    }
  });

  app.put("/api/admin/ai-settings", requireAdmin, async (req, res) => {
    try {
      const { modelName } = req.body;
      const settings = await storage.updateAiSettings({
        modelName
      });
      res.json(settings);
    } catch (error) {
      console.error("Error updating AI settings:", error);
      res.status(500).json({ message: "Failed to update AI settings" });
    }
  });

  app.get("/api/admin/active-prompt", requireAdmin, async (req, res) => {
    try {
      const prompt = await storage.getActivePromptVersion();
      res.json(prompt);
    } catch (error) {
      console.error("Error fetching active prompt:", error);
      res.status(500).json({ message: "Failed to fetch active prompt" });
    }
  });

  app.put("/api/admin/active-prompt", requireAdmin, async (req, res) => {
    try {
      const { promptText } = req.body;
      
      if (!promptText) {
        return res.status(400).json({ message: "Prompt text is required" });
      }

      // Deactivate current prompt and create new active one
      await db.update(promptVersions)
        .set({ isActive: false })
        .where(eq(promptVersions.isActive, true));

      const newPrompt = await db.insert(promptVersions)
        .values({
          versionName: `Updated ${new Date().toISOString().split('T')[0]}`,
          promptText,
          modelName: 'anthropic/claude-sonnet-4',
          isActive: true
        })
        .returning();

      res.json(newPrompt[0] || {});
    } catch (error) {
      console.error("Error updating active prompt:", error);
      res.status(500).json({ message: "Failed to update active prompt" });
    }
  });

  // Admin routes
  app.get("/api/admin/all-question-sets", requireAdmin, async (req, res) => {
    try {
      const allQuestionSets = await db
        .select({
          id: questionSets.id,
          title: questionSets.title,
          courseId: questionSets.courseId,
          courseTitle: courses.courseTitle
        })
        .from(questionSets)
        .leftJoin(courses, eq(questionSets.courseId, courses.id))
        .orderBy(questionSets.courseId, questionSets.title);
      
      res.json(allQuestionSets);
    } catch (error) {
      console.error("Error fetching all question sets:", error);
      res.status(500).json({ message: "Failed to fetch all question sets" });
    }
  });

  app.get("/api/admin/courses", requireAdmin, async (req, res) => {
    try {
      const courses = await storage.getAllCourses();
      const coursesWithStats = await Promise.all(
        courses.map(async (course) => {
          const questionSets = await storage.getQuestionSetsByCourse(course.id);
          
          // Count total questions across all question sets
          let totalQuestions = 0;
          for (const questionSet of questionSets) {
            const questions = await storage.getQuestionsByQuestionSet(questionSet.id);
            totalQuestions += questions.length;
          }
          
          return {
            ...course,
            questionCount: totalQuestions,
            questionSetCount: questionSets.length,
          };
        })
      );
      
      res.json(coursesWithStats);
    } catch (error) {
      console.error("Error fetching admin courses:", error);
      res.status(500).json({ message: "Failed to fetch courses" });
    }
  });

  // Support both URL parameter and query parameter for backward compatibility
  app.get("/api/admin/questions", requireAdmin, async (req, res) => {
    try {
      const questionSetId = req.query.questionSetId;
      
      if (!questionSetId) {
        return res.status(400).json({ message: "questionSetId query parameter is required" });
      }
      
      const questions = await storage.getQuestionsByQuestionSet(parseInt(questionSetId as string));
      
      // Get the latest version for each question to display
      const questionsWithVersions = await Promise.all(
        questions.map(async (question) => {
          const versions = await storage.getQuestionVersionsByQuestion(question.id);
          const latestVersion = versions[versions.length - 1]; // Get latest version
          
          return {
            id: question.id,
            originalQuestionNumber: question.originalQuestionNumber,
            loid: question.loid,
            questionText: latestVersion?.questionText || '',
            answerChoices: latestVersion?.answerChoices || [],
            correctAnswer: latestVersion?.correctAnswer || '',
            topicFocus: latestVersion?.topicFocus || '',
            questionType: latestVersion?.questionType || 'multiple_choice',
          };
        })
      );
      
      res.json(questionsWithVersions);
    } catch (error) {
      console.error("Error fetching questions:", error);
      res.status(500).json({ message: "Failed to fetch questions" });
    }
  });

  app.get("/api/admin/questions/:questionSetId", requireAdmin, async (req, res) => {
    try {
      const questionSetId = parseInt(req.params.questionSetId);
      
      if (isNaN(questionSetId)) {
        return res.status(400).json({ message: "Invalid question set ID" });
      }
      
      const questions = await storage.getQuestionsByQuestionSet(questionSetId);
      
      // Get the latest version for each question to display
      const questionsWithVersions = await Promise.all(
        questions.map(async (question) => {
          const versions = await storage.getQuestionVersionsByQuestion(question.id);
          const latestVersion = versions[versions.length - 1]; // Get latest version
          
          return {
            id: question.id,
            originalQuestionNumber: question.originalQuestionNumber,
            loid: question.loid,
            questionText: latestVersion?.questionText || '',
            answerChoices: latestVersion?.answerChoices || [],
            correctAnswer: latestVersion?.correctAnswer || '',
            topicFocus: latestVersion?.topicFocus || '',
            questionType: latestVersion?.questionType || 'multiple_choice',
          };
        })
      );
      
      res.json(questionsWithVersions);
    } catch (error) {
      console.error("Error fetching questions:", error);
      res.status(500).json({ message: "Failed to fetch questions" });
    }
  });

  app.post("/api/admin/import-questions", requireAdmin, async (req, res) => {
    try {
      const { questionSetId, questions: questionsData } = req.body;
      
      const questionSet = await storage.getQuestionSet(questionSetId);
      if (!questionSet) {
        return res.status(404).json({ message: "Question set not found" });
      }

      const validatedQuestions = z.array(questionImportSchema).parse(questionsData);
      await storage.importQuestions(questionSetId, validatedQuestions);
      
      res.json({ message: `Successfully imported ${validatedQuestions.length} questions` });
    } catch (error) {
      console.error("Error importing questions:", error);
      res.status(400).json({ message: "Failed to import questions" });
    }
  });

  app.get("/api/admin/ai-settings", requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getAiSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching AI settings:", error);
      res.status(500).json({ message: "Failed to fetch AI settings" });
    }
  });

  app.put("/api/admin/ai-settings", requireAdmin, async (req, res) => {
    try {
      const settingsData = insertAiSettingsSchema.partial().parse(req.body);
      const settings = await storage.updateAiSettings(settingsData);
      res.json(settings);
    } catch (error) {
      console.error("Error updating AI settings:", error);
      res.status(400).json({ message: "Failed to update AI settings" });
    }
  });

  // Prompt version routes
  app.get("/api/admin/prompt-versions", requireAdmin, async (req, res) => {
    try {
      const versions = await storage.getAllPromptVersions();
      res.json(versions);
    } catch (error) {
      console.error("Error fetching prompt versions:", error);
      res.status(500).json({ message: "Failed to fetch prompt versions" });
    }
  });

  app.post("/api/admin/prompt-versions", requireAdmin, async (req, res) => {
    try {
      const versionData = insertPromptVersionSchema.parse(req.body);
      const version = await storage.createPromptVersion(versionData);
      res.json(version);
    } catch (error) {
      console.error("Error creating prompt version:", error);
      res.status(400).json({ message: "Failed to create prompt version" });
    }
  });

  app.put("/api/admin/prompt-versions/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const versionData = insertPromptVersionSchema.partial().parse(req.body);
      const version = await storage.updatePromptVersion(id, versionData);
      
      if (!version) {
        return res.status(404).json({ message: "Prompt version not found" });
      }
      
      res.json(version);
    } catch (error) {
      console.error("Error updating prompt version:", error);
      res.status(400).json({ message: "Failed to update prompt version" });
    }
  });

  app.put("/api/admin/prompt-versions/:id/activate", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.setActivePromptVersion(id);
      res.json({ message: "Prompt version activated successfully" });
    } catch (error) {
      console.error("Error activating prompt version:", error);
      res.status(400).json({ message: "Failed to activate prompt version" });
    }
  });

  app.get("/api/admin/chatbot-logs", requireAdmin, async (req, res) => {
    try {
      const logs = await storage.getChatbotLogs();
      res.json(logs);
    } catch (error) {
      console.error("Error fetching chatbot logs:", error);
      res.status(500).json({ message: "Failed to fetch chatbot logs" });
    }
  });

  // Comprehensive logs endpoints
  app.get("/api/admin/logs/overview", requireAdmin, async (req, res) => {
    try {
      // Disable caching for real-time stats
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.set('Surrogate-Control', 'no-store');
      
      const timeScale = (req.query.timeScale as string) || 'day';
      const stats = await storage.getOverallStats(timeScale);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching overall stats:", error);
      res.status(500).json({ message: "Failed to fetch overall statistics" });
    }
  });

  app.get("/api/admin/logs/users", requireAdmin, async (req, res) => {
    try {
      const userStats = await storage.getUserStats();
      res.json(userStats);
    } catch (error) {
      console.error("Error fetching user stats:", error);
      res.status(500).json({ message: "Failed to fetch user statistics" });
    }
  });

  app.get("/api/admin/logs/questions", requireAdmin, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;
      const questionStats = await storage.getQuestionStats(start, end);
      res.json(questionStats);
    } catch (error) {
      console.error("Error fetching question stats:", error);
      res.status(500).json({ message: "Failed to fetch question statistics" });
    }
  });

  app.get("/api/admin/logs/courses", requireAdmin, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;
      const courseStats = await storage.getCourseStats(start, end);
      res.json(courseStats);
    } catch (error) {
      console.error("Error fetching course stats:", error);
      res.status(500).json({ message: "Failed to fetch course statistics" });
    }
  });

  app.get("/api/admin/logs/feedback", requireAdmin, async (req, res) => {
    try {
      const feedbackData = await storage.getChatbotFeedback();
      res.json(feedbackData);
    } catch (error) {
      console.error("Error fetching feedback data:", error);
      res.status(500).json({ message: "Failed to fetch feedback data" });
    }
  });

  app.get("/api/admin/logs/feedback/:id", requireAdmin, async (req, res) => {
    try {
      const feedbackId = parseInt(req.params.id);
      if (isNaN(feedbackId)) {
        return res.status(400).json({ message: "Invalid feedback ID" });
      }
      
      const feedback = await storage.getChatbotFeedbackById(feedbackId);
      if (!feedback) {
        return res.status(404).json({ message: "Feedback not found" });
      }
      
      res.json(feedback);
    } catch (error) {
      console.error("Error fetching feedback by ID:", error);
      res.status(500).json({ message: "Failed to fetch feedback" });
    }
  });

  app.get("/api/admin/logs/question-set-usage", requireAdmin, async (req, res) => {
    try {
      const { groupBy = 'day', viewType = 'date', timeRange = 'all' } = req.query;
      
      // Add no-cache headers to ensure fresh data
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
      if (viewType === 'course') {
        const data = await storage.getQuestionSetUsageByCourse(timeRange as 'day' | 'week' | 'month' | 'all');
        res.json(data);
      } else {
        const data = await storage.getQuestionSetUsageByDate(groupBy as 'day' | 'week' | 'month', timeRange as 'day' | 'week' | 'month' | 'all');
        res.json(data);
      }
    } catch (error) {
      console.error("Error fetching question set usage:", error);
      res.status(500).json({ message: "Failed to fetch question set usage" });
    }
  });

  app.get("/api/admin/logs/questions-answered", requireAdmin, async (req, res) => {
    try {
      const { groupBy = 'day', viewType = 'date', timeRange = 'all' } = req.query;
      
      // Add no-cache headers to ensure fresh data
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
      if (viewType === 'course') {
        const data = await storage.getQuestionsAnsweredByCourse(timeRange as 'day' | 'week' | 'month' | 'all');
        res.json(data);
      } else {
        const data = await storage.getQuestionsAnsweredByDate(groupBy as 'day' | 'week' | 'month', timeRange as 'day' | 'week' | 'month' | 'all');
        res.json(data);
      }
    } catch (error) {
      console.error("Error fetching questions answered:", error);
      res.status(500).json({ message: "Failed to fetch questions answered" });
    }
  });

  app.get("/api/admin/logs/question-set/:questionSetId/details", requireAdmin, async (req, res) => {
    try {
      const questionSetId = parseInt(req.params.questionSetId);
      const { startDate, endDate } = req.query;
      
      if (isNaN(questionSetId)) {
        return res.status(400).json({ message: "Invalid question set ID" });
      }
      
      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;
      const detailedStats = await storage.getQuestionSetDetailedStats(questionSetId, start, end);
      res.json(detailedStats);
    } catch (error) {
      console.error("Error fetching question set detailed stats:", error);
      res.status(500).json({ message: "Failed to fetch question set detailed statistics" });
    }
  });

  app.get("/api/admin/logs/engagement-metrics", requireAdmin, async (req, res) => {
    try {
      const { period, startDate, endDate } = req.query;
      
      // Add no-cache headers to ensure fresh data
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
      let metrics;
      
      // Check if date range is provided
      if (startDate && endDate) {
        const start = new Date(startDate as string);
        const end = new Date(endDate as string);
        
        // Validate dates
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          return res.status(400).json({ message: "Invalid date format" });
        }
        
        if (start > end) {
          return res.status(400).json({ message: "Start date must be before end date" });
        }
        
        metrics = await storage.getEngagementMetricsByDateRange(start, end);
      } else if (period) {
        // Legacy support for period parameter
        if (!['today', '7days', '28days'].includes(period as string)) {
          return res.status(400).json({ message: "Invalid period. Must be 'today', '7days', or '28days'" });
        }
        metrics = await storage.getEngagementMetrics(period as 'today' | '7days' | '28days');
      } else {
        // Default to last 7 days
        metrics = await storage.getEngagementMetrics('7days');
      }
      
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching engagement metrics:", error);
      res.status(500).json({ message: "Failed to fetch engagement metrics" });
    }
  });

  // Custom usage summary endpoint for specific date range
  app.get("/api/admin/logs/usage-summary", requireAdmin, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "Start date and end date are required" });
      }
      
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      
      // Validate dates
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }
      
      if (start > end) {
        return res.status(400).json({ message: "Start date must be before end date" });
      }
      
      // Get the summary data for the date range
      const summary = await storage.getUsageSummary(start, end);
      
      res.json(summary);
    } catch (error) {
      console.error("Error fetching usage summary:", error);
      res.status(500).json({ message: "Failed to fetch usage summary" });
    }
  });

  // Usage Report Generation Routes
  app.post("/api/admin/reports/generate", requireAdmin, async (req, res) => {
    try {
      const { startDate, endDate, format } = req.body;
      
      // Validate required fields
      if (!startDate || !endDate || !format) {
        return res.status(400).json({ 
          message: "Start date, end date, and format are required" 
        });
      }
      
      // Only CSV format is supported now
      if (format !== 'csv') {
        return res.status(400).json({ 
          message: "Only CSV format is supported" 
        });
      }
      
      // Parse dates
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      // Validate dates
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }
      
      // Import the report generator
      const { UsageReportGenerator } = await import('./services/usage-report-generator');
      const generator = new UsageReportGenerator();
      
      // Generate the CSV report
      const reportBuffer = await generator.generateReport({
        startDate: start,
        endDate: end,
        format: 'csv'
      });
      
      // Set appropriate headers for file download
      const timestamp = new Date().toISOString().split('T')[0];
      const extension = 'zip';
      const mimeType = 'application/zip';
      const filename = `usage-report-${timestamp}.${extension}`;
      
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', reportBuffer.length.toString());
      
      // Send as binary data, not JSON
      res.end(reportBuffer);
    } catch (error: any) {
      console.error("Error generating report:", error);
      
      // Handle specific error types
      if (error.message?.includes('Date range cannot exceed 1 year')) {
        return res.status(400).json({ message: error.message });
      }
      if (error.message?.includes('Start date must be before end date')) {
        return res.status(400).json({ message: error.message });
      }
      if (error.message?.includes('End date cannot be in the future')) {
        return res.status(400).json({ message: error.message });
      }
      
      res.status(500).json({ 
        message: "Failed to generate report. Please try again later." 
      });
    }
  });

  app.get("/api/admin/reports/preview", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ 
          message: "Start date and end date are required" 
        });
      }
      
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      
      // Validate dates
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }
      
      // Import the report generator
      const { UsageReportGenerator } = await import('./services/usage-report-generator');
      const generator = new UsageReportGenerator();
      
      // Get preview data
      const preview = await generator.getReportPreview(start, end);
      
      res.json(preview);
    } catch (error: any) {
      console.error("Error fetching report preview:", error);
      
      // Handle specific error types
      if (error.message?.includes('Date range cannot exceed 1 year')) {
        return res.status(400).json({ message: error.message });
      }
      if (error.message?.includes('Start date must be before end date')) {
        return res.status(400).json({ message: error.message });
      }
      if (error.message?.includes('End date cannot be in the future')) {
        return res.status(400).json({ message: error.message });
      }
      
      res.status(500).json({ 
        message: "Failed to fetch report preview" 
      });
    }
  });

  // Bubble API integration routes
  app.get("/api/admin/bubble/question-sets", requireAdmin, async (req, res) => {
    try {
      const courseNumber = req.query.courseNumber as string | undefined;
      const bubbleApiKey = process.env.BUBBLE_API_KEY;
      
      if (!bubbleApiKey) {
        return res.status(500).json({ message: "Bubble API key not configured" });
      }

      const baseUrl = "https://ti-content-repository.bubbleapps.io/version-test/api/1.1/obj/question_set";
      const headers = {
        "Authorization": `Bearer ${bubbleApiKey}`,
        "Content-Type": "application/json"
      };

      let url = baseUrl;
      
      // Fetch all question sets first
      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        const responseText = await response.text();
        console.error("Bubble API response:", response.status, responseText);
        throw new Error(`Bubble API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      let questionSets = data.response?.results || [];
      
      // Filter by course number if provided
      if (courseNumber) {
        
        
        questionSets = questionSets.filter((qs: any) => {
          // Try multiple ways to find the course number
          const qsCourseNumber = qs.learning_object?.course?.course_number || 
                                 qs.course_number ||
                                 qs.course?.course_number;
          
          // Also check if the course is directly linked via Bubble ID
          const courseBubbleId = qs.course || qs.course_custom_course;
          
          return qsCourseNumber === courseNumber;
        });
      }
      
      // Return the same structure as the Bubble API
      res.json({
        response: {
          results: questionSets,
          count: questionSets.length,
          remaining: 0
        }
      });
    } catch (error) {
      console.error("Error fetching from Bubble API:", error);
      res.status(500).json({ message: "Failed to fetch question sets from Bubble repository" });
    }
  });

  app.post("/api/admin/bubble/import-question-sets", requireAdmin, async (req, res) => {
    try {
      const { questionSets } = req.body;
      const bubbleApiKey = process.env.BUBBLE_API_KEY;
      
      if (!bubbleApiKey) {
        return res.status(500).json({ message: "Bubble API key not configured" });
      }

      const importResults = {
        imported: 0,
        failed: 0,
        errors: [] as string[]
      };

      // Process each question set
      for (const bubbleQuestionSet of questionSets) {
        try {
          // Extract course information from the Bubble data
          const courseNumber = bubbleQuestionSet.learning_object?.course?.course_number;
          const courseTitle = bubbleQuestionSet.learning_object?.course?.title || `Course ${courseNumber}`;
          
          // Find or create course
          let course = await storage.getCourseByExternalId(courseNumber);
          if (!course) {
            course = await storage.createCourse({
              courseNumber: courseNumber,
              courseTitle: courseTitle,
              externalId: courseNumber
            });
          }

          // Create question set
          const questionSet = await storage.createQuestionSet({
            courseId: course.id,
            title: bubbleQuestionSet.title || `Question Set ${bubbleQuestionSet._id}`,
            description: bubbleQuestionSet.description || null,
          });

          // Import questions if they exist in the Bubble data
          if (bubbleQuestionSet.questions && Array.isArray(bubbleQuestionSet.questions)) {
            const questionImports = bubbleQuestionSet.questions.map((q: any) => ({
              question_number: q.question_number || q.number || 1,
              type: q.type || "multiple_choice",
              loid: q.loid || bubbleQuestionSet.learning_object?._id || "unknown",
              versions: [{
                version_number: 1,
                topic_focus: q.topic_focus || bubbleQuestionSet.title || "General",
                question_text: q.question_text || q.text || "",
                question_type: q.question_type || q.type || "multiple_choice",
                answer_choices: q.answer_choices || q.choices || [],
                correct_answer: q.correct_answer || q.answer || "",
                acceptable_answers: q.acceptable_answers,
                case_sensitive: q.case_sensitive || false,
                allow_multiple: q.allow_multiple || false,
                matching_pairs: q.matching_pairs,
                correct_order: q.correct_order
              }]
            }));

            // Wrap bulk operations in try-catch for better error handling
            try {
              await storage.importQuestions(questionSet.id, questionImports);
              
              // Update question count
              await storage.updateQuestionSetCount(questionSet.id);
            } catch (importError) {
              console.error(`Error during bulk import for question set ${questionSet.id}:`, importError);
              // Re-throw to trigger rollback handling in parent catch
              throw importError;
            }
          }

          importResults.imported++;
        } catch (error) {
          console.error(`Error importing question set ${bubbleQuestionSet._id}:`, error);
          importResults.failed++;
          importResults.errors.push(`Failed to import ${bubbleQuestionSet.title || bubbleQuestionSet._id}: ${(error as Error).message}`);
        }
      }

      res.json({
        message: `Import completed. Imported: ${importResults.imported}, Failed: ${importResults.failed}`,
        results: importResults
      });
    } catch (error) {
      console.error("Error importing question sets:", error);
      res.status(500).json({ message: "Failed to import question sets" });
    }
  });

  // New endpoint to update all question sets from Bubble
  app.post("/api/admin/bubble/update-all-question-sets", requireAdmin, async (req, res) => {
    console.log("🔄 Starting update-all-question-sets process...");
    const startTime = Date.now();
    const { courseNumber } = req.body; // Optional course number filter
    
    try {
      // Debug environment variables
      
      const bubbleApiKey = process.env.BUBBLE_API_KEY;
      
      if (!bubbleApiKey) {
        console.error("❌ Bubble API key not configured in environment variables");
        console.error("NODE_ENV:", process.env.NODE_ENV);
        console.error("Total env vars:", Object.keys(process.env).length);
        return res.status(500).json({ message: "Bubble API key not configured" });
      }


      // Fetch all question sets from Bubble
      const baseUrl = "https://ti-content-repository.bubbleapps.io/version-test/api/1.1/obj/question_set";
      const headers = {
        "Authorization": `Bearer ${bubbleApiKey}`,
        "Content-Type": "application/json"
      };

      const response = await fetch(baseUrl, { headers });
      
      if (!response.ok) {
        console.error(`❌ Bubble API error: ${response.status} ${response.statusText}`);
        throw new Error(`Bubble API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const bubbleQuestionSets = data.response?.results || [];

      const updateResults = {
        created: 0,
        updated: 0,
        failed: 0,
        errors: [] as string[]
      };

      // Process each question set
      for (let i = 0; i < bubbleQuestionSets.length; i++) {
        const bubbleQuestionSet = bubbleQuestionSets[i];
        try {
          const bubbleId = bubbleQuestionSet._id;
          const courseBubbleId = bubbleQuestionSet.course || bubbleQuestionSet.course_custom_course;
          const qsCourseNumber = bubbleQuestionSet.learning_object?.course?.course_number;
          const courseTitle = bubbleQuestionSet.learning_object?.course?.title || `Course ${qsCourseNumber}`;
          
          // Skip if filtering by course and this doesn't match
          if (courseNumber && qsCourseNumber !== courseNumber) {
            continue;
          }
          
          
          // Skip if no course association
          if (!courseBubbleId) {
            updateResults.failed++;
            updateResults.errors.push(`No course for question set: ${bubbleQuestionSet.title || bubbleId}`);
            continue;
          }
          
          // Find course by Bubble ID
          let course = await storage.getCourseByBubbleId(courseBubbleId);
          if (!course) {
            updateResults.failed++;
            updateResults.errors.push(`Course not found for question set: ${bubbleQuestionSet.title || bubbleId}`);
            continue;
          }
          
          
          // Parse content field to get questions
          let parsedQuestions: any[] = [];
          if (bubbleQuestionSet.content) {
            try {
              const contentJson = JSON.parse(bubbleQuestionSet.content);
              if (contentJson.questions && Array.isArray(contentJson.questions)) {
                parsedQuestions = contentJson.questions;
              } else {
              }
            } catch (parseError) {
            }
          }

          // Check if question set already exists by external ID
          let questionSet = await storage.getQuestionSetByExternalId(bubbleId);
          
          if (questionSet) {
            // Update existing question set
            await storage.updateQuestionSet(questionSet.id, {
              courseId: course.id,
              title: bubbleQuestionSet.title || `Question Set ${bubbleId}`,
              description: bubbleQuestionSet.description || null,
            });
            
            // Delete existing questions to replace with updated ones
            await db.delete(questionVersions)
              .where(inArray(questionVersions.questionId, 
                db.select({ id: questions.id })
                  .from(questions)
                  .where(eq(questions.questionSetId, questionSet.id))
              ));
            await db.delete(questions).where(eq(questions.questionSetId, questionSet.id));
            
            updateResults.updated++;
          } else {
            // Create new question set
            questionSet = await storage.createQuestionSet({
              courseId: course.id,
              title: bubbleQuestionSet.title || `Question Set ${bubbleId}`,
              description: bubbleQuestionSet.description || null,
              externalId: bubbleId
            });
            updateResults.created++;
          }

          // Import questions from parsed content
          if (parsedQuestions.length > 0) {
            const questionImports = parsedQuestions.map((q: any, index: number) => ({
              question_number: q.question_number || q.originalQuestionNumber || (index + 1),
              type: q.type || "multiple_choice",
              loid: q.loid || q.LOID || "unknown",
              versions: [{
                version_number: 1,
                topic_focus: q.topic_focus || q.topicFocus || bubbleQuestionSet.title || "General",
                question_text: q.question_text || q.questionText || "",
                question_type: q.question_type || q.questionType || q.type || "multiple_choice",
                answer_choices: q.answer_choices || q.answerChoices || [],
                correct_answer: q.correct_answer || q.correctAnswer || "",
                acceptable_answers: q.acceptable_answers || q.acceptableAnswers,
                case_sensitive: q.case_sensitive || q.caseSensitive || false,
                allow_multiple: q.allow_multiple || q.allowMultiple || false,
                matching_pairs: q.matching_pairs || q.matchingPairs,
                correct_order: q.correct_order || q.correctOrder
              }]
            }));

            // Wrap bulk operations in try-catch for better error handling
            try {
              await storage.importQuestions(questionSet.id, questionImports);
              await storage.updateQuestionSetCount(questionSet.id);
            } catch (importError) {
              console.error(`Error during bulk import for question set ${questionSet.id}:`, importError);
              // Re-throw to trigger rollback handling in parent catch
              throw importError;
            }
          } else {
          }
          
        } catch (error) {
          updateResults.failed++;
          const errorMsg = `Failed to update ${bubbleQuestionSet.title}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          updateResults.errors.push(errorMsg);
          console.error(`  ❌ ${errorMsg}`);
          console.error(`  Error details:`, error);
        }
      }

      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      
      
      if (updateResults.errors.length > 0) {
      }

      const message = `Update completed in ${duration}s. Created: ${updateResults.created}, Updated: ${updateResults.updated}, Failed: ${updateResults.failed}`;
      
      res.json({
        message,
        results: updateResults,
        totalProcessed: bubbleQuestionSets.length
      });
    } catch (error) {
      console.error("❌ Critical error in update-all-question-sets:", error);
      res.status(500).json({ message: "Failed to update question sets from Bubble repository" });
    }
  });

  // Get comparison data for question set refresh from Bubble
  app.get("/api/admin/question-sets/:questionSetId/refresh", requireAdmin, async (req, res) => {
    try {
      const questionSetId = parseInt(req.params.questionSetId);
      
      if (isNaN(questionSetId)) {
        return res.status(400).json({ message: "Invalid question set ID" });
      }
      
      // Get the question set to find its external ID
      const questionSet = await storage.getQuestionSet(questionSetId);
      if (!questionSet) {
        return res.status(404).json({ message: "Question set not found" });
      }
      
      if (!questionSet.externalId) {
        return res.status(400).json({ message: "Question set has no Bubble ID associated" });
      }
      
      const bubbleApiKey = process.env.BUBBLE_API_KEY;
      if (!bubbleApiKey) {
        return res.status(500).json({ message: "Bubble API key not configured" });
      }
      
      // Fetch the specific question set from Bubble using its ID
      const url = `https://ti-content-repository.bubbleapps.io/version-test/api/1.1/obj/question_set/${questionSet.externalId}`;
      const headers = {
        "Authorization": `Bearer ${bubbleApiKey}`,
        "Content-Type": "application/json"
      };
      
      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        console.error(`Bubble API error: ${response.status} ${response.statusText}`);
        
        if (response.status === 404) {
          return res.status(404).json({ 
            message: `Question set not found in Bubble.io. The external ID "${questionSet.externalId}" may be invalid or the content may have been removed from Bubble.` 
          });
        }
        
        return res.status(500).json({ message: `Failed to fetch from Bubble: ${response.statusText}` });
      }
      
      const data = await response.json();
      const bubbleQuestionSet = data.response;
      
      if (!bubbleQuestionSet) {
        return res.status(404).json({ message: "Question set not found in Bubble" });
      }
      
      // Parse the content field to get new questions from Bubble
      let newQuestions: any[] = [];
      if (bubbleQuestionSet.content) {
        try {
          const contentJson = JSON.parse(bubbleQuestionSet.content);
          if (contentJson.questions && Array.isArray(contentJson.questions)) {
            newQuestions = contentJson.questions;
          }
        } catch (parseError) {
          console.error("Error parsing question content:", parseError);
          return res.status(400).json({ message: "Invalid question content format in Bubble data" });
        }
      }
      
      // Get current questions from database
      const currentQuestions = await storage.getQuestionsByQuestionSet(questionSetId);
      
      // Create simplified comparison data
      const currentQuestionsSummary = currentQuestions
        .map((q: any) => ({
          id: q.id,
          questionNumber: q.originalQuestionNumber,
          loid: q.loid,
          versionCount: 1, // Simplified for display
          preview: `Question ${q.originalQuestionNumber}` // Simplified preview
        }))
        .sort((a, b) => (a.questionNumber || 0) - (b.questionNumber || 0));
      
      const newQuestionsSummary = newQuestions.map((q, index) => ({
        questionNumber: q.question_number || (index + 1),
        loid: q.loid || "unknown",
        type: q.question_type || "multiple_choice",
        versionCount: 1, // New format doesn't have versions array
        preview: q.question_text 
          ? q.question_text.substring(0, 100) + "..."
          : `Question ${q.question_number || (index + 1)}`
      }));
      
      // Generate summary statistics
      const summary = {
        currentCount: currentQuestions.length,
        newCount: newQuestions.length,
        willBeAdded: Math.max(0, newQuestions.length - currentQuestions.length),
        willBeUpdated: Math.min(currentQuestions.length, newQuestions.length),
        willBeRemoved: Math.max(0, currentQuestions.length - newQuestions.length),
        totalAfterRefresh: newQuestions.length
      };
      
      res.json({
        questionSet: {
          id: questionSet.id,
          title: questionSet.title,
          externalId: questionSet.externalId
        },
        currentQuestions: currentQuestionsSummary,
        newQuestions: newQuestionsSummary,
        summary,
        bubbleData: bubbleQuestionSet
      });
      
    } catch (error) {
      console.error("Error fetching refresh comparison data:", error);
      res.status(500).json({ message: "Failed to fetch refresh comparison data" });
    }
  });

  // New endpoint to update a single question set from Bubble
  app.post("/api/admin/question-sets/:id/update-from-bubble", requireAdmin, async (req, res) => {
    try {
      const questionSetId = parseInt(req.params.id);
      
      if (isNaN(questionSetId)) {
        return res.status(400).json({ message: "Invalid question set ID" });
      }
      
      // Get the question set to find its external ID
      const questionSet = await storage.getQuestionSet(questionSetId);
      if (!questionSet) {
        return res.status(404).json({ message: "Question set not found" });
      }
      
      if (!questionSet.externalId) {
        return res.status(400).json({ message: "Question set has no Bubble ID associated" });
      }
      
      const bubbleApiKey = process.env.BUBBLE_API_KEY;
      if (!bubbleApiKey) {
        return res.status(500).json({ message: "Bubble API key not configured" });
      }
      
      // Fetch the specific question set from Bubble using its ID
      const url = `https://ti-content-repository.bubbleapps.io/version-test/api/1.1/obj/question_set/${questionSet.externalId}`;
      const headers = {
        "Authorization": `Bearer ${bubbleApiKey}`,
        "Content-Type": "application/json"
      };
      
      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        console.error(`Bubble API error: ${response.status} ${response.statusText}`);
        return res.status(500).json({ message: `Failed to fetch from Bubble: ${response.statusText}` });
      }
      
      const data = await response.json();
      const bubbleQuestionSet = data.response;
      
      if (!bubbleQuestionSet) {
        return res.status(404).json({ message: "Question set not found in Bubble" });
      }
      
      // Parse the content field to get questions
      let parsedQuestions: any[] = [];
      if (bubbleQuestionSet.content) {
        try {
          const contentJson = JSON.parse(bubbleQuestionSet.content);
          if (contentJson.questions && Array.isArray(contentJson.questions)) {
            parsedQuestions = contentJson.questions;
            
            // Log the first question to debug the structure
            if (parsedQuestions.length > 0) {
              console.log("📊 Sample question from Bubble (first question):");
              console.log("  Question type:", parsedQuestions[0].question_type || "not specified");
              console.log("  Question number:", parsedQuestions[0].question_number);
              console.log("  LOID:", parsedQuestions[0].loid);
              console.log("  Has blanks:", !!parsedQuestions[0].blanks);
              console.log("  Has drop_zones:", !!parsedQuestions[0].drop_zones);
              console.log("  Correct answer type:", typeof parsedQuestions[0].correct_answer);
            }
          }
        } catch (parseError) {
          console.error("Error parsing question content:", parseError);
        }
      }
      
      // Update the question set metadata
      await storage.updateQuestionSet(questionSetId, {
        title: bubbleQuestionSet.title || questionSet.title,
        description: bubbleQuestionSet.description || questionSet.description,
      });
      
      // Delete existing questions and versions to replace with updated ones
      await db.delete(questionVersions)
        .where(inArray(questionVersions.questionId, 
          db.select({ id: questions.id })
            .from(questions)
            .where(eq(questions.questionSetId, questionSetId))
        ));
      await db.delete(questions).where(eq(questions.questionSetId, questionSetId));
      
      // Import the updated questions
      if (parsedQuestions.length > 0) {
        console.log(`📥 Importing ${parsedQuestions.length} questions from Bubble...`);
        
        const questionImports = parsedQuestions.map((q: any, index: number) => {
          // Use the new JSON format fields directly
          const questionType = q.question_type || "multiple_choice";
          
          // Log question types to verify parsing
          if (index < 5) {  // Log first 5 questions for debugging
            console.log(`  Question ${q.question_number}: Type = ${questionType}, LOID = ${q.loid}`);
          }
          
          // Build the version object with all fields from the new format
          const versionData: any = {
            version_number: 1,
            topic_focus: bubbleQuestionSet.title || "General",
            question_text: q.question_text || "",
            question_type: questionType,
            answer_choices: q.answer_choices || [],
            correct_answer: q.correct_answer || "",
            acceptable_answers: q.acceptable_answers,
            case_sensitive: q.case_sensitive || false,
            allow_multiple: q.allow_multiple || false,
            matching_pairs: q.matching_pairs || null,
            correct_order: q.correct_order || null,
          };
          
          // Add question type specific fields
          if (questionType === "select_from_list" && q.blanks) {
            versionData.blanks = q.blanks;
          }
          
          if (questionType === "drag_and_drop") {
            if (q.drop_zones) {
              versionData.drop_zones = q.drop_zones;
            }
            // Store the correct_answer object as-is for drag_and_drop
            if (typeof q.correct_answer === 'object' && !Array.isArray(q.correct_answer)) {
              versionData.correct_answer = JSON.stringify(q.correct_answer);
            }
          }
          
          if (questionType === "multiple_response" && Array.isArray(q.correct_answer)) {
            // Store array as JSON string for multiple response
            versionData.correct_answer = JSON.stringify(q.correct_answer);
          }
          
          return {
            question_number: q.question_number || (index + 1),
            type: questionType,
            loid: q.loid || "unknown",
            versions: [versionData]
          };
        });
        
        await storage.importQuestions(questionSetId, questionImports);
        await storage.updateQuestionSetCount(questionSetId);
      }
      
      res.json({
        message: `Successfully updated question set with ${parsedQuestions.length} questions from Bubble`,
        questionCount: parsedQuestions.length
      });
      
    } catch (error) {
      console.error("Error updating question set from Bubble:", error);
      res.status(500).json({ message: "Failed to update question set from Bubble" });
    }
  });

  // Admin route to fetch all learning objects from Bubble.io
  app.get("/api/admin/bubble/learning-objects", requireAdmin, async (req, res) => {
    try {
      const bubbleApiKey = process.env.BUBBLE_API_KEY;
      
      if (!bubbleApiKey) {
        return res.status(500).json({ message: "Bubble API key not configured" });
      }

      
      const baseUrl = "https://ti-content-repository.bubbleapps.io/version-test/api/1.1/obj/learning_object";
      const headers = {
        "Authorization": `Bearer ${bubbleApiKey}`,
        "Content-Type": "application/json"
      };

      let allLearningObjects: any[] = [];
      let cursor = 0;
      const limit = 100; // Bubble API typically has a limit per request
      let hasMore = true;

      while (hasMore) {
        const url = `${baseUrl}?cursor=${cursor}&limit=${limit}`;
        const response = await fetch(url, { headers });
        
        if (!response.ok) {
          console.error(`❌ Bubble API error: ${response.status} ${response.statusText}`);
          throw new Error(`Bubble API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const results = data.response?.results || [];
        
        if (results.length > 0) {
          allLearningObjects = allLearningObjects.concat(results);
          cursor += results.length;
        }
        
        hasMore = results.length === limit && data.response?.remaining > 0;
      }

      
      // Fetch course mapping from Bubble

      const courseMap = new Map();
      const courseUrl = "https://ti-content-repository.bubbleapps.io/version-test/api/1.1/obj/course";
      const courseResponse = await fetch(courseUrl, { headers });
      
      if (courseResponse.ok) {
        const courseData = await courseResponse.json();
        const bubbleCourses = courseData.response?.results || [];
        
        // Map Bubble course IDs to course numbers
        for (const course of bubbleCourses) {
          if (course._id && course["course number"]) {
            courseMap.set(course._id, course["course number"]);
          }
        }

      }
      
      // Transform the learning objects to match our course materials schema
      const transformedMaterials = allLearningObjects.map(lo => {
        // Get course number from mapping or default
        let courseNumber = "Unknown Course";
        if (lo.course && courseMap.has(lo.course)) {
          courseNumber = courseMap.get(lo.course);
        }
        
        return {
          assignment: lo.title || lo.assignment || "Untitled",
          course: courseNumber,
          loid: lo.loid || "", // Use the actual loid field, not _id
          content: lo.content || lo.description || lo.body || ""
        };
      });

      res.json({
        count: allLearningObjects.length,
        learningObjects: transformedMaterials,
        raw: allLearningObjects // Include raw data for debugging
      });
    } catch (error) {
      console.error("Error fetching learning objects from Bubble:", error);
      res.status(500).json({ message: "Failed to fetch learning objects from Bubble repository" });
    }
  });

  // Admin route to import all learning objects from Bubble.io
  app.post("/api/admin/bubble/import-all-learning-objects", requireAdmin, async (req, res) => {
    try {
      const bubbleApiKey = process.env.BUBBLE_API_KEY;
      
      if (!bubbleApiKey) {
        return res.status(500).json({ message: "Bubble API key not configured" });
      }

      const startTime = Date.now();
      
      // First fetch all learning objects
      const baseUrl = "https://ti-content-repository.bubbleapps.io/version-test/api/1.1/obj/learning_object";
      const headers = {
        "Authorization": `Bearer ${bubbleApiKey}`,
        "Content-Type": "application/json"
      };

      let allLearningObjects: any[] = [];
      let cursor = 0;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        const url = `${baseUrl}?cursor=${cursor}&limit=${limit}`;
        const response = await fetch(url, { headers });
        
        if (!response.ok) {
          throw new Error(`Bubble API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const results = data.response?.results || [];
        
        if (results.length > 0) {
          allLearningObjects = allLearningObjects.concat(results);
          cursor += results.length;
        }
        
        hasMore = results.length === limit && data.response?.remaining > 0;
      }

      
      // Fetch course mapping from Bubble

      const courseMap = new Map();
      const courseUrl = "https://ti-content-repository.bubbleapps.io/version-test/api/1.1/obj/course";
      const courseResponse = await fetch(courseUrl, { headers });
      
      if (courseResponse.ok) {
        const courseData = await courseResponse.json();
        const bubbleCourses = courseData.response?.results || [];
        
        // Map Bubble course IDs to course numbers
        for (const course of bubbleCourses) {
          if (course._id && course["course number"]) {
            courseMap.set(course._id, course["course number"]);
          }
        }

      }
      
      // Transform and import the materials
      const materials = allLearningObjects.map(lo => {
        // Get course number from mapping or default
        let courseNumber = "Unknown Course";
        if (lo.course && courseMap.has(lo.course)) {
          courseNumber = courseMap.get(lo.course);
        }
        
        return {
          assignment: lo.title || lo.assignment || "Untitled",
          course: courseNumber,
          loid: lo.loid || "", // Use the actual loid field, not _id
          content: lo.content || lo.description || lo.body || ""
        };
      });

      // Import to database
      await storage.importCourseMaterials(materials);
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      const message = `Successfully imported ${materials.length} learning objects in ${duration}s`;
      
      res.json({ 
        message,
        count: materials.length,
        duration
      });
    } catch (error) {
      console.error("Error importing learning objects from Bubble:", error);
      res.status(500).json({ message: "Failed to import learning objects from Bubble repository" });
    }
  });

  // Admin route for importing course materials
  app.post("/api/admin/import-course-materials", requireAdmin, async (req, res) => {
    try {
      const { materials } = req.body;
      
      if (!Array.isArray(materials)) {
        return res.status(400).json({ message: "Materials must be an array" });
      }

      await storage.importCourseMaterials(materials);
      
      res.json({ 
        message: `Successfully imported ${materials.length} course materials`,
        count: materials.length 
      });
    } catch (error) {
      console.error("Error importing course materials:", error);
      res.status(500).json({ message: "Failed to import course materials" });
    }
  });

  // Route for direct feedback viewing (accessible to admins)
  app.get("/admin/feedback/:feedbackId", requireAdmin, async (req, res) => {
    try {
      const feedbackId = parseInt(req.params.feedbackId);
      
      if (isNaN(feedbackId)) {
        return res.status(400).send("Invalid feedback ID");
      }
      
      // Redirect to the admin dashboard with the feedback ID in the query params
      // This will open the admin dashboard and automatically show the feedback modal
      res.redirect(`/admin?tab=logs&subtab=feedback&feedbackId=${feedbackId}`);
    } catch (error) {
      console.error("Error redirecting to feedback:", error);
      res.status(500).send("Failed to load feedback");
    }
  });

  // Admin route for viewing course materials
  app.get("/api/admin/course-materials", requireAdmin, async (req, res) => {
    try {
      const materials = await db.select().from(courseMaterials).limit(100);
      res.json(materials);
    } catch (error) {
      console.error("Error fetching course materials:", error);
      res.status(500).json({ message: "Failed to fetch course materials" });
    }
  });

  // Admin route for updating course materials
  app.put("/api/admin/course-materials/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { assignment, course, loid, content } = req.body;
      
      if (!assignment || !course || !loid || !content) {
        return res.status(400).json({ message: "All fields are required" });
      }

      const updated = await db
        .update(courseMaterials)
        .set({ assignment, course, loid, content })
        .where(eq(courseMaterials.id, parseInt(id)))
        .returning();
      
      if (updated.length === 0) {
        return res.status(404).json({ message: "Course material not found" });
      }
      
      res.json(updated[0]);
    } catch (error) {
      console.error("Error updating course material:", error);
      res.status(500).json({ message: "Failed to update course material" });
    }
  });

  // Admin route for deleting course materials
  app.delete("/api/admin/course-materials/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      const deleted = await db
        .delete(courseMaterials)
        .where(eq(courseMaterials.id, parseInt(id)))
        .returning();
      
      if (deleted.length === 0) {
        return res.status(404).json({ message: "Course material not found" });
      }
      
      res.json({ message: "Course material deleted successfully" });
    } catch (error) {
      console.error("Error deleting course material:", error);
      res.status(500).json({ message: "Failed to delete course material" });
    }
  });



  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      // For now, return empty array as user management is basic
      // In a real implementation, you'd fetch all users from the database
      res.json([]);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Debug endpoint to check application status
  app.get("/api/debug/status", async (req, res) => {
    try {
      const status = await getDebugStatus();
      res.json(status);
    } catch (error) {
      console.error("Error getting debug status:", error);
      res.status(500).json({ 
        message: "Failed to get debug status", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Demo API endpoints - No authentication required
  // These endpoints provide read-only access to course data for demo purposes
  
  app.get("/api/demo/courses", async (req, res) => {
    try {
      const allCourses = await storage.getAllCourses();
      
      // Return all courses without deduplication since we now use mapping table
      const uniqueCourses = allCourses.filter(course => {
        // Special case: Show Test Course only to benn@modia.ai
        if (course.courseNumber === 'Test Course') {
          return req.user?.email === 'benn@modia.ai';
        }
        
        // Filter out test/invalid courses that don't follow CPCU or AIC naming pattern
        const hasStandardName = course.courseNumber.match(/^(CPCU|AIC)\s+\d+/) || 
                               (course.externalId && course.externalId.match(/(CPCU|AIC)\s+\d+/));
        return hasStandardName;
      });
      
      const coursesWithProgress = await Promise.all(
        uniqueCourses.map(async (course) => {
          // Get question sets for this course
          const questionSets = await storage.getQuestionSetsByCourse(course.id);
          const questionSetsWithCounts = await Promise.all(
            questionSets.map(async (questionSet) => {
              const questions = await storage.getQuestionsByQuestionSet(questionSet.id);
              return {
                ...questionSet,
                questionCount: questions.length,
              };
            })
          );

          // For demo, just return 0 progress
          return {
            ...course,
            progress: 0,
            questionSets: questionSetsWithCounts,
          };
        })
      );
      
      // Sort courses to show those with question sets first, then by course number
      coursesWithProgress.sort((a, b) => {
        // First priority: courses with question sets
        const aHasQuestionSets = a.questionSets && a.questionSets.length > 0;
        const bHasQuestionSets = b.questionSets && b.questionSets.length > 0;
        
        if (aHasQuestionSets && !bHasQuestionSets) return -1;
        if (!aHasQuestionSets && bHasQuestionSets) return 1;
        
        // Second priority: alphabetical by course number
        return a.courseNumber.localeCompare(b.courseNumber);
      });
      
      res.json(coursesWithProgress);
    } catch (error) {
      console.error("Error fetching demo courses:", error);
      res.status(500).json({ message: "Failed to fetch courses" });
    }
  });

  app.get("/api/demo/courses/by-external-id/:externalId", async (req, res) => {
    try {
      const { externalId } = req.params;
      
      if (!externalId) {
        return res.status(400).json({ message: "External ID is required" });
      }
      
      const course = await storage.getCourseByExternalId(externalId);
      
      if (!course) {
        return res.status(404).json({ message: `Course with external ID '${externalId}' not found` });
      }
      
      res.json(course);
    } catch (error) {
      console.error("Error fetching course by external ID:", error);
      res.status(500).json({ message: "Failed to fetch course" });
    }
  });

  app.get("/api/demo/courses/:id", async (req, res) => {
    try {
      const courseId = parseInt(req.params.id);
      
      if (isNaN(courseId)) {
        return res.status(400).json({ message: "Invalid course ID" });
      }
      
      const course = await storage.getCourse(courseId);
      
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }
      
      res.json(course);
    } catch (error) {
      console.error("Error fetching course:", error);
      res.status(500).json({ message: "Failed to fetch course" });
    }
  });

  app.get("/api/demo/courses/:courseId/question-sets", async (req, res) => {
    try {
      const courseId = parseInt(req.params.courseId);
      
      if (isNaN(courseId)) {
        return res.status(400).json({ message: "Invalid course ID" });
      }
      
      const questionSets = await storage.getQuestionSetsByCourse(courseId);
      
      // Add question counts to each question set
      const questionSetsWithCounts = await Promise.all(
        questionSets.map(async (questionSet) => {
          const questions = await storage.getQuestionsByQuestionSet(questionSet.id);
          return {
            ...questionSet,
            questionCount: questions.length,
          };
        })
      );
      
      res.json(questionSetsWithCounts);
    } catch (error) {
      console.error("Error fetching question sets:", error);
      res.status(500).json({ message: "Failed to fetch question sets" });
    }
  });

  app.get("/api/demo/question-sets/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid question set ID" });
      }
      
      const questionSet = await storage.getQuestionSet(id);
      
      if (!questionSet) {
        return res.status(404).json({ message: "Question set not found" });
      }
      
      res.json(questionSet);
    } catch (error) {
      console.error("Error fetching question set:", error);
      res.status(500).json({ message: "Failed to fetch question set" });
    }
  });

  app.get("/api/demo/questions/:questionSetId", async (req, res) => {
    try {
      const questionSetId = parseInt(req.params.questionSetId);
      
      if (isNaN(questionSetId)) {
        return res.status(400).json({ message: "Invalid question set ID" });
      }
      
      // Use optimized batch query instead of N+1 queries
      const questionsWithLatestVersions = await withCircuitBreaker(() => 
        batchFetchQuestionsWithVersions(questionSetId)
      );
      
      // Return in randomized order for demo
      const shuffled = [...questionsWithLatestVersions].sort(() => Math.random() - 0.5);
      
      res.json(shuffled);
    } catch (error) {
      console.error("Error fetching questions:", error);
      res.status(500).json({ message: "Failed to fetch questions" });
    }
  });

  // Demo answer submission - just returns success without storing
  app.post("/api/demo/question-sets/:questionSetId/answer", async (req, res) => {
    try {
      const { questionVersionId, answer } = req.body;
      
      // Just return a mock success response for demo
      res.json({
        success: true,
        isCorrect: Math.random() > 0.5, // Random for demo
        chosenAnswer: answer,
        message: "Demo mode - answers are not saved"
      });
    } catch (error) {
      console.error("Error in demo answer submission:", error);
      res.status(500).json({ message: "Failed to process answer" });
    }
  });

  // Demo chatbot endpoints - No authentication required
  // Initialize streaming for demo
  app.post("/api/demo/chatbot/stream-init", aiRateLimiter.middleware(), async (req, res) => {
    try {
      const { questionVersionId, chosenAnswer, userMessage, isMobile, conversationHistory } = req.body;
      
      // Use a demo user ID
      const userId = -1; // Demo user ID
      
      const questionVersion = await storage.getQuestionVersion(questionVersionId);
      if (!questionVersion) {
        return res.status(404).json({ message: "Question version not found" });
      }
      
      const settings = await storage.getAiSettings();
      
      // Generate a stream ID for this session
      const streamId = `demo_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // Initialize stream storage with correct structure
      activeStreams.set(streamId, {
        chunks: [],
        done: false,
        lastActivity: Date.now(),
        aborted: false,
        conversationHistory: conversationHistory || []
      });
      
      // Start async processing
      (async () => {
        const stream = activeStreams.get(streamId);
        if (!stream || stream.aborted) return;
        
        try {
          const aiSettings = await storage.getAiSettings();
          const activePrompt = await storage.getActivePromptVersion();
          
          let prompt;
          let systemMessage = undefined;
          
          if (userMessage) {
            // For follow-up messages, simply use the user's message as the prompt
            prompt = userMessage;
          } else {
            // Initial explanation with variable substitution
            systemMessage = activePrompt?.promptText || 
              `Write feedback designed to help students understand why answers to practice questions are correct or incorrect.

First, carefully review the assessment content:

<assessment_item>
{{QUESTION_TEXT}}
</assessment_item>

<answer_choices>
{{ANSWER_CHOICES}}
</answer_choices>

<selected_answer>
{{SELECTED_ANSWER}}
</selected_answer>

<correct_answer>
{{CORRECT_ANSWER}}
</correct_answer>

Remember, your goal is to support student comprehension through meaningful feedback that is positive and supportive.`;
            
            // Format answer choices as a list
            const formattedChoices = questionVersion.answerChoices ? questionVersion.answerChoices.join('\n') : '';
            
            // Ensure chosenAnswer is not empty or undefined
            const selectedAnswer = chosenAnswer && chosenAnswer.trim() !== '' ? chosenAnswer : "No answer was selected";
            
            // Substitute variables in the prompt
            systemMessage = systemMessage
              .replace(/\{\{QUESTION_TEXT\}\}/g, questionVersion.questionText)
              .replace(/\{\{ANSWER_CHOICES\}\}/g, formattedChoices)
              .replace(/\{\{SELECTED_ANSWER\}\}/g, selectedAnswer)
              .replace(/\{\{CORRECT_ANSWER\}\}/g, questionVersion.correctAnswer)
              .replace(/\{\{COURSE_MATERIAL\}\}/g, questionVersion.topicFocus || "No additional source material provided.");
            
            // For the initial message, the prompt is empty - the system message contains everything
            prompt = "Please provide feedback on my answer.";
            
            // Store the initial system message in conversation history
            if (stream.conversationHistory) {
              stream.conversationHistory.push({ role: "system", content: systemMessage });
            }
          }
          
          // For mobile, add instruction to be concise
          if (isMobile) {
            systemMessage = (systemMessage || "") + "\n\nIMPORTANT: The user is on a mobile device. Keep your response concise and well-formatted for mobile viewing. Use short paragraphs and clear structure.";
          }
          
          // Use the streaming function for real-time responses like authenticated users
          await streamOpenRouterToBuffer(prompt, aiSettings, streamId, userId, systemMessage, stream.conversationHistory);
          
          // After successful response, update conversation history
          if (!stream.error && stream.chunks && stream.chunks.length > 0) {
            const aiResponse = stream.chunks.join('');
            if (stream.conversationHistory) {
              // Add user message to history (if not already added)
              if (!userMessage || stream.conversationHistory[stream.conversationHistory.length - 1]?.content !== prompt) {
                stream.conversationHistory.push({ role: "user", content: prompt });
              }
              // Add AI response to history
              stream.conversationHistory.push({ role: "assistant", content: aiResponse });
            }
          }
          
        } catch (error) {
          console.error("Error in demo chatbot stream processing:", error);
          if (stream) {
            stream.error = error instanceof Error ? error.message : "Unknown error occurred";
            stream.done = true;
            stream.lastActivity = Date.now();
          }
        }
      })();
      
      res.json({ streamId });
    } catch (error) {
      console.error("Error initializing demo chatbot stream:", error);
      res.status(500).json({ message: "Failed to initialize chat stream" });
    }
  });

  // Get stream chunk for demo
  app.get("/api/demo/chatbot/stream-chunk/:streamId", async (req, res) => {
    const streamId = req.params.streamId;
    const cursor = parseInt(req.query.cursor as string) || 0;
    const stream = activeStreams.get(streamId);
    
    if (!stream) {
      return res.status(404).json({ error: "Stream not found" });
    }
    
    // Check if stream was aborted
    if (stream.aborted) {
      return res.json({
        content: "",
        newContent: "",
        cursor: 0,
        done: true,
        error: "Stream was aborted"
      });
    }
    
    // Update activity timestamp for active streams
    if (!stream.done) {
      stream.lastActivity = Date.now();
    }
    
    // Get full accumulated content
    const fullContent = stream.chunks.join('');
    
    // Return only new content since cursor position
    const newContent = cursor < fullContent.length ? fullContent.slice(cursor) : '';
    
    res.json({
      content: fullContent, // Still send full content for compatibility
      newContent, // New incremental content
      cursor: fullContent.length, // New cursor position
      done: stream.done,
      error: stream.error
    });
    
    // Clean up finished streams
    if (stream.done) {
      setTimeout(() => {
        activeStreams.delete(streamId);
      }, 2000);
    }
  });

  // Abort stream for demo
  app.post("/api/demo/chatbot/stream-abort/:streamId", async (req, res) => {
    const streamId = req.params.streamId;
    
    // Clean up the stream
    const stream = activeStreams.get(streamId);
    if (stream) {
      stream.done = true;
      stream.error = "Stream aborted by user";
      // Clean up after a delay
      setTimeout(() => {
        activeStreams.delete(streamId);
      }, 5000);
    }
    
    res.json({ success: true });
  });

  // Demo feedback endpoint - allows demo users to submit feedback
  app.post("/api/demo/feedback", async (req, res) => {
    try {
      const feedbackSchema = z.object({
        type: z.enum(["positive", "negative"]),
        message: z.string().optional(),
        messageId: z.string(),
        questionVersionId: z.number().optional(),
        conversation: z.array(z.object({
          id: z.string(),
          content: z.string(),
          role: z.enum(["user", "assistant"]),
        })).optional(),
        timestamp: z.string(),
      });

      const parsed = feedbackSchema.parse(req.body);
      
      // For demo mode, we store feedback with a special demo user ID (-1)
      await storage.createChatbotFeedback({
        userId: -1, // Demo user ID
        messageId: parsed.messageId,
        feedbackType: parsed.type,
        feedbackMessage: parsed.message || null,
        questionVersionId: parsed.questionVersionId || null,
        conversation: parsed.conversation || null,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error saving demo feedback:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid feedback data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to save feedback" });
    }
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}
