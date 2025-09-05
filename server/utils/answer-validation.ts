/**
 * Answer Validation Utility
 * Handles validation logic for all question types in the EPQ system
 * Ensures consistent answer checking across the application
 */

import { debugLog, debugError } from '../debug-utils';

// Question type constants
export enum QuestionType {
  MULTIPLE_CHOICE = 'multiple_choice',
  NUMERICAL_ENTRY = 'numerical_entry',
  SHORT_ANSWER = 'short_answer',
  SELECT_FROM_LIST = 'select_from_list',
  DRAG_AND_DROP = 'drag_and_drop',
  MULTIPLE_RESPONSE = 'multiple_response',
  EITHER_OR = 'either_or'
}

// Validation options
interface ValidationOptions {
  caseSensitive?: boolean;
  acceptableAnswers?: string[];
  blanks?: Array<{
    blank_id: number;
    answer_choices: string[];
    correct_answer: string;
  }>;
  dropZones?: Array<{
    zone_id: number;
    zone_label: string;
  }>;
}

/**
 * Safely parse JSON string with error handling
 */
function safeJsonParse(jsonString: string, fallback: any = null): any {
  if (!jsonString || typeof jsonString !== 'string') {
    debugLog('Invalid JSON input - not a string', { input: jsonString, type: typeof jsonString });
    return fallback;
  }
  
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    debugLog('Failed to parse JSON', { 
      input: jsonString.substring(0, 100), // Log first 100 chars to avoid huge logs
      error: error instanceof Error ? error.message : String(error),
      fullLength: jsonString.length 
    });
    return fallback;
  }
}

/**
 * Normalize string for comparison
 */
function normalizeString(str: string, caseSensitive: boolean = false): string {
  if (!str || typeof str !== 'string') return '';
  const trimmed = str.trim();
  return caseSensitive ? trimmed : trimmed.toLowerCase();
}

/**
 * Compare arrays as sets (order doesn't matter)
 */
function compareArraysAsSet(arr1: any[], arr2: any[], caseSensitive: boolean = false): boolean {
  if (!Array.isArray(arr1) || !Array.isArray(arr2)) return false;
  if (arr1.length !== arr2.length) return false;
  
  const normalize = (item: any) => {
    const str = String(item);
    return normalizeString(str, caseSensitive);
  };
  
  const set1 = new Set(arr1.map(normalize));
  const set2 = new Set(arr2.map(normalize));
  
  if (set1.size !== set2.size) return false;
  
  for (const item of set1) {
    if (!set2.has(item)) return false;
  }
  
  return true;
}

/**
 * Validate multiple choice answer
 */
function validateMultipleChoice(userAnswer: string, correctAnswer: string): boolean {
  // Simple string comparison for multiple choice
  return normalizeString(userAnswer) === normalizeString(correctAnswer);
}

/**
 * Validate numerical entry answer
 */
function validateNumericalEntry(
  userAnswer: string,
  correctAnswer: string,
  options: ValidationOptions
): boolean {
  const normalized = normalizeString(userAnswer);
  const correct = normalizeString(correctAnswer);
  
  // Check exact match first
  if (normalized === correct) return true;
  
  // Check acceptable answers if provided
  if (options.acceptableAnswers && options.acceptableAnswers.length > 0) {
    return options.acceptableAnswers.some(
      acceptable => normalizeString(acceptable) === normalized
    );
  }
  
  // Try numeric comparison for numerical values
  const userNum = parseFloat(userAnswer);
  const correctNum = parseFloat(correctAnswer);
  
  if (!isNaN(userNum) && !isNaN(correctNum)) {
    // Allow for floating point precision issues
    return Math.abs(userNum - correctNum) < 0.0001;
  }
  
  return false;
}

/**
 * Validate short answer (can have multiple blanks)
 */
function validateShortAnswer(
  userAnswer: string,
  correctAnswer: string,
  options: ValidationOptions
): boolean {
  const caseSensitive = options.caseSensitive || false;
  
  // Check if this is a multi-blank answer (JSON format)
  if (userAnswer.startsWith('{')) {
    const userBlanks = safeJsonParse(userAnswer, {});
    
    if (Object.keys(userBlanks).length > 0) {
      // Multi-blank answer - join all values with comma and space
      const blankValues = Object.values(userBlanks).map((v: any) => 
        normalizeString(String(v), caseSensitive)
      );
      const userFullAnswer = blankValues.join(', ');
      const correctNormalized = normalizeString(correctAnswer, caseSensitive);
      
      // Check exact match
      if (userFullAnswer === correctNormalized) return true;
      
      // Check acceptable answers
      if (options.acceptableAnswers) {
        return options.acceptableAnswers.some(acceptable => 
          normalizeString(acceptable, caseSensitive) === userFullAnswer
        );
      }
      
      return false;
    }
  }
  
  // Single answer
  const userNormalized = normalizeString(userAnswer, caseSensitive);
  const correctNormalized = normalizeString(correctAnswer, caseSensitive);
  
  // Check exact match
  if (userNormalized === correctNormalized) return true;
  
  // Check acceptable answers
  if (options.acceptableAnswers) {
    return options.acceptableAnswers.some(acceptable => 
      normalizeString(acceptable, caseSensitive) === userNormalized
    );
  }
  
  return false;
}

/**
 * Validate select from list (dropdowns in blanks)
 */
function validateSelectFromList(
  userAnswer: string,
  correctAnswer: string,
  options: ValidationOptions
): boolean {
  // If we have blanks configuration, use it
  if (options.blanks && options.blanks.length > 0) {
    if (userAnswer.startsWith('{')) {
      // Multi-blank dropdown format: {"1":"answer1","2":"answer2"}
      const userBlanks = safeJsonParse(userAnswer, {});
      
      // Check if all blanks are answered correctly
      for (const blank of options.blanks) {
        const userAnswerForBlank = userBlanks[blank.blank_id.toString()];
        if (userAnswerForBlank !== blank.correct_answer) {
          return false;
        }
      }
      
      return true;
    } else if (options.blanks.length === 1) {
      // Single dropdown - direct comparison with first blank's correct answer
      return userAnswer === options.blanks[0].correct_answer;
    }
  }
  
  // Fallback to simple comparison
  return userAnswer === correctAnswer;
}

/**
 * Validate drag and drop answer
 */
function validateDragAndDrop(
  userAnswer: string,
  correctAnswer: string,
  options: ValidationOptions
): boolean {
  // Parse user answer (should be JSON object with zone assignments)
  const userZones = safeJsonParse(userAnswer, {});
  
  // Parse correct answer (can be string or already parsed)
  let correctZones: Record<string, string[]>;
  
  if (typeof correctAnswer === 'string') {
    correctZones = safeJsonParse(correctAnswer, {});
  } else if (typeof correctAnswer === 'object' && correctAnswer !== null) {
    correctZones = correctAnswer as Record<string, string[]>;
  } else {
    debugError('Invalid drag and drop correct answer format', { correctAnswer });
    return false;
  }
  
  // Normalize zone keys (handle both "zone_1" and "1" formats)
  const normalizeZoneKey = (key: string): string => {
    return key.startsWith('zone_') ? key : `zone_${key}`;
  };
  
  const normalizedUserZones: Record<string, string[]> = {};
  const normalizedCorrectZones: Record<string, string[]> = {};
  
  // Normalize user zones
  for (const key in userZones) {
    const normalizedKey = normalizeZoneKey(key);
    normalizedUserZones[normalizedKey] = Array.isArray(userZones[key]) 
      ? userZones[key] 
      : [];
  }
  
  // Normalize correct zones
  for (const key in correctZones) {
    const normalizedKey = normalizeZoneKey(key);
    normalizedCorrectZones[normalizedKey] = Array.isArray(correctZones[key])
      ? correctZones[key]
      : [];
  }
  
  // Get all unique zone keys
  const allZoneKeys = new Set([
    ...Object.keys(normalizedUserZones),
    ...Object.keys(normalizedCorrectZones)
  ]);
  
  // Compare each zone's contents (order doesn't matter within a zone)
  for (const zoneId of allZoneKeys) {
    const userItems = normalizedUserZones[zoneId] || [];
    const correctItems = normalizedCorrectZones[zoneId] || [];
    
    if (!compareArraysAsSet(userItems, correctItems)) {
      debugLog('Zone mismatch in drag and drop', {
        zoneId,
        userItems,
        correctItems
      });
      return false;
    }
  }
  
  return true;
}

/**
 * Validate multiple response answer
 */
function validateMultipleResponse(
  userAnswer: string,
  correctAnswer: string,
  options: ValidationOptions
): boolean {
  // Parse user answer (should be JSON array)
  const userSelections = safeJsonParse(userAnswer, []);
  
  // Parse correct answer (can be string or already parsed)
  let correctSelections: string[];
  
  if (typeof correctAnswer === 'string') {
    // Try to parse as JSON array first
    if (correctAnswer.startsWith('[')) {
      correctSelections = safeJsonParse(correctAnswer, []);
    } else {
      // Single answer converted to array
      correctSelections = [correctAnswer];
    }
  } else if (Array.isArray(correctAnswer)) {
    correctSelections = correctAnswer;
  } else {
    debugError('Invalid multiple response correct answer format', { correctAnswer });
    return false;
  }
  
  // Ensure both are arrays
  if (!Array.isArray(userSelections) || !Array.isArray(correctSelections)) {
    return false;
  }
  
  // Compare as sets (order doesn't matter)
  return compareArraysAsSet(userSelections, correctSelections);
}

/**
 * Validate either/or answer
 */
function validateEitherOr(userAnswer: string, correctAnswer: string): boolean {
  // Simple string comparison for either/or (binary choice)
  return normalizeString(userAnswer) === normalizeString(correctAnswer);
}

/**
 * Main validation function
 * Validates user answer against correct answer based on question type
 */
export function validateAnswer(
  userAnswer: string,
  correctAnswer: string,
  questionType: string,
  options: ValidationOptions = {}
): boolean {
  try {
    // Handle null/undefined/empty answers
    if (!userAnswer || userAnswer.trim() === '') {
      debugLog('Empty user answer provided', { questionType });
      return false;
    }
    
    // Log validation attempt for debugging
    debugLog('Validating answer', {
      questionType,
      userAnswerLength: userAnswer.length,
      hasOptions: Object.keys(options).length > 0
    });
    
    // Route to appropriate validator based on question type
    switch (questionType) {
      case QuestionType.MULTIPLE_CHOICE:
        return validateMultipleChoice(userAnswer, correctAnswer);
        
      case QuestionType.NUMERICAL_ENTRY:
        return validateNumericalEntry(userAnswer, correctAnswer, options);
        
      case QuestionType.SHORT_ANSWER:
        return validateShortAnswer(userAnswer, correctAnswer, options);
        
      case QuestionType.SELECT_FROM_LIST:
        return validateSelectFromList(userAnswer, correctAnswer, options);
        
      case QuestionType.DRAG_AND_DROP:
        return validateDragAndDrop(userAnswer, correctAnswer, options);
        
      case QuestionType.MULTIPLE_RESPONSE:
        return validateMultipleResponse(userAnswer, correctAnswer, options);
        
      case QuestionType.EITHER_OR:
        return validateEitherOr(userAnswer, correctAnswer);
        
      default:
        debugLog('Unknown question type, using simple comparison', { questionType });
        // Fallback to simple string comparison
        return userAnswer === correctAnswer;
    }
  } catch (error) {
    debugError('Error during answer validation', {
      questionType,
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}

/**
 * Export all validators for unit testing
 */
export const validators = {
  validateMultipleChoice,
  validateNumericalEntry,
  validateShortAnswer,
  validateSelectFromList,
  validateDragAndDrop,
  validateMultipleResponse,
  validateEitherOr
};