import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, MessageSquare, RotateCcw, ChevronRight } from "lucide-react";
import { SimpleStreamingChat } from "./simple-streaming-chat";
import { cn } from "@/lib/utils";
import { debugLog, debugError } from "@/utils/debug";

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
  const [submittedAnswer, setSubmittedAnswer] = useState<string>("");

  const hasAnswer = !!question?.userAnswer;
  const isCorrect = question?.userAnswer?.isCorrect;
  const questionType = question?.latestVersion?.questionType || "multiple_choice";

  // Reset flip state when question changes
  useEffect(() => {
    setIsFlipped(false);
    setSelectedAnswerState("");
    setSubmittedAnswer("");
    onFlipChange?.(false);
  }, [question?.id, onFlipChange]);

  // Notify parent when flip state changes
  useEffect(() => {
    onFlipChange?.(isFlipped);
  }, [isFlipped, onFlipChange]);

  const handleSubmit = () => {
    if (!selectedAnswerState || hasAnswer || !question?.latestVersion) return;

    // Convert answer to string format for storage
    let answerString = selectedAnswerState;
    if (typeof selectedAnswerState === 'object') {
      answerString = JSON.stringify(selectedAnswerState);
    }

    setSubmittedAnswer(answerString);
    onSubmitAnswer(answerString);

    // Check if answer is correct based on question type
    setTimeout(() => {
      let isAnswerCorrect = false;
      
      switch (questionType) {
        case "numerical_entry":
          // Special handling for numerical_entry to support multi-blank
          if (answerString.startsWith('{')) {
            try {
              const userBlanks = JSON.parse(answerString);
              const blankValues = Object.values(userBlanks).map((v: any) => String(v).trim());
              
              // For numerical_entry, clean the correct answer format
              // Remove "[blank_X]:" prefixes to get just the values
              const correctAnswer = question.latestVersion.correctAnswer;
              const correctCleaned = correctAnswer.replace(/\[blank_\d+\]:\s*/g, '').trim();
              
              // Join with comma and space to match server-side logic
              const userFullAnswer = blankValues.join(', ');
              
              // First try exact match
              if (userFullAnswer === correctCleaned) {
                isAnswerCorrect = true;
              } else {
                // Try numerical comparison for each value
                const correctValues = correctCleaned.split(',').map(v => v.trim());
                
                if (blankValues.length === correctValues.length) {
                  isAnswerCorrect = blankValues.every((userVal, index) => {
                    const userNum = parseFloat(userVal);
                    const correctNum = parseFloat(correctValues[index]);
                    
                    if (!isNaN(userNum) && !isNaN(correctNum)) {
                      // Allow for floating point precision issues
                      return Math.abs(userNum - correctNum) < 0.0001;
                    }
                    // Fall back to string comparison if not numeric
                    return userVal === correctValues[index];
                  });
                }
              }
              
              // Check acceptable answers if provided
              if (!isAnswerCorrect && question.latestVersion.acceptableAnswers) {
                isAnswerCorrect = question.latestVersion.acceptableAnswers.some((acceptable: string) => 
                  userFullAnswer === acceptable
                );
              }
            } catch (e) {
              // If JSON parse fails, treat as single numerical answer
              const userNum = parseFloat(answerString);
              const correctNum = parseFloat(question.latestVersion.correctAnswer);
              
              if (!isNaN(userNum) && !isNaN(correctNum)) {
                isAnswerCorrect = Math.abs(userNum - correctNum) < 0.0001;
              } else {
                isAnswerCorrect = answerString === question.latestVersion.correctAnswer;
              }
            }
          } else {
            // Single numerical answer
            const userNum = parseFloat(answerString);
            const correctNum = parseFloat(question.latestVersion.correctAnswer);
            
            if (!isNaN(userNum) && !isNaN(correctNum)) {
              isAnswerCorrect = Math.abs(userNum - correctNum) < 0.0001;
            } else {
              isAnswerCorrect = answerString === question.latestVersion.correctAnswer;
            }
            
            // Check acceptable answers
            if (!isAnswerCorrect && question.latestVersion.acceptableAnswers) {
              isAnswerCorrect = question.latestVersion.acceptableAnswers.some((acceptable: string) => {
                const acceptableNum = parseFloat(acceptable);
                if (!isNaN(userNum) && !isNaN(acceptableNum)) {
                  return Math.abs(userNum - acceptableNum) < 0.0001;
                }
                return answerString === acceptable;
              });
            }
          }
          break;
          
        case "short_answer":
          const caseSensitive = question.latestVersion.caseSensitive;
          
          // Check if this is a multi-blank answer (JSON format)
          if (answerString.startsWith('{')) {
            try {
              const userBlanks = JSON.parse(answerString);
              const blankValues = Object.values(userBlanks).map((v: any) => 
                caseSensitive ? String(v) : String(v).toLowerCase()
              );
              
              // Join the blank values with comma and space to match server logic
              const userFullAnswer = blankValues.join(', ');
              const correctFullAnswer = caseSensitive 
                ? question.latestVersion.correctAnswer 
                : question.latestVersion.correctAnswer.toLowerCase();
              
              isAnswerCorrect = userFullAnswer === correctFullAnswer;
              
              // Check acceptable answers for multi-blank
              if (!isAnswerCorrect && question.latestVersion.acceptableAnswers) {
                const acceptableAnswers = question.latestVersion.acceptableAnswers.map((a: string) => 
                  caseSensitive ? a : a.toLowerCase()
                );
                isAnswerCorrect = acceptableAnswers.includes(userFullAnswer);
              }
            } catch (e) {
              // If JSON parse fails, treat as single answer
              const correctAnswer = caseSensitive ? question.latestVersion.correctAnswer : question.latestVersion.correctAnswer.toLowerCase();
              const userAnswer = caseSensitive ? answerString : answerString.toLowerCase();
              isAnswerCorrect = userAnswer === correctAnswer;
            }
          } else {
            // Single blank answer
            const correctAnswer = caseSensitive ? question.latestVersion.correctAnswer : question.latestVersion.correctAnswer.toLowerCase();
            const userAnswer = caseSensitive ? answerString : answerString.toLowerCase();
            
            isAnswerCorrect = userAnswer === correctAnswer;
            
            // Check acceptable answers
            if (!isAnswerCorrect && question.latestVersion.acceptableAnswers) {
              const acceptableAnswers = question.latestVersion.acceptableAnswers.map((a: string) => 
                caseSensitive ? a : a.toLowerCase()
              );
              isAnswerCorrect = acceptableAnswers.includes(userAnswer);
            }
          }
          break;
          
        case "select_from_list":
          // For select_from_list with blanks in the text, compare JSON objects
          if (question.latestVersion.blanks && question.latestVersion.questionText?.includes('___')) {
            const userBlanks = JSON.parse(answerString);
            const correctBlanks = question.latestVersion.blanks || [];
            isAnswerCorrect = correctBlanks.every((blank: any) =>
              userBlanks[blank.blank_id] === blank.correct_answer
            );
          } else if (question.latestVersion.blanks && question.latestVersion.blanks[0]) {
            // For select_from_list with blanks data but no blanks in text (regular dropdown)
            // The answer is the selected choice directly
            isAnswerCorrect = answerString === question.latestVersion.blanks[0].correct_answer;
          } else {
            isAnswerCorrect = answerString === question.latestVersion.correctAnswer;
          }
          break;
          
        case "drag_and_drop":
          // Compare zone contents
          if (question.latestVersion.dropZones) {
            try {
              const userZones = JSON.parse(answerString);
              
              // Parse correctAnswer if it's a string
              let correctZones: Record<string, string[]>;
              if (typeof question.latestVersion.correctAnswer === 'string') {
                correctZones = JSON.parse(question.latestVersion.correctAnswer);
              } else {
                correctZones = question.latestVersion.correctAnswer;
              }
              
              // Normalize both user and correct zones to use consistent key format
              // Handle both "zone_1" and "1" formats
              const normalizedUserZones: Record<string, string[]> = {};
              const normalizedCorrectZones: Record<string, string[]> = {};
              
              // Normalize user zones
              for (const key in userZones) {
                // Convert to "zone_X" format if not already
                const normalizedKey = key.startsWith('zone_') ? key : `zone_${key}`;
                normalizedUserZones[normalizedKey] = userZones[key] || [];
              }
              
              // Normalize correct zones (they should already be in "zone_X" format from DB)
              for (const key in correctZones) {
                const normalizedKey = key.startsWith('zone_') ? key : `zone_${key}`;
                normalizedCorrectZones[normalizedKey] = correctZones[key] || [];
              }
              
              // Compare each zone's contents
              isAnswerCorrect = true;
              
              // Check if all zones have the same items (order doesn't matter within a zone)
              for (const zoneId in normalizedCorrectZones) {
                const correctItems = normalizedCorrectZones[zoneId] || [];
                const userItems = normalizedUserZones[zoneId] || [];
                
                // Sort both arrays to compare regardless of order within the zone
                const sortedCorrect = [...correctItems].sort();
                const sortedUser = [...userItems].sort();
                
                if (JSON.stringify(sortedCorrect) !== JSON.stringify(sortedUser)) {
                  isAnswerCorrect = false;
                  break;
                }
              }
              
              // Also check if user has items in zones that shouldn't have any
              for (const zoneId in normalizedUserZones) {
                if (!normalizedCorrectZones[zoneId] && normalizedUserZones[zoneId] && normalizedUserZones[zoneId].length > 0) {
                  isAnswerCorrect = false;
                  break;
                }
              }
            } catch (e) {
              console.error('Error parsing drag and drop answer:', e);
              isAnswerCorrect = false;
            }
          } else {
            // Fallback for old format
            isAnswerCorrect = answerString === question.latestVersion.correctAnswer;
          }
          break;
          
        case "multiple_response":
          // Handle array comparison for multiple responses
          const userResponses = Array.isArray(answerString) ? answerString : JSON.parse(answerString);
          const correctResponses = Array.isArray(question.latestVersion.correctAnswer)
            ? question.latestVersion.correctAnswer
            : [question.latestVersion.correctAnswer];
          isAnswerCorrect = JSON.stringify(userResponses.sort()) === JSON.stringify(correctResponses.sort());
          break;
          
        case "either_or":
        default:
          isAnswerCorrect = answerString === question.latestVersion.correctAnswer;
      }
      
      if (!isAnswerCorrect) {
        setIsFlipped(true);
      }
    }, 2500);
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
                                  value={hasAnswer ? question.userAnswer.chosenAnswer : selectedAnswerState}
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
                                  value={hasAnswer ? JSON.parse(question.userAnswer.chosenAnswer) : selectedAnswerState}
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
                            value={hasAnswer ? question.userAnswer.chosenAnswer : selectedAnswerState}
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
                                value={hasAnswer ? question.userAnswer.chosenAnswer : selectedAnswerState}
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
                                value={hasAnswer ? question.userAnswer.chosenAnswer : selectedAnswerState}
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
                                  value={hasAnswer ? question.userAnswer.chosenAnswer : selectedAnswerState}
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
                                value={hasAnswer ? question.userAnswer.chosenAnswer : selectedAnswerState}
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
                                value={hasAnswer ? question.userAnswer.chosenAnswer : selectedAnswerState}
                                onValueChange={setSelectedAnswerState}
                                disabled={hasAnswer || isSubmitting}
                                className="flex flex-col justify-start gap-1 sm:gap-1.5 md:gap-2.5 lg:gap-3"
                              >
                                {question.latestVersion?.answerChoices?.map((choice: string, index: number) => {
                                  const choiceLetter = String.fromCharCode(65 + index); // A, B, C, D
                                  const isSelected = hasAnswer 
                                    ? question.userAnswer.chosenAnswer === choiceLetter
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
                  {hasAnswer && isCorrect && (
                    <div className="space-y-3">
                      <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                        <div className="flex items-center">
                          <CheckCircle className="h-4 w-4 text-success mr-2" />
                          <span className="font-medium text-success text-sm">Correct!</span>
                        </div>
                      </div>
                      <Button
                        onClick={handleShowChatbot}
                        variant="outline"
                        className="w-full py-3 border-muted-foreground/30 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Get Help
                      </Button>
                    </div>
                  )}

                  {hasAnswer && !isCorrect && (
                    <div className="space-y-3">
                      <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <div className="flex items-center">
                          <XCircle className="h-4 w-4 text-error mr-2" />
                          <span className="font-medium text-error text-sm">Incorrect</span>
                        </div>
                      </div>
                      <Button
                        onClick={handleShowChatbot}
                        variant="outline"
                        className="w-full py-3 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Get Help
                      </Button>
                    </div>
                  )}

                  {!hasAnswer && (
                    <Button
                      onClick={handleSubmit}
                      disabled={!selectedAnswerState || isSubmitting}
                      className="w-full py-2 sm:py-2.5 md:py-3 bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      {isSubmitting ? "Submitting..." : "Submit Answer"}
                    </Button>
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
                <SimpleStreamingChat
                  /* key forces a fresh instance when we change questions or reset all */
                  key={`${question.id}-${chatResetTimestamp || 0}`}
                  questionVersionId={question.latestVersion?.id || question.id}
                  chosenAnswer={question.userAnswer?.chosenAnswer || submittedAnswer || selectedAnswer || ""}
                  correctAnswer={question.latestVersion?.correctAnswer || ""}
                  onReviewQuestion={handleReviewQuestion}
                />
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