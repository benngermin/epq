/**
 * Blank Pattern Normalizer
 * Handles normalization of blank patterns in question text
 * Converts between blank_n and ___ patterns for consistency
 */

import { debugLog } from '../debug-utils';

/**
 * Pattern to match blank_n format (e.g., blank_1, blank_2, etc.)
 */
const BLANK_N_PATTERN = /\bblank_(\d+)\b/g;

/**
 * Pattern to match brackets format []
 */
const BRACKET_PATTERN = /\[\s*\]/g;

/**
 * Pattern to match asterisk format *...*
 */
const ASTERISK_PATTERN = /\*[^*]+\*/g;

/**
 * Pattern to match multiple underscores (3 or more)
 */
const UNDERSCORE_PATTERN = /_{3,}/g;

/**
 * Standard blank replacement
 */
const STANDARD_BLANK = '___';

/**
 * Normalize blank patterns in question text
 * Converts all blank formats to standard ___ format
 */
export function normalizeQuestionBlanks(questionText: string): {
  normalizedText: string;
  blankPositions: number[];
  originalFormat: 'blank_n' | 'underscore' | 'bracket' | 'asterisk' | 'mixed' | 'none';
} {
  if (!questionText || typeof questionText !== 'string') {
    return {
      normalizedText: questionText || '',
      blankPositions: [],
      originalFormat: 'none'
    };
  }
  
  const blankPositions: number[] = [];
  let originalFormat: 'blank_n' | 'underscore' | 'bracket' | 'asterisk' | 'mixed' | 'none' = 'none';
  
  // Check what format(s) are present
  const hasBlankN = BLANK_N_PATTERN.test(questionText);
  const hasUnderscore = UNDERSCORE_PATTERN.test(questionText);
  const hasBracket = BRACKET_PATTERN.test(questionText);
  const hasAsterisk = ASTERISK_PATTERN.test(questionText);
  
  // Determine original format
  const formatCount = [hasBlankN, hasUnderscore, hasBracket, hasAsterisk].filter(Boolean).length;
  if (formatCount === 0) {
    originalFormat = 'none';
  } else if (formatCount > 1) {
    originalFormat = 'mixed';
  } else if (hasBlankN) {
    originalFormat = 'blank_n';
  } else if (hasUnderscore) {
    originalFormat = 'underscore';
  } else if (hasBracket) {
    originalFormat = 'bracket';
  } else if (hasAsterisk) {
    originalFormat = 'asterisk';
  }
  
  let normalizedText = questionText;
  
  // Replace blank_n patterns and track positions
  normalizedText = normalizedText.replace(BLANK_N_PATTERN, (match, blankNum) => {
    const position = parseInt(blankNum, 10);
    if (!blankPositions.includes(position)) {
      blankPositions.push(position);
    }
    return STANDARD_BLANK;
  });
  
  // Replace bracket patterns
  normalizedText = normalizedText.replace(BRACKET_PATTERN, () => {
    const nextPosition = blankPositions.length + 1;
    blankPositions.push(nextPosition);
    return STANDARD_BLANK;
  });
  
  // Replace asterisk patterns
  normalizedText = normalizedText.replace(ASTERISK_PATTERN, () => {
    const nextPosition = blankPositions.length + 1;
    blankPositions.push(nextPosition);
    return STANDARD_BLANK;
  });
  
  // Normalize multiple underscores to exactly three
  normalizedText = normalizedText.replace(UNDERSCORE_PATTERN, () => {
    const nextPosition = blankPositions.length + 1;
    blankPositions.push(nextPosition);
    return STANDARD_BLANK;
  });
  
  // Sort positions to maintain order
  blankPositions.sort((a, b) => a - b);
  
  debugLog('Normalized question blanks', {
    originalFormat,
    blankCount: blankPositions.length,
    blankPositions
  });
  
  return {
    normalizedText,
    blankPositions,
    originalFormat
  };
}

/**
 * Extract blank positions from question text
 * Returns an array of blank positions found in the text
 */
export function extractBlankPositions(questionText: string): number[] {
  const { blankPositions } = normalizeQuestionBlanks(questionText);
  return blankPositions;
}

/**
 * Count the number of blanks in question text
 */
export function countBlanks(questionText: string): number {
  const { blankPositions } = normalizeQuestionBlanks(questionText);
  return blankPositions.length;
}

/**
 * Map blank IDs to positions for multi-blank questions
 * Used for select_from_list and short_answer with multiple blanks
 */
export function mapBlankIdsToPositions(blanks: any[]): Map<number, number> {
  const mapping = new Map<number, number>();
  
  if (!Array.isArray(blanks)) {
    return mapping;
  }
  
  blanks.forEach((blank, index) => {
    if (blank && typeof blank.blank_id === 'number') {
      // Map blank_id to its position (1-indexed)
      mapping.set(blank.blank_id, index + 1);
    }
  });
  
  return mapping;
}

/**
 * Normalize answer format for multi-blank questions
 * Converts between different answer formats
 */
export function normalizeMultiBlankAnswer(
  answer: string | Record<string, string>,
  expectedFormat: 'object' | 'string'
): string {
  // If answer is already a string
  if (typeof answer === 'string') {
    if (expectedFormat === 'string') {
      return answer;
    }
    
    // Try to parse if it looks like JSON
    if (answer.startsWith('{')) {
      try {
        const parsed = JSON.parse(answer);
        return answer; // Return original if it's valid JSON
      } catch {
        // If parsing fails, treat as comma-separated values
        const parts = answer.split(',').map(s => s.trim());
        const obj: Record<string, string> = {};
        parts.forEach((part, index) => {
          obj[(index + 1).toString()] = part;
        });
        return JSON.stringify(obj);
      }
    }
    
    // Convert comma-separated to object
    const parts = answer.split(',').map(s => s.trim());
    const obj: Record<string, string> = {};
    parts.forEach((part, index) => {
      obj[(index + 1).toString()] = part;
    });
    return JSON.stringify(obj);
  }
  
  // If answer is an object
  if (typeof answer === 'object' && answer !== null) {
    if (expectedFormat === 'object') {
      return JSON.stringify(answer);
    }
    
    // Convert object to comma-separated string
    const values = Object.values(answer);
    return values.join(', ');
  }
  
  return '';
}

/**
 * Validate blank configuration
 * Ensures blanks array matches the number of blanks in question text
 */
export function validateBlankConfiguration(
  questionText: string,
  blanks: any[]
): {
  isValid: boolean;
  expectedCount: number;
  actualCount: number;
  message: string;
} {
  const expectedCount = countBlanks(questionText);
  const actualCount = Array.isArray(blanks) ? blanks.length : 0;
  
  const isValid = expectedCount === actualCount;
  
  let message = '';
  if (!isValid) {
    if (expectedCount > actualCount) {
      message = `Question has ${expectedCount} blanks but only ${actualCount} configured`;
    } else if (expectedCount < actualCount) {
      message = `Question has ${expectedCount} blanks but ${actualCount} are configured`;
    } else if (expectedCount === 0) {
      message = 'No blanks found in question text';
    }
  } else {
    message = 'Blank configuration is valid';
  }
  
  return {
    isValid,
    expectedCount,
    actualCount,
    message
  };
}

/**
 * Process question for import
 * Normalizes blanks and validates configuration
 */
export function processQuestionForImport(question: any): any {
  const processed = { ...question };
  
  // Only process questions with text that might have blanks
  if (processed.question_text && typeof processed.question_text === 'string') {
    const { normalizedText, blankPositions } = normalizeQuestionBlanks(processed.question_text);
    
    // Update question text with normalized blanks
    processed.question_text = normalizedText;
    
    // Log if blanks were normalized
    if (blankPositions.length > 0) {
      debugLog('Normalized blanks during import', {
        questionType: processed.question_type,
        blankCount: blankPositions.length,
        hasBlankConfig: !!processed.blanks
      });
    }
    
    // Validate blank configuration if present
    if (processed.blanks && Array.isArray(processed.blanks)) {
      const validation = validateBlankConfiguration(normalizedText, processed.blanks);
      if (!validation.isValid) {
        debugLog('Blank configuration mismatch during import', validation);
      }
    }
  }
  
  return processed;
}

/**
 * Batch process questions for import
 */
export function processQuestionsForImport(questions: any[]): any[] {
  if (!Array.isArray(questions)) {
    return [];
  }
  
  return questions.map(processQuestionForImport);
}