import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { z } from "zod";
import { 
  insertCourseSchema, insertQuestionSetSchema, insertPracticeTestSchema, insertAiSettingsSchema,
  insertPromptVersionSchema, questionImportSchema, insertUserAnswerSchema, courseMaterials, type QuestionImport,
  promptVersions 
} from "@shared/schema";
import { db } from "./db";
import { withRetry } from "./utils/db-retry";
import { withCircuitBreaker } from "./utils/connection-pool";
import { eq, sql, desc, asc } from "drizzle-orm";
import { batchFetchQuestionsWithVersions } from "./utils/batch-queries";
import { getDebugStatus } from "./debug-status";

// Type assertion helper for authenticated requests
function assertAuthenticated(req: Request): asserts req is Request & { user: NonNullable<Express.User> } {
  if (!req.isAuthenticated() || !req.user) {
    const error = new Error('Authentication required') as any;
    error.status = 401;
    throw error;
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
  
  // Set max tokens based on model
  let maxTokens = 4096; // Default fallback
  if (modelName.includes('claude-3-haiku')) {
    maxTokens = 4096;
  } else if (modelName.includes('claude-3-sonnet') || modelName.includes('claude-3-opus')) {
    maxTokens = 4096;
  } else if (modelName.includes('claude-sonnet-4') || modelName.includes('claude-opus-4')) {
    maxTokens = 4096;
  } else if (modelName.includes('gpt-3.5-turbo')) {
    maxTokens = 4096;
  } else if (modelName.includes('gpt-4')) {
    maxTokens = 8192;
  } else if (modelName.includes('gemini-2.5-flash') || modelName.includes('gemini-2.5-pro')) {
    maxTokens = 8192; // Gemini models support up to 8192 tokens
  }

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
        "HTTP-Referer": process.env.REPLIT_DOMAINS?.split(',')[0] || "http://localhost:5000",
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
      console.error(`OpenRouter API error details (non-streaming):`, {
        status: response.status,
        statusText: response.statusText,
        errorText,
        headers: Object.fromEntries(response.headers.entries()),
        apiKeyPresent: !!apiKey,
        apiKeyLength: apiKey?.length || 0
      });
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
      console.error("Failed to log chatbot interaction:", logError);
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
      console.error("Failed to log chatbot error:", logError);
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
  aborted?: boolean 
}>();

// Heartbeat interval to detect stalled streams
const STREAM_HEARTBEAT_INTERVAL = 30000; // 30 seconds
const STREAM_TIMEOUT = 120000; // 2 minutes

// Start heartbeat monitor for streams
setInterval(() => {
  const now = Date.now();
  activeStreams.forEach((stream, streamId) => {
    if (!stream.done && !stream.aborted && (now - stream.lastActivity) > STREAM_TIMEOUT) {
      console.warn(`Stream ${streamId} timed out - marking as done`);
      stream.error = "Stream timed out. Please try again.";
      stream.done = true;
    }
  });
}, STREAM_HEARTBEAT_INTERVAL);

// Cleanup function to prevent memory leaks
function cleanupStream(streamId: string) {
  const stream = activeStreams.get(streamId);
  if (stream) {
    stream.chunks = [];
    activeStreams.delete(streamId);
  }
}

// Streaming OpenRouter integration for buffer approach
async function streamOpenRouterToBuffer(
  prompt: string, 
  settings: any, 
  streamId: string, 
  userId?: number, 
  systemMessage?: string
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
  
  let maxTokens = 4096;
  if (modelName.includes('claude-3-haiku')) {
    maxTokens = 4096;
  } else if (modelName.includes('claude-3-sonnet') || modelName.includes('claude-sonnet-4')) {
    maxTokens = 4096;
  } else if (modelName.includes('gpt-3.5-turbo')) {
    maxTokens = 4096;
  } else if (modelName.includes('gpt-4')) {
    maxTokens = 8192;
  } else if (modelName.includes('gemini-2.5-flash') || modelName.includes('gemini-2.5-pro')) {
    maxTokens = 8192; // Gemini models support up to 8192 tokens
  }

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
        "HTTP-Referer": process.env.REPLIT_DOMAINS?.split(',')[0] || "http://localhost:5000",
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
      console.error(`OpenRouter API error details:`, {
        status: response.status,
        statusText: response.statusText,
        errorText,
        headers: Object.fromEntries(response.headers.entries()),
        apiKeyPresent: !!apiKey,
        apiKeyLength: apiKey?.length || 0
      });
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
    
    while (true) {
      // Check if stream was aborted
      if (stream.aborted) {
        console.log(`Stream ${streamId} aborted during processing`);
        reader.cancel();
        break;
      }
      
      // Check if stream has been running too long
      if (Date.now() - streamStartTime > STREAM_MAX_DURATION) {
        console.warn(`Stream ${streamId} exceeded max duration of ${STREAM_MAX_DURATION}ms`);
        stream.error = "Response took too long. Please try again.";
        reader.cancel();
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
              console.log(`Stream ${streamId} finished with reason: ${finishReason}`);
              if (finishReason === 'length') {
                console.warn(`Stream ${streamId} hit max token limit`);
              }
            }
          } catch (e) {
            // Log parsing errors for debugging
            if (data && data !== '') {
              console.warn(`Failed to parse streaming chunk: ${e.message}, data: ${data.substring(0, 100)}`);
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
          console.warn(`Failed to parse final buffer: ${e.message}`);
        }
      }
    }

    const responseTime = Date.now() - startTime;
    
    // Log stream completion details
    console.log(`Stream ${streamId} completed:`, {
      responseLength: fullResponse.length,
      responseTime: `${responseTime}ms`,
      modelName,
      lastChars: fullResponse.slice(-50), // Last 50 chars to see if it was cut off
    });

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
      console.error("Failed to log chatbot interaction:", logError);
    }
    
    // Mark stream as done after successful completion
    stream.done = true;

  } catch (error) {
    console.error("OpenRouter streaming error:", error);
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
      console.error("Failed to log chatbot error:", logError);
    }
  }

  
  // Cleanup stream after 5 minutes to prevent memory leaks
  setTimeout(() => {
    cleanupStream(streamId);
  }, 5 * 60 * 1000);
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
          sessionId: req.sessionID,
          userAgent: req.headers['user-agent']?.slice(0, 50),
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
      const courses = await storage.getAllCourses();
      const coursesWithProgress = await Promise.all(
        courses.map(async (course) => {
          const practiceTests = await storage.getPracticeTestsByCourse(course.id);
          const testsWithProgress = await Promise.all(
            practiceTests.map(async (test) => {
              const testProgress = await storage.getUserTestProgress(req.user!.id, test.id);
              return {
                ...test,
                ...testProgress,
              };
            })
          );

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

          // Calculate progress based on the most recent test run instead of overall course progress
          let progressPercentage = 0;
          if (testsWithProgress.length > 0) {
            const mostRecentTest = testsWithProgress[0]; // Assuming first test is the main one
            if (mostRecentTest.testRun) {
              const answers = await storage.getUserAnswersByTestRun(mostRecentTest.testRun.id);
              const totalQuestionsInTest = mostRecentTest.testRun.questionOrder?.length || 85;
              progressPercentage = Math.round((answers.length / totalQuestionsInTest) * 100);
            }
          }

          return {
            ...course,
            progress: progressPercentage,
            practiceTests: testsWithProgress,
            questionSets: questionSetsWithCounts,
          };
        })
      );
      
      res.json(coursesWithProgress);
    } catch (error) {
      console.error("Error fetching courses:", error);
      res.status(500).json({ message: "Failed to fetch courses" });
    }
  });

  app.get("/api/courses/:id", requireAuth, async (req, res) => {
    try {
      const courseId = parseInt(req.params.id);
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

  // Public endpoint for getting question sets by course ID
  app.get("/api/courses/:courseId/question-sets", requireAuth, async (req, res) => {
    try {
      const courseId = parseInt(req.params.courseId);
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
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid question set ID" });
      }
      
      const questionSet = await withCircuitBreaker(() => storage.getQuestionSet(id));
      
      if (!questionSet) {
        return res.status(404).json({ message: "Question set not found" });
      }
      
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

  app.post("/api/question-sets/:id/answer", requireAuth, async (req, res) => {
    try {
      const questionSetId = parseInt(req.params.id);
      const { questionVersionId, answer } = req.body;
      
      const questionVersion = await storage.getQuestionVersion(questionVersionId);
      if (!questionVersion) {
        return res.status(404).json({ message: "Question version not found" });
      }
      
      const isCorrect = answer === questionVersion.correctAnswer;
      
      res.json({
        isCorrect,
        correctAnswer: questionVersion.correctAnswer,
        chosenAnswer: answer
      });
    } catch (error) {
      console.error("Error submitting answer:", error);
      res.status(500).json({ message: "Failed to submit answer" });
    }
  });

  // Practice test routes
  app.post("/api/courses/:courseId/practice-tests", requireAdmin, async (req, res) => {
    try {
      const courseId = parseInt(req.params.courseId);
      const testData = insertPracticeTestSchema.parse({ ...req.body, courseId });
      const test = await storage.createPracticeTest(testData);
      res.status(201).json(test);
    } catch (error) {
      console.error("Error creating practice test:", error);
      res.status(400).json({ message: "Invalid practice test data" });
    }
  });

  // Test run routes
  app.post("/api/practice-tests/:testId/start", requireAuth, async (req, res) => {
    try {
      const testId = parseInt(req.params.testId);
      const practiceTest = await storage.getPracticeTest(testId);
      
      if (!practiceTest) {
        return res.status(404).json({ message: "Practice test not found" });
      }

      // Get all questions for the course through question sets
      const questionSets = await storage.getQuestionSetsByCourse(practiceTest.courseId);
      let allQuestions = [];
      for (const questionSet of questionSets) {
        const questions = await storage.getQuestionsByQuestionSet(questionSet.id);
        allQuestions.push(...questions);
      }
      
      if (allQuestions.length < 85) {
        return res.status(400).json({ message: "Not enough questions available for this test" });
      }

      // Shuffle questions and select random versions
      const shuffledQuestions = allQuestions.sort(() => Math.random() - 0.5).slice(0, 85);
      const questionOrder = [];

      for (const question of shuffledQuestions) {
        const versions = await storage.getQuestionVersionsByQuestion(question.id);
        if (versions.length > 0) {
          const randomVersion = versions[Math.floor(Math.random() * versions.length)];
          questionOrder.push(randomVersion.id);
        }
      }

      const testRun = await storage.createUserTestRun({
        userId: req.user!.id,
        practiceTestId: testId,
        questionOrder,
      });

      res.status(201).json(testRun);
    } catch (error) {
      console.error("Error starting test:", error);
      res.status(500).json({ message: "Failed to start test" });
    }
  });

  // Restart practice test endpoint
  app.post("/api/practice-tests/:testId/restart", requireAuth, async (req, res) => {
    try {
      const testId = parseInt(req.params.testId);
      const practiceTest = await storage.getPracticeTest(testId);
      
      if (!practiceTest) {
        return res.status(404).json({ message: "Practice test not found" });
      }

      // Get all questions for the course through question sets
      const questionSets = await storage.getQuestionSetsByCourse(practiceTest.courseId);
      let allQuestions = [];
      for (const questionSet of questionSets) {
        const questions = await storage.getQuestionsByQuestionSet(questionSet.id);
        allQuestions.push(...questions);
      }
      
      if (allQuestions.length < 85) {
        return res.status(400).json({ message: "Not enough questions available for this test" });
      }

      // Shuffle questions and select random versions (same logic as start)
      const shuffledQuestions = allQuestions.sort(() => Math.random() - 0.5).slice(0, 85);
      const questionOrder = [];

      for (const question of shuffledQuestions) {
        const versions = await storage.getQuestionVersionsByQuestion(question.id);
        if (versions.length > 0) {
          const randomVersion = versions[Math.floor(Math.random() * versions.length)];
          questionOrder.push(randomVersion.id);
        }
      }

      // Create a new test run (this effectively restarts the test)
      const testRun = await storage.createUserTestRun({
        userId: req.user!.id,
        practiceTestId: testId,
        questionOrder,
      });

      res.status(201).json(testRun);
    } catch (error) {
      console.error("Error restarting test:", error);
      res.status(500).json({ message: "Failed to restart test" });
    }
  });

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
      const practiceTest = await storage.getPracticeTest(testRun.practiceTestId);
      
      res.json({
        ...testRun,
        answers,
        practiceTest,
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
  app.post("/api/chatbot/simple-response", requireAuth, async (req, res) => {
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
  app.post("/api/chatbot/stream-init", requireAuth, async (req, res) => {
    // Initialize streaming chatbot response
    
    try {
      const { questionVersionId, chosenAnswer, userMessage } = req.body;
      

      const streamId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      
      // Clean up any existing streams for this user to prevent conflicts
      const userId = req.user!.id;
      const streamEntries = Array.from(activeStreams.entries());
      for (const [existingStreamId, stream] of streamEntries) {
        if (existingStreamId.includes(userId.toString())) {
          activeStreams.delete(existingStreamId);
        }
      }
      
      // Initialize stream with timestamp
      activeStreams.set(streamId, { 
        chunks: [], 
        done: false, 
        lastActivity: Date.now(),
        aborted: false 
      });
      
      // Start background processing
      processStreamInBackground(streamId, questionVersionId, chosenAnswer, userMessage, req.user!.id);
      
      res.json({ streamId });
    } catch (error) {
      console.error("Error initializing stream:", error);
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
    
    res.json({
      content: fullContent, // Still send full content for compatibility
      newContent, // New incremental content
      cursor: fullContent.length, // New cursor position
      done: stream.done,
      error: stream.error
    });
    
    // Clean up finished streams
    if (stream.done && !stream.error) {
      // Clear chunks after sending final response
      setTimeout(() => {
        cleanupStream(streamId);
      }, 2000); // Slightly longer delay to ensure client gets final response
    }
  });

  // Abort stream endpoint
  app.post("/api/chatbot/stream-abort/:streamId", requireAuth, async (req, res) => {
    const streamId = req.params.streamId;
    const stream = activeStreams.get(streamId);
    
    if (stream) {
      stream.aborted = true;
      stream.done = true;
      stream.error = "Stream aborted by user";
      console.log(`Stream ${streamId} aborted by user`);
    }
    
    res.json({ success: true });
  });

  // Background stream processing
  async function processStreamInBackground(streamId: string, questionVersionId: number, chosenAnswer: string, userMessage: string | undefined, userId: number) {
    try {
      const stream = activeStreams.get(streamId);
      if (!stream || stream.aborted) return;

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
      }

      const aiSettings = await storage.getAiSettings();
      const activePrompt = await storage.getActivePromptVersion();
      
      // Get source material for both initial and follow-up responses
      let sourceMaterial = questionVersion.topicFocus || "No additional source material provided.";
      
      if (courseMaterial) {
        sourceMaterial = courseMaterial.content;
      }
      
      let prompt;
      if (userMessage) {
        // Follow-up question with course material context and selected answer
        const selectedAnswerText = chosenAnswer && chosenAnswer.trim() !== '' ? chosenAnswer : "No answer was selected";
        console.log("🔄 STREAMING FOLLOW-UP - User message:", JSON.stringify(userMessage));
        console.log("🔄 STREAMING FOLLOW-UP - Selected answer:", JSON.stringify(selectedAnswerText));
        
        prompt = `You are an AI tutor helping a student who just completed a practice question. The student has sent you this message: "${userMessage}"

Previous context:
- Question: "${questionVersion.questionText}"
- Answer choices: ${questionVersion.answerChoices.join(', ')}
- Student selected: ${selectedAnswerText}
- Correct answer: ${questionVersion.correctAnswer}

Relevant course material:
${sourceMaterial}

Please respond directly to the student's message in a helpful, conversational way. If they're saying thank you, acknowledge it. If they're asking a follow-up question, answer it using the course material. Keep your response natural and engaging.`;
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
        

        
        prompt = systemPrompt;
      }

      // Call OpenRouter with streaming
      await streamOpenRouterToBuffer(prompt, aiSettings, streamId, userId, activePrompt?.promptText);
      
    } catch (error) {
      console.error("Background processing error:", error);
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
      const { questionVersionId, chosenAnswer, userMessage } = req.body;
      
      const questionVersion = await storage.getQuestionVersion(questionVersionId);
      if (!questionVersion) {
        return res.status(404).json({ message: "Question not found" });
      }

      // Get the base question to access LOID
      const baseQuestion = await storage.getQuestion(questionVersion.questionId);
      let courseMaterial = null;
      
      if (baseQuestion?.loid) {
        courseMaterial = await storage.getCourseMaterialByLoid(baseQuestion.loid);
      }

      const aiSettings = await storage.getAiSettings();
      const activePrompt = await storage.getActivePromptVersion();
      
      // Get source material for both initial and follow-up responses
      let sourceMaterial = questionVersion.topicFocus || "No additional source material provided.";
      
      if (courseMaterial) {
        sourceMaterial = courseMaterial.content;
      }
      
      let prompt;
      if (userMessage) {
        // Follow-up question with course material context and selected answer
        const selectedAnswerText = chosenAnswer && chosenAnswer.trim() !== '' ? chosenAnswer : "No answer was selected";
        console.log("🔄 NON-STREAMING FOLLOW-UP - Selected answer:", JSON.stringify(selectedAnswerText));
        
        prompt = `${userMessage}

Context: Question was "${questionVersion.questionText}" with choices ${questionVersion.answerChoices.join(', ')}. 
Student selected: ${selectedAnswerText}
The correct answer is ${questionVersion.correctAnswer}.

Relevant course material:
${sourceMaterial}

Please provide a helpful response based on the course material above, keeping in mind what the student selected.`;
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

      res.json(newPrompt[0]);
    } catch (error) {
      console.error("Error updating active prompt:", error);
      res.status(500).json({ message: "Failed to update active prompt" });
    }
  });

  // Admin routes
  app.get("/api/admin/courses", requireAdmin, async (req, res) => {
    try {
      const courses = await storage.getAllCourses();
      const coursesWithStats = await Promise.all(
        courses.map(async (course) => {
          const practiceTests = await storage.getPracticeTestsByCourse(course.id);
          const questionSets = await storage.getQuestionSetsByCourse(course.id);
          
          // Count total questions across all question sets
          let totalQuestions = 0;
          for (const questionSet of questionSets) {
            const questions = await storage.getQuestionsByQuestionSet(questionSet.id);
            totalQuestions += questions.length;
          }
          
          return {
            ...course,
            testCount: practiceTests.length,
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

  // Admin route for importing course materials
  app.post("/api/admin/import-course-materials", requireAdmin, async (req, res) => {
    try {
      const { materials } = req.body;
      
      if (!Array.isArray(materials)) {
        return res.status(400).json({ message: "Materials must be an array" });
      }

      console.log(`Importing ${materials.length} course materials...`);
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

  app.get("/api/admin/practice-tests", requireAdmin, async (req, res) => {
    try {
      const courses = await storage.getAllCourses();
      let allPracticeTests = [];
      
      for (const course of courses) {
        const practiceTests = await storage.getPracticeTestsByCourse(course.id);
        const testsWithCourse = practiceTests.map(test => ({
          ...test,
          courseName: course.title
        }));
        allPracticeTests.push(...testsWithCourse);
      }
      
      res.json(allPracticeTests);
    } catch (error) {
      console.error("Error fetching practice tests:", error);
      res.status(500).json({ message: "Failed to fetch practice tests" });
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
