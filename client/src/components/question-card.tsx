import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, MessageSquare, RotateCcw, ChevronRight } from "lucide-react";
import { SimpleStreamingChat } from "./simple-streaming-chat";
import { StaticExplanation } from "./static-explanation";
import { cn } from "@/lib/utils";
import { debugLog, debugError } from "@/utils/debug";
import { validateAnswerClientSide, shouldShowOptimisticResult } from "@/utils/client-validation";

// Utility function to clean blank_n patterns, brackets, and asterisk patterns from question text
const cleanQuestionText = (text: string): string => {
  if (!text) return text;
  // Remove blank_n patterns (e.g., blank_1, blank_2, etc.) and replace brackets/asterisks with underscores
  return text
    .replace(/\bblank_\d+\b/g, '___')
    .replace(/\[\s*\]/g, '___')
    .replace(/\*[^*]+\*/g, '___');
};

// Import question type components
import { FillInBlank } from "./question-types/fill-in-blank"; // Used by numerical_entry and short_answer
import { PickFromList } from "./question-types/pick-from-list"; // Used by multiple_response and select_from_list fallback
import { Ordering } from "./question-types/ordering"; // Used as fallback for drag_and_drop
import { SelectFromListBlank } from "./question-types/select-from-list-blank";
import { DragDropZones } from "./question-types/drag-drop-zones";
import { EitherOr } from "./question-types/either-or";

// Question type configurations with diverse color palette
// Multiple choice uses primary app blue, others use distinct colors
const questionTypeConfig: Record<string, { label: string; color: string }> = {
  multiple_choice: { label: "Multiple Choice", color: "bg-primary/20 text-primary border-primary/30" },
  numerical_entry: { label: "Numerical", color: "bg-indigo-500/20 text-indigo-700 border-indigo-500/30" },
  short_answer: { label: "Short Answer", color: "bg-red-500/20 text-red-700 border-red-500/30" },
  drag_and_drop: { label: "Drag & Drop", color: "bg-teal-500/20 text-teal-700 border-teal-500/30" },
  multiple_response: { label: "Multiple Response", color: "bg-lime-500/20 text-lime-700 border-lime-500/30" },
  select_from_list: { label: "Select from List", color: "bg-violet-500/20 text-violet-700 border-violet-500/30" },
  either_or: { label: "Either/Or", color: "bg-cyan-500/20 text-cyan-700 border-cyan-500/30" },
};

interface QuestionCardProps {
  question: any;
  onSubmitAnswer: (answer: string) => void;
  isSubmitting: boolean;
  testRunId: number;
  onFlipChange?: (isFlipped: boolean) => void;
  onNextQuestion?: () => void;
  hasNextQuestion?: boolean;
  selectedAnswer?: string;
  chatResetTimestamp?: number;
}

export function QuestionCard({ 
  question, 
  onSubmitAnswer, 
  isSubmitting, 
  testRunId,
  onFlipChange,
  onNextQuestion,
  hasNextQuestion,
  selectedAnswer,
  chatResetTimestamp
}: QuestionCardProps) {
  // Log question details in development mode only
  useEffect(() => {
    if (import.meta.env.DEV && question) {
      debugLog(`Rendering question ${question.originalQuestionNumber || question.questionIndex + 1}`, {
        id: question.id,
        originalNumber: question.originalQuestionNumber,
        questionIndex: question.questionIndex,
        hasLatestVersion: !!question.latestVersion,
        questionType: question.latestVersion?.questionType,
        hasUserAnswer: !!question.userAnswer
      });
    }
  }, [question?.id]);
  const [selectedAnswerState, setSelectedAnswerState] = useState<any>("");
  const [isFlipped, setIsFlipped] = useState(false);
  const [hasAutoFlipped, setHasAutoFlipped] = useState(false); // Track if auto-flip has happened for current answer
  const [submittedAnswer, setSubmittedAnswer] = useState<string>("");
  const [localAnswerState, setLocalAnswerState] = useState<{ hasAnswer: boolean; isCorrect: boolean | undefined; isOptimistic?: boolean }>({
    hasAnswer: false,
    isCorrect: undefined,
    isOptimistic: false
  });

  // Use local state immediately after submission, otherwise use props
  const hasAnswer = localAnswerState.hasAnswer || !!question?.userAnswer;
  // isCorrect will be undefined while pending, then true/false after server response
  const isCorrect = localAnswerState.isCorrect !== undefined 
    ? localAnswerState.isCorrect 
    : question?.userAnswer?.isCorrect;
  const questionType = question?.latestVersion?.questionType || "multiple_choice";
  
  // For simple question types with optimistic updates, never show pending state
  const canUseOptimisticUpdate = shouldShowOptimisticResult(questionType, question?.latestVersion?.correctAnswer);
  const isPending = hasAnswer && isCorrect === undefined && !canUseOptimisticUpdate;
  
  // Show feedback section when we have an answer and it's not pending
  const showFeedback = hasAnswer && !isPending;

  // Initialize state when question changes
  useEffect(() => {
    setIsFlipped(false);
    setHasAutoFlipped(false); // Reset auto-flip flag for new question
    onFlipChange?.(false);
    
    // If this question has already been answered, restore that state
    if (question?.userAnswer) {
      const answer = question.userAnswer.chosenAnswer;
      setSelectedAnswerState(answer);
      setSubmittedAnswer(answer);
      setLocalAnswerState({ 
        hasAnswer: true, 
        isCorrect: question.userAnswer.isCorrect,
        isOptimistic: false 
      });
      // If this question was already answered incorrectly, mark auto-flip as done
      // to prevent auto-flipping again when returning to this question
      if (question.userAnswer.isCorrect === false) {
        setHasAutoFlipped(true);
      }
    } else {
      // Only reset if question hasn't been answered
      setSelectedAnswerState("");
      setSubmittedAnswer("");
      setLocalAnswerState({ hasAnswer: false, isCorrect: undefined, isOptimistic: false });
    }
  }, [question?.id, onFlipChange]);

  // Sync local state with server response
  useEffect(() => {
    // If we have a server response
    if (question?.userAnswer && localAnswerState.hasAnswer) {
      // Update with server's authoritative result
      // This handles both pending states and correcting any optimistic mismatches
      if (localAnswerState.isCorrect !== question.userAnswer.isCorrect) {
        setLocalAnswerState(prev => ({
          ...prev,
          isCorrect: question.userAnswer.isCorrect,
          isOptimistic: false // Server result is always authoritative
        }));
      }
    }
  }, [question?.userAnswer, localAnswerState.hasAnswer, localAnswerState.isCorrect]);

  // Notify parent when flip state changes
  useEffect(() => {
    onFlipChange?.(isFlipped);
  }, [isFlipped, onFlipChange]);

  // Validate static explanations - helper function
  const hasValidStaticExplanation = () => {
    try {
      if (!question?.latestVersion?.isStaticAnswer) return false;
      const explanation = question?.latestVersion?.staticExplanation;
      // Check if explanation exists and has meaningful content (not just whitespace)
      return explanation && typeof explanation === 'string' && explanation.trim().length > 10;
    } catch (error) {
      debugError('Error validating static explanation:', error);
      return false;
    }
  };

  // Auto-flip for incorrect answers to show help (static explanation or AI chat)
  useEffect(() => {
    // For auto-flip, we care about whether the question has been answered (either locally or on server)
    const hasBeenAnswered = question?.userAnswer !== undefined || localAnswerState.hasAnswer;
    
    // Debug log to understand auto-flip conditions
    console.log('[Auto-flip Debug]', {
      hasUserAnswer: question?.userAnswer !== undefined,
      localHasAnswer: localAnswerState.hasAnswer,
      hasBeenAnswered,
      isCorrect: question?.userAnswer?.isCorrect,
      isFlipped,
      hasAutoFlipped,
      shouldFlip: question?.userAnswer !== undefined && 
                  question?.userAnswer?.isCorrect === false &&
                  !isFlipped &&
                  !hasAutoFlipped
    });
    
    // Auto-flip for ANY incorrect answer after server responds
    // Only auto-flip if we haven't already auto-flipped for this answer
    // We check question?.userAnswer directly since that's the server's response
    if (question?.userAnswer !== undefined && 
        question?.userAnswer?.isCorrect === false &&
        !isFlipped &&
        !hasAutoFlipped) { // Only auto-flip once per answer
      // Auto-flip to show help (either static explanation or AI chat) after a short delay
      console.log('[Auto-flip] Triggering auto-flip for incorrect answer');
      const timer = setTimeout(() => {
        console.log('[Auto-flip] Executing flip');
        setIsFlipped(true);
        setHasAutoFlipped(true); // Mark that we've auto-flipped for this answer
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [question?.userAnswer, localAnswerState.hasAnswer, isFlipped, hasAutoFlipped]);

  const handleSubmit = () => {
    if (!selectedAnswerState || hasAnswer || !question?.latestVersion) return;

    // Convert answer to string format for storage
    let answerString = selectedAnswerState;
    if (typeof selectedAnswerState === 'object') {
      answerString = JSON.stringify(selectedAnswerState);
    }

    setSubmittedAnswer(answerString);
    
    // Try client-side validation for optimistic updates
    const clientValidation = shouldShowOptimisticResult(questionType, question.latestVersion.correctAnswer) 
      ? validateAnswerClientSide(questionType, selectedAnswerState, question.latestVersion.correctAnswer)
      : undefined;
    
    // Set state synchronously BEFORE calling onSubmitAnswer to prevent any flash
    if (clientValidation) {
      // Show optimistic result immediately for simple types - no pending state ever
      setLocalAnswerState({ 
        hasAnswer: true, 
        isCorrect: clientValidation.isCorrect,
        isOptimistic: true 
      });
    } else {
      // Show pending state for complex types
      setLocalAnswerState({ 
        hasAnswer: true, 
        isCorrect: undefined,
        isOptimistic: false 
      });
    }
    
    // Always submit to server for verification
    onSubmitAnswer(answerString);
  };

  const handleReviewQuestion = () => {
    setIsFlipped(false);
  };

  const handleShowChatbot = () => {
    setIsFlipped(true);
  };

  // Show chatbot when flipped (we always have an answer at this point since Get Help only shows after answering)
  const showChatbot = isFlipped;

  return (
    <div className="w-full flex-1 min-h-0 flex flex-col">
      <div className={cn("card-flip w-full flex-1 min-h-0", isFlipped && "flipped")}>
        <div className="card-flip-inner flex-1 min-h-0 flex flex-col">
          {/* Question Front */}
          <div className="card-flip-front">
            <Card className="w-full h-full bg-card border shadow-sm flex flex-col">
              <CardContent className="p-4 sm:p-5 md:p-6 flex flex-col h-full overflow-hidden">
                <div className="mb-1 sm:mb-2 md:mb-4 flex justify-between items-center flex-shrink-0">
                  <Badge 
                    variant="secondary" 
                    className={cn(
                      "w-fit text-sm font-medium px-3 py-1",
                      questionTypeConfig[questionType]?.color || "bg-accent text-accent-foreground border"
                    )}
                  >
                    {questionTypeConfig[questionType]?.label || "Question"}
                  </Badge>
                  <span className="text-sm font-medium text-muted-foreground">
                    Question {(question.questionIndex || 0) + 1}
                  </span>
                </div>

                <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
                  {/* Render question based on type */}
                  {(() => {
                    switch (questionType) {
                      case "drag_and_drop":
                        // Check if this uses the new drop zones format
                        if (question.latestVersion?.dropZones) {
                          return (
                            <div className="flex-1 flex flex-col">
                              <div className="mb-1.5 sm:mb-2 md:mb-4 lg:mb-5 flex-shrink-0">
                                <p className="text-base text-foreground leading-relaxed text-left">
                                  {cleanQuestionText(question.latestVersion?.questionText)}
                                </p>
                              </div>
                              <div className="flex-1">
                                <DragDropZones
                                  answerChoices={question.latestVersion.answerChoices || []}
                                  dropZones={question.latestVersion.dropZones}
                                  value={hasAnswer && question.userAnswer ? question.userAnswer.chosenAnswer : selectedAnswerState}
                                  onChange={setSelectedAnswerState}
                                  disabled={hasAnswer || isSubmitting}
                                  correctAnswer={hasAnswer ? question.latestVersion?.correctAnswer : undefined}
                                />
                              </div>
                            </div>
                          );
                        } else {
                          // Fallback to ordering style
                          return (
                            <div className="flex-1 flex flex-col">
                              <div className="mb-1.5 sm:mb-2 md:mb-4 lg:mb-5 flex-shrink-0">
                                <p className="text-base text-foreground leading-relaxed text-left">
                                  {cleanQuestionText(question.latestVersion?.questionText)}
                                </p>
                              </div>
                              <div className="flex-1">
                                <Ordering
                                  answerChoices={question.latestVersion?.answerChoices || []}
                                  value={hasAnswer && question.userAnswer ? JSON.parse(question.userAnswer.chosenAnswer) : selectedAnswerState}
                                  onChange={setSelectedAnswerState}
                                  disabled={hasAnswer || isSubmitting}
                                  correctAnswer={hasAnswer ? question.latestVersion?.correctAnswer : undefined}
                                  correctOrder={question.latestVersion?.correctOrder}
                                />
                              </div>
                            </div>
                          );
                        }
                        
                      case "numerical_entry":
                      case "short_answer": // Both use fill-in-blank style input
                        return (
                          <FillInBlank
                            questionText={question.latestVersion?.questionText || ""}
                            value={hasAnswer && question.userAnswer ? question.userAnswer.chosenAnswer : selectedAnswerState}
                            onChange={setSelectedAnswerState}
                            disabled={hasAnswer || isSubmitting}
                            isCorrect={isCorrect}
                            correctAnswer={hasAnswer ? question.latestVersion?.correctAnswer : undefined}
                            acceptableAnswers={hasAnswer ? question.latestVersion?.acceptableAnswers : undefined}
                          />
                        );
                        
                      case "multiple_response": // Uses PickFromList with allowMultiple=true
                        return (
                          <div className="flex-1 flex flex-col">
                            <div className="mb-1.5 sm:mb-2 md:mb-4 lg:mb-5 flex-shrink-0">
                              <p className="text-base text-foreground leading-relaxed text-left">
                                {question.latestVersion?.questionText}
                              </p>
                            </div>
                            <div className="flex-1">
                              <PickFromList
                                answerChoices={question.latestVersion?.answerChoices || []}
                                value={hasAnswer && question.userAnswer ? question.userAnswer.chosenAnswer : selectedAnswerState}
                                onChange={setSelectedAnswerState}
                                allowMultiple={true}
                                disabled={hasAnswer || isSubmitting}
                                correctAnswer={hasAnswer ? question.latestVersion?.correctAnswer : undefined}
                              />
                            </div>
                          </div>
                        );
                        
                      case "select_from_list":
                        // Check if this uses the new blanks format with actual blanks in text
                        // Support both underscore patterns (___) and blank_n patterns
                        const hasBlankPattern = question.latestVersion?.questionText && 
                          (question.latestVersion.questionText.includes('___') || 
                           /blank_\d+/i.test(question.latestVersion.questionText));
                        
                        // Debug logging disabled in production
                        
                        if (hasBlankPattern) {
                          // If we have blank patterns but no blanks data, auto-generate it
                          let blanksData = question.latestVersion?.blanks;
                          
                          // Debug logging disabled in production
                          
                          if (!blanksData && question.latestVersion?.answerChoices && question.latestVersion.answerChoices.length > 0) {
                            // Count how many blank patterns exist in the text
                            const blankMatches = question.latestVersion.questionText.match(/blank_\d+|___/gi) || [];
                            const numBlanks = blankMatches.length;
                            
                            console.log('Auto-generating blanks data for', numBlanks, 'blanks');
                            
                            // Generate blanks data from answerChoices
                            // All blanks will use the same answer choices
                            blanksData = Array.from({ length: numBlanks }, (_, index) => ({
                              blank_id: index + 1,
                              answer_choices: question.latestVersion.answerChoices,
                              correct_answer: question.latestVersion.correctAnswer || ''
                            }));
                          } else if (!blanksData) {
                            console.log('Cannot auto-generate blanks - no answerChoices available');
                          }
                          
                          // Use SelectFromListBlank if we have blanks data (either from DB or auto-generated)
                          if (blanksData && blanksData.length > 0) {
                            console.log('Rendering SelectFromListBlank with blanks:', blanksData);
                            return (
                              <SelectFromListBlank
                                questionText={question.latestVersion.questionText}
                                blanks={blanksData}
                                value={hasAnswer && question.userAnswer ? question.userAnswer.chosenAnswer : selectedAnswerState}
                                onChange={setSelectedAnswerState}
                                disabled={hasAnswer || isSubmitting}
                                correctAnswer={hasAnswer ? (question.latestVersion.blanks || blanksData) : undefined}
                                isCorrect={isCorrect}
                              />
                            );
                          }
                        } else {
                          // Fallback for questions without blank patterns
                          console.log('Select from list - Using fallback rendering');
                          // For select_from_list with blanks but no underscores in text,
                          // extract answer choices from the first blank
                          let answerChoices = question.latestVersion?.answerChoices || [];
                          let correctAnswer = question.latestVersion?.correctAnswer;
                          
                          if (answerChoices.length === 0 && question.latestVersion?.blanks?.[0]?.answer_choices) {
                            answerChoices = question.latestVersion.blanks[0].answer_choices;
                            // Also get the correct answer from the blank
                            correctAnswer = question.latestVersion.blanks[0].correct_answer;
                          }
                          
                          // Fallback to pick-from-list style
                          return (
                            <div className="flex-1 flex flex-col">
                              <div className="mb-1.5 sm:mb-2 md:mb-4 lg:mb-5 flex-shrink-0">
                                <p className="text-base text-foreground leading-relaxed text-left">
                                  {cleanQuestionText(question.latestVersion?.questionText)}
                                </p>
                              </div>
                              <div className="flex-1">
                                <PickFromList
                                  answerChoices={answerChoices}
                                  value={hasAnswer && question.userAnswer ? question.userAnswer.chosenAnswer : selectedAnswerState}
                                  onChange={setSelectedAnswerState}
                                  allowMultiple={false}
                                  disabled={hasAnswer || isSubmitting}
                                  correctAnswer={hasAnswer ? correctAnswer : undefined}
                                />
                              </div>
                            </div>
                          );
                        }
                        
                        // This should never be reached now, but keeping break for safety
                        break;
                        
                      case "either_or":
                        return (
                          <div className="flex-1 flex flex-col">
                            <div className="mb-1.5 sm:mb-2 md:mb-4 lg:mb-5 flex-shrink-0">
                              <p className="text-base text-foreground leading-relaxed text-left">
                                {question.latestVersion?.questionText}
                              </p>
                            </div>
                            <div className="flex-1">
                              <EitherOr
                                answerChoices={question.latestVersion?.answerChoices || []}
                                value={hasAnswer && question.userAnswer ? question.userAnswer.chosenAnswer : selectedAnswerState}
                                onChange={setSelectedAnswerState}
                                disabled={hasAnswer || isSubmitting}
                                correctAnswer={hasAnswer ? question.latestVersion?.correctAnswer : undefined}
                              />
                            </div>
                          </div>
                        );
                        
                      default: // multiple_choice
                        return (
                          <div className="flex-1 flex flex-col">
                            <div className="mb-1.5 sm:mb-2 md:mb-4 lg:mb-5 flex-shrink-0">
                              <p className="text-base text-foreground leading-relaxed text-left">
                                {question.latestVersion?.questionText}
                              </p>
                            </div>
                            <div className="flex-1 overflow-y-auto max-h-[400px] pr-2">
                              <RadioGroup
                                value={hasAnswer && question.userAnswer ? question.userAnswer.chosenAnswer : selectedAnswerState}
                                onValueChange={setSelectedAnswerState}
                                disabled={hasAnswer || isSubmitting}
                                className="flex flex-col justify-start gap-1 sm:gap-1.5 md:gap-2.5 lg:gap-3"
                              >
                                {question.latestVersion?.answerChoices?.map((choice: string, index: number) => {
                                  const choiceLetter = String.fromCharCode(65 + index); // A, B, C, D
                                  const isSelected = hasAnswer 
                                    ? question.userAnswer?.chosenAnswer === choiceLetter
                                    : selectedAnswerState === choiceLetter;
                                  const isCorrectChoice = choiceLetter === question.latestVersion?.correctAnswer;

                                  return (
                                    <Label
                                      key={choiceLetter}
                                      htmlFor={choiceLetter}
                                      className={cn(
                                        "flex items-center p-3 rounded-lg border cursor-pointer transition-all duration-200",
                                        "hover:border-primary hover:bg-accent",
                                        isSelected && "border-primary bg-primary/10",
                                        hasAnswer && "cursor-default"
                                      )}
                                    >
                                      <RadioGroupItem
                                        value={choiceLetter}
                                        id={choiceLetter}
                                        className="mr-3 flex-shrink-0"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <span className="text-base text-foreground leading-relaxed">
                                          {choice.replace(/^[A-D]\.\s*/, '')}
                                        </span>
                                      </div>
                                    </Label>
                                  );
                                })}
                              </RadioGroup>
                            </div>
                          </div>
                        );
                    }
                  })()}
                </div>

                {/* Action buttons - always visible at bottom - add significant bottom padding on mobile for sticky footer clearance */}
                <div className="mt-4 pt-1 sm:pt-2 md:pt-4 pb-2 flex-shrink-0 border-t">
                  {/* Show feedback after server responds */}
                  {showFeedback && (
                    <div className="space-y-3">
                      {/* Show appropriate feedback based on correctness */}
                      {isCorrect === true && (
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                          <div className="flex items-center">
                            <CheckCircle className="h-4 w-4 text-success mr-2" />
                            <span className="font-medium text-success text-sm">Correct!</span>
                          </div>
                        </div>
                      )}
                      
                      {isCorrect === false && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                          <div className="flex items-center">
                            <XCircle className="h-4 w-4 text-error mr-2" />
                            <span className="font-medium text-error text-sm">Incorrect</span>
                          </div>
                        </div>
                      )}
                      
                      {/* Edge case: answered but no clear correct/incorrect status */}
                      {isCorrect !== true && isCorrect !== false && (
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-lg">
                          <div className="flex items-center">
                            <MessageSquare className="h-4 w-4 text-muted-foreground mr-2" />
                            <span className="font-medium text-muted-foreground text-sm">Answer Submitted</span>
                          </div>
                        </div>
                      )}
                      
                      {/* Always show Get Help button when feedback is shown */}
                      <Button
                        onClick={handleShowChatbot}
                        variant="outline"
                        className={cn(
                          "w-full py-3",
                          isCorrect === false 
                            ? "border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                            : "border-muted-foreground/30 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Get Help
                      </Button>
                    </div>
                  )}

                  {/* Show submit button or pending state */}
                  {!hasAnswer && (
                    <Button
                      onClick={handleSubmit}
                      disabled={!selectedAnswerState || isSubmitting}
                      className="w-full py-2 sm:py-2.5 md:py-3 bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      {isSubmitting ? "Submitting..." : "Submit Answer"}
                    </Button>
                  )}
                  
                  {/* Show pending state while waiting for server response */}
                  {isPending && (
                    <div className="p-3 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-lg">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                        <span className="font-medium text-muted-foreground text-sm">Checking answer...</span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chatbot Back */}
          <div className="card-flip-back">
            <Card className="w-full h-full flex flex-col bg-gray-50 dark:bg-gray-900 border shadow-sm overflow-hidden">
              {/* Remove overflow-hidden from Card to allow proper flex behavior */}
              {showChatbot && (
                (() => {
                  // Validate static explanation before deciding which component to render
                  const shouldShowStaticExplanation = hasValidStaticExplanation();
                  
                  if (shouldShowStaticExplanation) {
                    // Log validation success in development
                    if (import.meta.env.DEV) {
                      debugLog('Showing static explanation', {
                        questionId: question.id,
                        hasStaticExplanation: true,
                        explanationLength: question.latestVersion?.staticExplanation?.length
                      });
                    }
                    
                    return (
                      <StaticExplanation
                        explanation={question.latestVersion.staticExplanation}
                        onReviewQuestion={handleReviewQuestion}
                        questionVersionId={question.latestVersion?.id}
                      />
                    );
                  } else {
                    // Log fallback to chat in development
                    if (import.meta.env.DEV && question?.latestVersion?.isStaticAnswer) {
                      debugLog('Falling back to chat despite static flag', {
                        questionId: question.id,
                        isStaticAnswer: question.latestVersion?.isStaticAnswer,
                        hasExplanation: !!question.latestVersion?.staticExplanation,
                        explanationLength: question.latestVersion?.staticExplanation?.length || 0
                      });
                    }
                    
                    return (
                      <SimpleStreamingChat
                        /* key forces a fresh instance when we change questions or reset all */
                        key={`${question.id}-${chatResetTimestamp || 0}`}
                        questionVersionId={question.latestVersion?.id || question.id}
                        chosenAnswer={question.userAnswer?.chosenAnswer || submittedAnswer || selectedAnswer || ""}
                        correctAnswer={question.latestVersion?.correctAnswer || ""}
                        onReviewQuestion={handleReviewQuestion}
                      />
                    );
                  }
                })()
              )}
            </Card>
          </div>
        </div>
      </div>

      <style>
        {`.card-flip {
          perspective: 1000px;
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
        }
        .card-flip-inner {
          position: relative;
          width: 100%;
          text-align: left;
          transition: transform 0.6s;
          transform-style: preserve-3d;
          display: flex;
          flex-direction: column;
        }
        @media (min-width: 768px) {
          .card-flip-inner {
            height: 100%;
          }
        }
        .card-flip.flipped .card-flip-inner {
          transform: rotateY(180deg);
        }
        .card-flip-front, .card-flip-back {
          width: 100%;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
        @media (max-width: 767px) {
          /* Mobile: Use display toggle instead of 3D flip */
          .card-flip.flipped .card-flip-inner {
            transform: none;
          }
          .card-flip-front {
            display: flex;
            flex-direction: column;
            flex: 1;
            min-height: 0;
          }
          .card-flip-back {
            display: none;
            position: relative;
            flex: 1;
            min-height: 0;
          }
          .card-flip.flipped .card-flip-front {
            display: none;
          }
          .card-flip.flipped .card-flip-back {
            display: flex;
            flex-direction: column;
            flex: 1;
            min-height: 0;
            height: 100%;
            max-height: 100%;
            overflow: hidden;
          }
        }
        @media (min-width: 768px) {
          /* Desktop: Use 3D flip with absolute positioning */
          .card-flip-front, .card-flip-back {
            position: absolute;
            height: 100%;
            top: 0;
            left: 0;
          }
          .card-flip-back {
            transform: rotateY(180deg);
          }
        }`}
      </style>
    </div>
  );
}