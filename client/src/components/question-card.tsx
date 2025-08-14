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

// Import question type components
import { FillInBlank } from "./question-types/fill-in-blank";
import { TrueFalse } from "./question-types/true-false";
import { PickFromList } from "./question-types/pick-from-list";
import { Matching } from "./question-types/matching";
import { Ordering } from "./question-types/ordering";

// Question type configurations with diverse color palette
// Multiple choice uses primary app blue, others use distinct colors
const questionTypeConfig: Record<string, { label: string; color: string }> = {
  multiple_choice: { label: "Multiple Choice", color: "bg-primary/20 text-primary border-primary/30" },
  fill_in_blank: { label: "Fill in Blank", color: "bg-emerald-500/20 text-emerald-700 border-emerald-500/30" },
  true_false: { label: "True/False", color: "bg-purple-500/20 text-purple-700 border-purple-500/30" },
  matching: { label: "Matching", color: "bg-orange-500/20 text-orange-700 border-orange-500/30" },
  ordering: { label: "Ordering", color: "bg-pink-500/20 text-pink-700 border-pink-500/30" },
  drag_and_drop: { label: "Drag & Drop", color: "bg-teal-500/20 text-teal-700 border-teal-500/30" },
  numerical_entry: { label: "Numerical", color: "bg-indigo-500/20 text-indigo-700 border-indigo-500/30" },
  short_answer: { label: "Short Answer", color: "bg-red-500/20 text-red-700 border-red-500/30" },
  pick_from_list: { label: "Pick from List", color: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30" },
  multiple_response: { label: "Multiple Response", color: "bg-lime-500/20 text-lime-700 border-lime-500/30" },
  select_from_list: { label: "Select from List", color: "bg-violet-500/20 text-violet-700 border-violet-500/30" },
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
  // Log question details when component mounts or question changes
  useEffect(() => {
    if (question) {
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
        case "fill_in_blank":
        case "numerical_entry":
        case "short_answer":
          const caseSensitive = question.latestVersion.caseSensitive;
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
          break;
          
        case "matching":
        case "ordering":
        case "drag_and_drop":
        case "multiple_response":
          isAnswerCorrect = answerString === question.latestVersion.correctAnswer;
          break;
          
        case "select_from_list":
        case "pick_from_list":
        default:
          isAnswerCorrect = answerString === question.latestVersion.correctAnswer;
      }
      
      if (!isAnswerCorrect) {
        setIsFlipped(true);
      }
    }, 1500);
  };

  const handleReviewQuestion = () => {
    setIsFlipped(false);
  };

  const handleShowChatbot = () => {
    setIsFlipped(true);
  };

  // We only want to mount the chatbot *after* an answer has been captured
  const showChatbot =
    isFlipped &&
    (question.userAnswer?.chosenAnswer || submittedAnswer || selectedAnswer);

  return (
    <div className="w-full h-full flex flex-col">
      <div className={cn("card-flip w-full flex-1", isFlipped && "flipped")}>
        <div className="card-flip-inner">
          {/* Question Front */}
          <div className="card-flip-front">
            <Card className="h-full bg-card border shadow-sm flex flex-col">
              <CardContent className="p-2 sm:p-3 md:p-5 lg:p-6 xl:p-7 flex flex-col h-full">
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

                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                  {/* Render question based on type */}
                  {(() => {
                    switch (questionType) {
                      case "fill_in_blank":
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
                        
                      case "true_false":
                        return (
                          <div className="flex-1 min-h-0 flex flex-col">
                            <div className="mb-1.5 sm:mb-2 md:mb-4 lg:mb-5 flex-shrink-0">
                              <p className="text-base text-foreground leading-relaxed text-left">
                                {question.latestVersion?.questionText}
                              </p>
                            </div>
                            <div className="overflow-y-auto" style={{ maxHeight: 'calc(100% - 4rem)' }}>
                              <TrueFalse
                                value={hasAnswer ? question.userAnswer.chosenAnswer : selectedAnswerState}
                                onChange={setSelectedAnswerState}
                                disabled={hasAnswer || isSubmitting}
                                isCorrect={isCorrect}
                                correctAnswer={hasAnswer ? question.latestVersion?.correctAnswer : undefined}
                              />
                            </div>
                          </div>
                        );
                        
                      case "pick_from_list":
                        return (
                          <div className="flex-1 min-h-0 flex flex-col">
                            <div className="mb-1.5 sm:mb-2 md:mb-4 lg:mb-5 flex-shrink-0">
                              <p className="text-base text-foreground leading-relaxed text-left">
                                {question.latestVersion?.questionText}
                              </p>
                            </div>
                            <div className="overflow-y-auto" style={{ maxHeight: 'calc(100% - 4rem)' }}>
                              <PickFromList
                                answerChoices={question.latestVersion?.answerChoices || []}
                                value={hasAnswer ? question.userAnswer.chosenAnswer : selectedAnswerState}
                                onChange={setSelectedAnswerState}
                                allowMultiple={question.latestVersion?.allowMultiple}
                                disabled={hasAnswer || isSubmitting}
                                correctAnswer={hasAnswer ? question.latestVersion?.correctAnswer : undefined}
                              />
                            </div>
                          </div>
                        );
                        
                      case "matching":
                        return (
                          <div className="flex-1 min-h-0 flex flex-col">
                            <div className="mb-1.5 sm:mb-2 md:mb-4 lg:mb-5 flex-shrink-0">
                              <p className="text-base text-foreground leading-relaxed text-left">
                                {question.latestVersion?.questionText}
                              </p>
                            </div>
                            <div className="overflow-y-auto" style={{ maxHeight: 'calc(100% - 4rem)' }}>
                              <Matching
                                answerChoices={question.latestVersion?.answerChoices || []}
                                value={hasAnswer ? JSON.parse(question.userAnswer.chosenAnswer) : selectedAnswerState}
                                onChange={setSelectedAnswerState}
                                disabled={hasAnswer || isSubmitting}
                                correctAnswer={hasAnswer ? question.latestVersion?.correctAnswer : undefined}
                              />
                            </div>
                          </div>
                        );
                        
                      case "ordering":
                      case "drag_and_drop": // drag_and_drop uses the same component as ordering
                        return (
                          <div className="flex-1 min-h-0 flex flex-col">
                            <div className="mb-1.5 sm:mb-2 md:mb-4 lg:mb-5 flex-shrink-0">
                              <p className="text-base text-foreground leading-relaxed text-left">
                                {question.latestVersion?.questionText}
                              </p>
                            </div>
                            <div className="overflow-y-auto" style={{ maxHeight: 'calc(100% - 4rem)' }}>
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
                          <div className="flex-1 min-h-0 flex flex-col">
                            <div className="mb-1.5 sm:mb-2 md:mb-4 lg:mb-5 flex-shrink-0">
                              <p className="text-base text-foreground leading-relaxed text-left">
                                {question.latestVersion?.questionText}
                              </p>
                            </div>
                            <div className="overflow-y-auto" style={{ maxHeight: 'calc(100% - 4rem)' }}>
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
                        
                      case "select_from_list": // Uses PickFromList with allowMultiple=false
                        return (
                          <div className="flex-1 min-h-0 flex flex-col">
                            <div className="mb-1.5 sm:mb-2 md:mb-4 lg:mb-5 flex-shrink-0">
                              <p className="text-base text-foreground leading-relaxed text-left">
                                {question.latestVersion?.questionText}
                              </p>
                            </div>
                            <div className="overflow-y-auto" style={{ maxHeight: 'calc(100% - 4rem)' }}>
                              <PickFromList
                                answerChoices={question.latestVersion?.answerChoices || []}
                                value={hasAnswer ? question.userAnswer.chosenAnswer : selectedAnswerState}
                                onChange={setSelectedAnswerState}
                                allowMultiple={false}
                                disabled={hasAnswer || isSubmitting}
                                correctAnswer={hasAnswer ? question.latestVersion?.correctAnswer : undefined}
                              />
                            </div>
                          </div>
                        );
                        
                      default: // multiple_choice
                        return (
                          <div className="flex-1 min-h-0 flex flex-col">
                            <div className="mb-1.5 sm:mb-2 md:mb-4 lg:mb-5 flex-shrink-0">
                              <p className="text-base text-foreground leading-relaxed text-left">
                                {question.latestVersion?.questionText}
                              </p>
                            </div>
                            <div className="overflow-y-auto" style={{ maxHeight: 'calc(100% - 4rem)' }}>
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
                                        "flex items-start p-1.5 sm:p-2 md:p-3 lg:p-3.5 rounded-lg border cursor-pointer transition-all duration-200",
                                        "hover:border-primary hover:bg-accent",
                                        isSelected && "border-primary bg-primary/10",
                                        hasAnswer && "cursor-default"
                                      )}
                                    >
                                      <RadioGroupItem
                                        value={choiceLetter}
                                        id={choiceLetter}
                                        className="mt-0.5 sm:mt-1 md:mt-1.5 lg:mt-2 mr-2 sm:mr-3 md:mr-4 lg:mr-5 flex-shrink-0"
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

                {/* Action buttons - always visible at bottom */}
                <div className="mt-4 pt-1 sm:pt-2 md:pt-4 flex-shrink-0 border-t">
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
            <Card className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 border shadow-sm overflow-hidden">
              <div className="flex-1 min-h-0 overflow-hidden bg-gray-50 dark:bg-gray-900 flex flex-col">
                {showChatbot && (
                  <SimpleStreamingChat
                    /* key forces a fresh instance when we change questions or reset all */
                    key={`${question.id}-${chatResetTimestamp || 0}`}
                    questionVersionId={question.latestVersion?.id || question.id}
                    chosenAnswer={question.userAnswer?.chosenAnswer || submittedAnswer || selectedAnswer || ""}
                    correctAnswer={question.latestVersion?.correctAnswer || ""}
                  />
                )}
              </div>
              <div className="p-3 md:p-4 border-t border-border bg-accent flex-shrink-0">
                <Button 
                  onClick={handleReviewQuestion} 
                  variant="outline" 
                  className="w-full py-2 md:py-3 text-sm md:text-base border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Review Question
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>

      <style>
        {`.card-flip {
          perspective: 1000px;
          position: relative;
          z-index: 1;
        }
        .card-flip-inner {
          position: relative;
          width: 100%;
          height: 100%;
          text-align: left;
          transition: transform 0.6s;
          transform-style: preserve-3d;
        }
        .card-flip.flipped .card-flip-inner {
          transform: rotateY(180deg);
        }
        .card-flip-front, .card-flip-back {
          position: absolute;
          width: 100%;
          height: 100%;
          min-height: 400px;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          top: 0;
          left: 0;
        }
        .card-flip-back {
          transform: rotateY(180deg);
        }`}
      </style>
    </div>
  );
}