import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { z } from "zod";
import { 
  insertCourseSchema, insertQuestionSetSchema, insertPracticeTestSchema, insertAiSettingsSchema,
  insertPromptVersionSchema, questionImportSchema, insertUserAnswerSchema, type QuestionImport 
} from "@shared/schema";
import { withRetry } from "./utils/db-retry";
import { withCircuitBreaker } from "./utils/connection-pool";

// Type assertion helper for authenticated requests
function assertAuthenticated(req: Request): asserts req is Request & { user: NonNullable<Express.User> } {
  if (!req.isAuthenticated() || !req.user) {
    throw new Error('Authentication required');
  }
}

// OpenRouter integration
async function callOpenRouter(prompt: string, settings: any): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
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
        model: settings?.modelName || "anthropic/claude-3.5-sonnet",
        messages: [{ role: "user", content: prompt }],
        temperature: (settings?.temperature || 70) / 100,
        max_tokens: settings?.maxTokens || 150,
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
    
    return data.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";
  } catch (error) {
    console.error("OpenRouter error:", error);
    return "I'm sorry, there was an error connecting to the AI service. Please try again later.";
  }
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

  // AI chatbot route
  app.post("/api/chatbot", requireAuth, async (req, res) => {
    try {
      const { questionVersionId, chosenAnswer, userMessage } = req.body;
      
      const questionVersion = await storage.getQuestionVersion(questionVersionId);
      if (!questionVersion) {
        return res.status(404).json({ message: "Question not found" });
      }

      const aiSettings = await storage.getAiSettings();
      const activePrompt = await storage.getActivePromptVersion();
      
      let prompt;
      if (userMessage) {
        // Follow-up question
        prompt = `${userMessage}\n\nContext: Question was "${questionVersion.questionText}" with choices ${questionVersion.answerChoices.join(', ')}. The correct answer is ${questionVersion.correctAnswer}.`;
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
<source_material>
{{SOURCE_MATERIAL}}
</source_material>

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
        
        // Get course material by LOID if available
        const question = await storage.getQuestion(questionVersion.questionId);
        let sourceMaterial = questionVersion.topicFocus || "No additional source material provided.";
        
        if (question?.loid) {
          const courseMaterial = await storage.getCourseMaterialByLoid(question.loid);
          if (courseMaterial) {
            sourceMaterial = courseMaterial.content;
          }
        }

        // Substitute variables in the prompt
        systemPrompt = systemPrompt
          .replace(/\{\{QUESTION_TEXT\}\}/g, questionVersion.questionText)
          .replace(/\{\{ANSWER_CHOICES\}\}/g, formattedChoices)
          .replace(/\{\{SELECTED_ANSWER\}\}/g, chosenAnswer)
          .replace(/\{\{CORRECT_ANSWER\}\}/g, questionVersion.correctAnswer)
          .replace(/\{\{SOURCE_MATERIAL\}\}/g, sourceMaterial);
        
        prompt = systemPrompt;
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
