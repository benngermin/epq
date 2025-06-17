import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, MessageSquare, RotateCcw } from "lucide-react";
import { ChatInterface } from "./chat-interface";
import { cn } from "@/lib/utils";

interface QuestionCardProps {
  question: any;
  onSubmitAnswer: (answer: string) => void;
  isSubmitting: boolean;
  testRunId: number;
}

export function QuestionCard({ question, onSubmitAnswer, isSubmitting, testRunId }: QuestionCardProps) {
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
  }, [question?.id]);

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
            <Card className="min-h-[500px]">
              <CardContent className="p-4 sm:p-6 lg:p-8">
                <div className="mb-3 sm:mb-4">
                  <Badge variant="secondary" className="w-fit">
                    Question {(question.questionIndex || 0) + 1}
                  </Badge>
                </div>

                <div className="mb-6 sm:mb-8">
                  <p className="text-sm sm:text-base text-foreground leading-relaxed text-left">
                    {question.latestVersion?.questionText}
                  </p>
                </div>

                <RadioGroup
                  value={hasAnswer ? question.userAnswer.chosenAnswer : selectedAnswer}
                  onValueChange={setSelectedAnswer}
                  disabled={hasAnswer || isSubmitting}
                >
                  <div className="space-y-3 sm:space-y-4">
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
                              "flex items-start p-3 sm:p-4 rounded-lg border-2 cursor-pointer transition-colors",
                              "hover:border-primary",
                              isSelected && "border-primary bg-primary/5",
                              hasAnswer && isSelected && isCorrect && "border-green-500 bg-green-50",
                              hasAnswer && isSelected && !isCorrect && "border-red-500 bg-red-50",
                              hasAnswer && isCorrectChoice && !isSelected && "border-green-500 bg-green-50"
                            )}
                          >
                            <RadioGroupItem
                              value={choiceLetter}
                              id={choiceLetter}
                              className="mt-0.5 sm:mt-1 mr-3 sm:mr-4 flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm sm:text-base text-foreground leading-relaxed">
                                {choice.replace(/^[A-D]\.\s*/, '')}
                              </span>
                              {hasAnswer && isCorrectChoice && (
                                <CheckCircle className="inline-block ml-2 h-4 w-4 text-green-600" />
                              )}
                              {hasAnswer && isSelected && !isCorrect && (
                                <XCircle className="inline-block ml-2 h-4 w-4 text-red-600" />
                              )}
                            </div>
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </RadioGroup>

                {hasAnswer && isCorrect && (
                  <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                      <span className="font-medium text-green-800">Correct!</span>
                    </div>
                  </div>
                )}

                {hasAnswer && !isCorrect && (
                  <div className="mt-6 space-y-2">
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center">
                        <XCircle className="h-5 w-5 text-red-600 mr-2" />
                        <span className="font-medium text-red-800">Incorrect</span>
                      </div>
                    </div>
                    <Button
                      onClick={handleShowChatbot}
                      variant="outline"
                      className="w-full py-2 sm:py-3"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Chatbot
                    </Button>
                  </div>
                )}

                {!hasAnswer && (
                  <div className="mt-6 sm:mt-8">
                    <Button
                      onClick={handleSubmit}
                      disabled={!selectedAnswer || isSubmitting}
                      className="w-full py-2 sm:py-3"
                    >
                      {isSubmitting ? "Submitting..." : "Submit Answer"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Chatbot Back */}
          <div className="card-flip-back">
            <div className="h-[500px] sm:h-[600px] lg:h-[700px] flex flex-col">
              <div className="flex-1 min-h-0 overflow-hidden">
                <ChatInterface
                  questionVersionId={question.latestVersion?.id || question.id}
                  chosenAnswer={submittedAnswer || question.userAnswer?.chosenAnswer || ""}
                  correctAnswer={question.latestVersion?.correctAnswer || ""}
                />
              </div>
              <div className="p-3 sm:p-4 border-t bg-card flex-shrink-0">
                <Button 
                  onClick={handleReviewQuestion} 
                  variant="outline" 
                  className="w-full text-sm sm:text-base"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Review Question
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>
        {`.card-flip {
          perspective: 1000px;
        }
        .card-flip-inner {
          position: relative;
          width: 100%;
          height: 100%;
          text-align: center;
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
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
        .card-flip-back {
          transform: rotateY(180deg);
        }`}
      </style>
    </div>
  );
}