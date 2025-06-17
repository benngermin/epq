import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { z } from "zod";
import { 
  insertCourseSchema, insertQuestionSetSchema, insertPracticeTestSchema, insertAiSettingsSchema,
  questionImportSchema, insertUserAnswerSchema, type QuestionImport 
} from "@shared/schema";

// OpenRouter integration
async function callOpenRouter(prompt: string, settings: any): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY || settings?.apiKey;
  
  if (!apiKey) {
    return "I'm sorry, but the AI assistant is not configured. Please contact your administrator to set up the OpenRouter API key.";
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.REPLIT_DOMAINS?.split(',')[0] || "http://localhost:5000",
      },
      body: JSON.stringify({
        model: settings?.modelName || "anthropic/claude-3-sonnet",
        messages: [{ role: "user", content: prompt }],
        temperature: (settings?.temperature || 70) / 100,
        max_tokens: settings?.maxTokens || 150,
        top_p: (settings?.topP || 100) / 100,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";
  } catch (error) {
    console.error("OpenRouter error:", error);
    return "I'm sorry, there was an error connecting to the AI service. Please try again later.";
  }
}

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Middleware to check admin access
  const requireAdmin = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }
    // Allow demo user or users with admin flag
    if (!req.user.isAdmin && req.user.email !== "demo@example.com") {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  };

  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
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
              const testProgress = await storage.getUserTestProgress(req.user.id, test.id);
              return {
                ...test,
                ...testProgress,
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
          };
        })
      );
      
      res.json(coursesWithProgress);
    } catch (error) {
      console.error("Error fetching courses:", error);
      res.status(500).json({ message: "Failed to fetch courses" });
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
        userId: req.user.id,
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
        userId: req.user.id,
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
      if (testRun.userId !== req.user.id && !req.user.isAdmin) {
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

      if (testRun.userId !== req.user.id && !req.user.isAdmin) {
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

      if (testRun.userId !== req.user.id && !req.user.isAdmin) {
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

      if (testRun.userId !== req.user.id) {
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

      if (testRun.userId !== req.user.id) {
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

  // AI chatbot route
  app.post("/api/chatbot", requireAuth, async (req, res) => {
    try {
      const { questionVersionId, chosenAnswer, userMessage } = req.body;
      
      const questionVersion = await storage.getQuestionVersion(questionVersionId);
      if (!questionVersion) {
        return res.status(404).json({ message: "Question not found" });
      }

      const aiSettings = await storage.getAiSettings();
      
      let prompt;
      if (userMessage) {
        // Follow-up question
        prompt = `${userMessage}\n\nContext: Question was "${questionVersion.questionText}" with choices ${questionVersion.answerChoices.join(', ')}. The correct answer is ${questionVersion.correctAnswer}.`;
      } else {
        // Initial explanation
        const systemPrompt = aiSettings?.systemPrompt || 
          `You are a course-assistant AI. The learner chose answer "${chosenAnswer}"; the correct answer is "${questionVersion.correctAnswer}". Explain why the correct answer is correct, why the chosen answer is not, and invite follow-up questions. Keep replies under 150 words unless the learner requests more depth.`;
        
        prompt = `${systemPrompt}\n\nQuestion: ${questionVersion.questionText}\nChoices: ${questionVersion.answerChoices.join(', ')}\nLearner's answer: ${chosenAnswer}\nCorrect answer: ${questionVersion.correctAnswer}\nTopic: ${questionVersion.topicFocus}`;
      }

      const response = await callOpenRouter(prompt, aiSettings);
      res.json({ response });
    } catch (error) {
      console.error("Error calling chatbot:", error);
      res.status(500).json({ message: "Failed to get AI response" });
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
      // Don't send the API key back to the client
      if (settings) {
        const { apiKey, ...safeSettings } = settings;
        res.json({ ...safeSettings, hasApiKey: !!apiKey });
      } else {
        res.json(null);
      }
    } catch (error) {
      console.error("Error fetching AI settings:", error);
      res.status(500).json({ message: "Failed to fetch AI settings" });
    }
  });

  app.put("/api/admin/ai-settings", requireAdmin, async (req, res) => {
    try {
      const settingsData = insertAiSettingsSchema.partial().parse(req.body);
      const settings = await storage.updateAiSettings(settingsData);
      
      // Don't send the API key back to the client
      const { apiKey, ...safeSettings } = settings;
      res.json({ ...safeSettings, hasApiKey: !!apiKey });
    } catch (error) {
      console.error("Error updating AI settings:", error);
      res.status(400).json({ message: "Failed to update AI settings" });
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
