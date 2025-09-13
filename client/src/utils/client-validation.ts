// Client-side validation for simple question types
// Provides immediate feedback while server verification is in progress

interface ValidationResult {
  isCorrect: boolean;
}

/**
 * Validates answers on the client side for simple question types
 * Returns validation result for simple types, undefined for complex types that need server validation
 */
export function validateAnswerClientSide(
  questionType: string,
  userAnswer: any,
  correctAnswer: any
): ValidationResult | undefined {
  // Only validate simple types where we can be confident about correctness
  switch (questionType) {
    case 'multiple_choice':
      // Simple string comparison for multiple choice
      if (typeof userAnswer === 'string' && typeof correctAnswer === 'string') {
        return {
          isCorrect: userAnswer === correctAnswer
        };
      }
      return undefined;

    case 'either_or':
      // Either/or is essentially a two-option multiple choice
      if (typeof userAnswer === 'string' && typeof correctAnswer === 'string') {
        return {
          isCorrect: userAnswer === correctAnswer
        };
      }
      return undefined;

    case 'true_false':
      // True/false validation (if this type exists)
      if (typeof userAnswer === 'string' && typeof correctAnswer === 'string') {
        return {
          isCorrect: userAnswer.toLowerCase() === correctAnswer.toLowerCase()
        };
      }
      return undefined;

    // Complex types that need server validation
    case 'numerical_entry':
    case 'short_answer':
    case 'drag_and_drop':
    case 'multiple_response':
    case 'select_from_list':
    case 'fill_in_blank':
    case 'ordering':
      // These types have complex validation logic (ranges, partial credit, multiple correct answers, etc.)
      // Return undefined to indicate server validation is needed
      return undefined;

    default:
      // Unknown types should use server validation
      return undefined;
  }
}

/**
 * Determines if a question type supports optimistic updates
 */
export function supportsOptimisticUpdate(questionType: string): boolean {
  return ['multiple_choice', 'either_or', 'true_false'].includes(questionType);
}

/**
 * Helper to check if we should show optimistic result
 * Returns true only if we have both the correct answer and it's a simple type
 */
export function shouldShowOptimisticResult(
  questionType: string,
  correctAnswer: any
): boolean {
  return supportsOptimisticUpdate(questionType) && correctAnswer !== undefined && correctAnswer !== null;
}