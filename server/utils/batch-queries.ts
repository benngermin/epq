import { getDb } from '../db';
import { questions, questionVersions } from '@shared/schema';
import { inArray, eq } from 'drizzle-orm';

// Batch fetch question versions to reduce N+1 queries
export async function batchFetchQuestionVersions(questionIds: number[]) {
  if (questionIds.length === 0) return new Map();
  
  const db = getDb();
  const versions = await db
    .select()
    .from(questionVersions)
    .where(inArray(questionVersions.questionId, questionIds));
  
  // Group versions by question ID
  const versionMap = new Map<number, typeof versions>();
  
  versions.forEach(version => {
    const questionVersions = versionMap.get(version.questionId) || [];
    questionVersions.push(version);
    versionMap.set(version.questionId, questionVersions);
  });
  
  return versionMap;
}

// Batch fetch questions with their latest versions
export async function batchFetchQuestionsWithVersions(questionSetId: number, includeArchived: boolean = false) {
  // Fetch all questions for the set
  const db = getDb();
  const allQuestions = await db
    .select()
    .from(questions)
    .where(eq(questions.questionSetId, questionSetId));
  
  if (allQuestions.length === 0) return [];
  
  // Get all question IDs
  const questionIds = allQuestions.map(q => q.id);
  
  // Batch fetch all versions
  const versionMap = await batchFetchQuestionVersions(questionIds);
  
  // Combine questions with their latest active versions
  const questionsWithVersions = allQuestions.map(question => {
    const versions = versionMap.get(question.id) || [];
    // Filter to only active versions and get the latest one
    const activeVersions = versions.filter((v: any) => v.isActive);
    const latestVersion = activeVersions
      .sort((a: any, b: any) => b.versionNumber - a.versionNumber)[0];
    
    // Transform latestVersion to use camelCase field names
    let transformedLatestVersion = null;
    if (latestVersion) {
      transformedLatestVersion = {
        ...latestVersion,
        answerChoices: latestVersion.answerChoices || latestVersion.answer_choices,
        dropZones: latestVersion.dropZones || latestVersion.drop_zones,
        blanks: latestVersion.blanks, // Include blanks field for select_from_list questions
        // Ensure camelCase for static fields
        isStaticAnswer: latestVersion.isStaticAnswer || latestVersion.is_static_answer,
        staticExplanation: latestVersion.staticExplanation || latestVersion.static_explanation,
      };
      
      // Validate static explanation fields for consistency
      if (transformedLatestVersion.isStaticAnswer) {
        const explanation = transformedLatestVersion.staticExplanation;
        
        // Check if explanation is valid (non-empty string with meaningful content)
        const hasValidExplanation = explanation && 
                                   typeof explanation === 'string' && 
                                   explanation.trim().length > 10;
        
        if (!hasValidExplanation) {
          // Log warning and clear the static flag to fall back to chat
          console.warn(`Question version ${transformedLatestVersion.id} marked as static but has invalid explanation. Falling back to chat.`);
          transformedLatestVersion.isStaticAnswer = false;
          transformedLatestVersion.staticExplanation = null;
        }
      } else {
        // If not a static answer, ensure staticExplanation is null for consistency
        transformedLatestVersion.staticExplanation = null;
      }
      
      // Clean up snake_case versions if they exist
      if ('answer_choices' in transformedLatestVersion) {
        delete (transformedLatestVersion as any).answer_choices;
      }
      if ('drop_zones' in transformedLatestVersion) {
        delete (transformedLatestVersion as any).drop_zones;
      }
    }
    
    return {
      ...question,
      latestVersion: transformedLatestVersion
    };
  });
  
  // Filter based on includeArchived flag and questions without active versions
  const questionsWithActiveVersions = questionsWithVersions.filter(q => {
    // Filter out archived questions only if includeArchived is false
    if (!includeArchived && q.isArchived) {
      console.log(`Question ID ${q.id} in set ${questionSetId} is archived - excluding from results`);
      return false;
    }
    // Filter out questions without active versions ONLY if we're not including archived
    // (archived questions often have no active versions, but admin still needs to see them)
    if (!q.latestVersion && !includeArchived) {
      console.warn(`Question ID ${q.id} in set ${questionSetId} has no active versions - excluding from results`);
      return false;
    }
    // If includeArchived is true and the question is archived without an active version, keep it
    if (includeArchived && q.isArchived && !q.latestVersion) {
      console.log(`Question ID ${q.id} in set ${questionSetId} is archived with no active version - including for admin view`);
    }
    return true;
  });
  
  // Sort questions by displayOrder to match admin panel ordering
  questionsWithActiveVersions.sort((a, b) => {
    const aOrder = a.displayOrder ?? a.originalQuestionNumber ?? 0;
    const bOrder = b.displayOrder ?? b.originalQuestionNumber ?? 0;
    return aOrder - bOrder;
  });
  
  return questionsWithActiveVersions;
}