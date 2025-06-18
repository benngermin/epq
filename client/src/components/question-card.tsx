import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, MessageSquare, RotateCcw, ChevronRight } from "lucide-react";
import { ChatInterface } from "./chat-interface";
import { cn } from "@/lib/utils";

interface QuestionCardProps {
  question: any;
  onSubmitAnswer: (answer: string) => void;
  isSubmitting: boolean;
  testRunId: number;
  onFlipChange?: (isFlipped: boolean) => void;
  onNextQuestion?: () => void;
  hasNextQuestion?: boolean;
}

export function QuestionCard({ question, onSubmitAnswer, isSubmitting, testRunId, onFlipChange, onNextQuestion, hasNextQuestion }: QuestionCardProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [isFlipped, setIsFlipped] = useState(false);
  const [submittedAnswer, setSubmittedAnswer] = useState<string>("");

  const hasAnswer = !!question.userAnswer;
  const isCorrect = question.userAnswer?.isCorrect;

  // Reset flip state when question changes
  useEffect(() => {
    setIsFlipped(false);
    setSelectedAnswer("");
    setSubmittedAnswer("");
    onFlipChange?.(false);
  }, [question?.id, onFlipChange]);

  // Notify parent when flip state changes
  useEffect(() => {
    onFlipChange?.(isFlipped);
  }, [isFlipped, onFlipChange]);

  const handleSubmit = () => {
    if (!selectedAnswer || hasAnswer) return;

    setSubmittedAnswer(selectedAnswer);
    onSubmitAnswer(selectedAnswer);

    // If incorrect, flip the card after a short delay to show chatbot
    setTimeout(() => {
      if (selectedAnswer !== question.latestVersion?.correctAnswer) {
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

  return (
    <div className="w-full">
      <div className={cn("card-flip w-full", isFlipped && "flipped")}>
        <div className="card-flip-inner">
          {/* Question Front */}
          <div className="card-flip-front">
            <Card className="max-h-[calc(100vh-200px)] bg-card border shadow-sm flex flex-col">
              <CardContent className="p-3 sm:p-4 md:p-4 lg:p-5 xl:p-6 flex flex-col flex-1 min-h-0">
                <div className="flex-1 overflow-y-auto">
                  <div className="mb-2 sm:mb-3 md:mb-4">
                    <Badge variant="secondary" className="w-fit bg-accent text-accent-foreground border text-xs sm:text-sm md:text-base">
                      Question {(question.questionIndex || 0) + 1}
                    </Badge>
                  </div>

                  <div className="mb-3 sm:mb-4 md:mb-5 lg:mb-6">
                    <p className="text-sm sm:text-base md:text-base lg:text-lg text-foreground leading-relaxed text-left">
                      {question.latestVersion?.questionText}
                    </p>
                  </div>

                  <RadioGroup
                    value={hasAnswer ? question.userAnswer.chosenAnswer : selectedAnswer}
                    onValueChange={setSelectedAnswer}
                    disabled={hasAnswer || isSubmitting}
                  >
                    <div className="space-y-2 sm:space-y-2.5 md:space-y-3 lg:space-y-3.5">
                      {question.latestVersion?.answerChoices?.map((choice: string, index: number) => {
                        const choiceLetter = String.fromCharCode(65 + index); // A, B, C, D
                        const isSelected = hasAnswer 
                          ? question.userAnswer.chosenAnswer === choiceLetter
                          : selectedAnswer === choiceLetter;
                        const isCorrectChoice = choiceLetter === question.latestVersion?.correctAnswer;

                        return (
                          <div key={choiceLetter}>
                            <Label
                              htmlFor={choiceLetter}
                              className={cn(
                                "flex items-start p-2 sm:p-2.5 md:p-3 lg:p-3.5 rounded-lg border cursor-pointer transition-all duration-200",
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
                                <span className="text-sm sm:text-base md:text-base lg:text-lg xl:text-lg text-foreground leading-relaxed">
                                  {choice.replace(/^[A-D]\.\s*/, '')}
                                </span>
                              </div>
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  </RadioGroup>

                  {hasAnswer && isCorrect && (
                    <div className="mt-4 sm:mt-5 md:mt-6 lg:mt-7 xl:mt-8 space-y-3 sm:space-y-4">
                      <div className="p-3 sm:p-4 md:p-5 lg:p-6 bg-success/10 border border-success/20 rounded-lg">
                        <div className="flex items-center">
                          <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-success mr-2 sm:mr-3" />
                          <span className="font-medium text-success text-sm sm:text-base md:text-base lg:text-lg">Correct!</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {hasAnswer && !isCorrect && (
                    <div className="mt-4 sm:mt-5 md:mt-6 lg:mt-7 xl:mt-8 space-y-2 sm:space-y-3">
                      <div className="p-3 sm:p-4 md:p-5 lg:p-6 bg-error/10 border border-error/20 rounded-lg">
                        <div className="flex items-center">
                          <XCircle className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-error mr-2 sm:mr-3" />
                          <span className="font-medium text-error text-sm sm:text-base md:text-base lg:text-lg">Incorrect</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action buttons - always visible at bottom */}
                <div className="mt-4 flex-shrink-0 border-t pt-4">
                  {hasAnswer && isCorrect && (
                    <div className="space-y-3">
                      <div className="p-3 bg-success/10 border border-success/20 rounded-lg">
                        <div className="flex items-center">
                          <CheckCircle className="h-4 w-4 text-success mr-2" />
                          <span className="font-medium text-success text-sm">Correct!</span>
                        </div>
                      </div>
                      {hasNextQuestion && (
                        <Button onClick={onNextQuestion} className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground">
                          Next Question
                          <ChevronRight className="h-4 w-4 ml-2" />
                        </Button>
                      )}
                    </div>
                  )}

                  {hasAnswer && !isCorrect && (
                    <div className="space-y-3">
                      <div className="p-3 bg-error/10 border border-error/20 rounded-lg">
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
                        Get AI Help
                      </Button>
                      {hasNextQuestion && (
                        <Button onClick={onNextQuestion} className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground">
                          Next Question
                          <ChevronRight className="h-4 w-4 ml-2" />
                        </Button>
                      )}
                    </div>
                  )}

                  {!hasAnswer && (
                    <Button
                      onClick={handleSubmit}
                      disabled={!selectedAnswer || isSubmitting}
                      className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground"
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
            <Card className="h-full min-h-[500px] max-h-[calc(100vh-200px)] flex flex-col bg-card border shadow-sm">
              <div className="flex-1 min-h-0 overflow-hidden">
                <ChatInterface
                  questionVersionId={question.latestVersion?.id || question.id}
                  chosenAnswer={submittedAnswer || question.userAnswer?.chosenAnswer || ""}
                  correctAnswer={question.latestVersion?.correctAnswer || ""}
                />
              </div>
              <div className="p-3 md:p-4 border-t bg-accent flex-shrink-0 space-y-2">
                <Button 
                  onClick={handleReviewQuestion} 
                  variant="outline" 
                  className="w-full py-2 md:py-3 text-sm md:text-base border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Review Question
                </Button>
                {hasNextQuestion && (
                  <Button onClick={onNextQuestion} className="w-full py-2 md:py-3 text-sm md:text-base bg-primary hover:bg-primary/90 text-primary-foreground">
                    Next Question
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      <style>
        {`.card-flip {
          perspective: 1000px;
          min-height: 500px;
          position: relative;
          z-index: 1;
        }
        .card-flip-inner {
          position: relative;
          width: 100%;
          height: 100%;
          min-height: inherit;
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
          min-height: inherit;
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