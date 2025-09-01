import { db } from '../db';
import { questions, questionVersions } from '@shared/schema';
import { inArray, eq } from 'drizzle-orm';

// Batch fetch question versions to reduce N+1 queries
export async function batchFetchQuestionVersions(questionIds: number[]) {
  if (questionIds.length === 0) return new Map();
  
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
export async function batchFetchQuestionsWithVersions(questionSetId: number) {
  // Fetch all questions for the set
  const allQuestions = await db
    .select()
    .from(questions)
    .where(eq(questions.questionSetId, questionSetId));
  
  if (allQuestions.length === 0) return [];
  
  // Get all question IDs
  const questionIds = allQuestions.map(q => q.id);
  
  // Batch fetch all versions
  const versionMap = await batchFetchQuestionVersions(questionIds);
  
  // Combine questions with their latest versions
  const questionsWithVersions = allQuestions.map(question => {
    const versions = versionMap.get(question.id) || [];
    const latestVersion = versions
      .sort((a: any, b: any) => b.versionNumber - a.versionNumber)[0];
    
    // Transform latestVersion to use camelCase field names
    let transformedLatestVersion = null;
    if (latestVersion) {
      transformedLatestVersion = {
        ...latestVersion,
        answerChoices: latestVersion.answerChoices || latestVersion.answer_choices,
        dropZones: latestVersion.dropZones || latestVersion.drop_zones,
      };
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
  
  // Sort questions by originalQuestionNumber in ascending order
  questionsWithVersions.sort((a, b) => {
    const aNum = a.originalQuestionNumber || 0;
    const bNum = b.originalQuestionNumber || 0;
    return aNum - bNum;
  });
  
  return questionsWithVersions;
}