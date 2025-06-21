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

// Type assertion helper for authenticated requests
function assertAuthenticated(req: Request): asserts req is Request & { user: NonNullable<Express.User> } {
  if (!req.isAuthenticated() || !req.user) {
    throw new Error('Authentication required');
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
  } else if (modelName.includes('claude-3-sonnet') || modelName.includes('claude-sonnet-4')) {
    maxTokens = 4096;
  } else if (modelName.includes('gpt-3.5-turbo')) {
    maxTokens = 4096;
  } else if (modelName.includes('gpt-4')) {
    maxTokens = 8192;
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
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("OpenRouter response:", JSON.stringify(data, null, 2));
    
    if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      console.error("Invalid response structure:", data);
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
    console.error("OpenRouter error:", error);
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
const activeStreams = new Map<string, { chunks: string[], done: boolean, error?: string }>();

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
): Promise<void> {
  console.log("Starting streamOpenRouterToBuffer with prompt length:", prompt.length);
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  const stream = activeStreams.get(streamId);
  if (!stream) {
    console.warn(`Stream ${streamId} not found in activeStreams`);
    return;
  }
  
  if (!apiKey) {
    console.error("No OpenRouter API key found");
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
  }

  try {
    const messages = [];
    if (systemMessage) {
      messages.push({ role: "system", content: systemMessage });
    }
    messages.push({ role: "user", content: prompt });

    console.log("Making OpenRouter API request with model:", modelName);
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

    console.log("OpenRouter response status:", response.status);
    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API error:", response.status, errorText);
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    let fullResponse = "";
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error("No response stream available");
    }

    console.log("Starting to read stream...");
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        console.log("Stream reading completed");
        break;
      }
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          
          if (data === '[DONE]') {
            console.log("Received [DONE] signal");
            break;
          }
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            
            if (content && typeof content === 'string') {
              fullResponse += content;
              // Store accumulated content, not individual chunks
              stream.chunks = [fullResponse];
              console.log("Added content chunk to buffer:", content.substring(0, 50) + "...");
            }
          } catch (e) {
            // Skip invalid JSON chunks - this is normal for streaming
            if (data.trim() && !data.includes('ping')) {
              console.log("Skipping invalid JSON chunk:", data.substring(0, 100));
            }
          }
        }
      }
    }

    const responseTime = Date.now() - startTime;

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
  
  // Mark stream as done
  stream.done = true;
  console.log("streamOpenRouterToBuffer function completed");
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
    // Allow demo user or users with admin flag
    if (!req.user.isAdmin && req.user.email !== "demo@example.com") {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  };

  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated() || !req.user) {
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

  // Question set practice routes
  app.get("/api/question-sets/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
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

  app.get("/api/questions/:questionSetId", requireAuth, async (req, res) => {
    try {
      const questionSetId = parseInt(req.params.questionSetId);
      const questions = await withCircuitBreaker(() => storage.getQuestionsByQuestionSet(questionSetId));
      
      // Get the latest version for each question with circuit breaker protection
      const questionsWithLatestVersions = await Promise.all(
        questions.map(async (question) => {
          try {
            const versions = await withCircuitBreaker(() => storage.getQuestionVersionsByQuestion(question.id));
            const latestVersion = versions.length > 0 ? versions[versions.length - 1] : null;
            return {
              ...question,
              latestVersion
            };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.warn(`Failed to fetch versions for question ${question.id}:`, errorMessage);
            // Return question without version if version fetch fails
            return {
              ...question,
              latestVersion: null
            };
          }
        })
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
      
      // Debug incoming request
      console.log("🔥🔥🔥 STREAM INIT DEBUG START 🔥🔥🔥");
      console.log("Full request body:", JSON.stringify(req.body, null, 2));
      console.log("chosenAnswer from request:", JSON.stringify(chosenAnswer), "type:", typeof chosenAnswer);
      console.log("🔥🔥🔥 STREAM INIT DEBUG END 🔥🔥🔥");
      const streamId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      
      // Clean up any existing streams for this user to prevent conflicts
      const userId = req.user!.id;
      for (const [existingStreamId, stream] of activeStreams.entries()) {
        if (existingStreamId.includes(userId.toString())) {
          activeStreams.delete(existingStreamId);
        }
      }
      
      // Initialize stream
      activeStreams.set(streamId, { chunks: [], done: false });
      
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
    const stream = activeStreams.get(streamId);
    
    if (!stream) {
      return res.status(404).json({ error: "Stream not found" });
    }
    
    // Return accumulated content
    const content = stream.chunks.join('');
    
    // Only clear chunks when stream is complete
    if (stream.done && content.length > 0) {
      stream.chunks = [];
    }
    
    res.json({
      content,
      done: stream.done,
      error: stream.error
    });
    
    // Clean up finished streams
    if (stream.done) {
      activeStreams.delete(streamId);
    }
  });

  // Background stream processing
  async function processStreamInBackground(streamId: string, questionVersionId: number, chosenAnswer: string, userMessage: string | undefined, userId: number) {
    try {
      const stream = activeStreams.get(streamId);
      if (!stream) return;

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
        console.log("🔄 STREAMING FOLLOW-UP - Selected answer:", JSON.stringify(selectedAnswerText));
        
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
        
        // Debug logging for variable substitution
        console.log("🚀🚀🚀 STREAMING VARIABLE SUBSTITUTION DEBUG 🚀🚀🚀");
        console.log("chosenAnswer:", JSON.stringify(chosenAnswer), "type:", typeof chosenAnswer, "length:", chosenAnswer?.length);
        
        // Ensure chosenAnswer is not empty or undefined
        const selectedAnswer = chosenAnswer && chosenAnswer.trim() !== '' ? chosenAnswer : "No answer was selected";
        console.log("selectedAnswer after processing:", JSON.stringify(selectedAnswer));

        // Substitute variables in the prompt
        systemPrompt = systemPrompt
          .replace(/\{\{QUESTION_TEXT\}\}/g, questionVersion.questionText)
          .replace(/\{\{ANSWER_CHOICES\}\}/g, formattedChoices)
          .replace(/\{\{SELECTED_ANSWER\}\}/g, selectedAnswer)
          .replace(/\{\{CORRECT_ANSWER\}\}/g, questionVersion.correctAnswer)
          .replace(/\{\{COURSE_MATERIAL\}\}/g, sourceMaterial);
        
        // Verify substitution worked
        console.log("After substitution - contains {{SELECTED_ANSWER}}:", systemPrompt.includes("{{SELECTED_ANSWER}}"));
        console.log("Final prompt snippet with selected answer:", systemPrompt.substring(systemPrompt.indexOf('<selected_answer>'), systemPrompt.indexOf('</selected_answer>') + 18));
        console.log("🚀🚀🚀 END STREAMING SUBSTITUTION DEBUG 🚀🚀🚀");
        
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

        // Debug logging for variable substitution
        console.log("=== NON-STREAMING VARIABLE SUBSTITUTION DEBUG ===");
        console.log("chosenAnswer:", JSON.stringify(chosenAnswer), "type:", typeof chosenAnswer, "length:", chosenAnswer?.length);
        
        // Ensure chosenAnswer is not empty or undefined
        const selectedAnswer = chosenAnswer && chosenAnswer.trim() !== '' ? chosenAnswer : "No answer was selected";
        console.log("selectedAnswer after processing:", JSON.stringify(selectedAnswer));

        // Substitute variables in the prompt
        systemPrompt = systemPrompt
          .replace(/\{\{QUESTION_TEXT\}\}/g, questionVersion.questionText)
          .replace(/\{\{ANSWER_CHOICES\}\}/g, formattedChoices)
          .replace(/\{\{SELECTED_ANSWER\}\}/g, selectedAnswer)
          .replace(/\{\{CORRECT_ANSWER\}\}/g, questionVersion.correctAnswer)
          .replace(/\{\{COURSE_MATERIAL\}\}/g, sourceMaterial);
        
        // Verify substitution worked
        console.log("After substitution - contains {{SELECTED_ANSWER}}:", systemPrompt.includes("{{SELECTED_ANSWER}}"));
        console.log("=== END NON-STREAMING SUBSTITUTION DEBUG ===");
        
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



  const httpServer = createServer(app);
  return httpServer;
}
