import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle } from "lucide-react";
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
  const [showChat, setShowChat] = useState(false);

  const hasAnswer = !!question.userAnswer;
  const isCorrect = question.userAnswer?.isCorrect;

  const handleSubmit = () => {
    if (!selectedAnswer || hasAnswer) return;
    
    onSubmitAnswer(selectedAnswer);
    
    // If incorrect, flip the card after a short delay
    setTimeout(() => {
      if (selectedAnswer !== question.correctAnswer) {
        setIsFlipped(true);
        setShowChat(true);
      }
    }, 1000);
  };

  const handleContinue = () => {
    setIsFlipped(false);
    setShowChat(false);
    setSelectedAnswer("");
  };

  return (
    <div className="w-full">
      <div className={cn("card-flip w-full", isFlipped && "flipped")}>
        <div className="card-flip-inner">
          {/* Question Front */}
          <div className="card-flip-front">
            <Card className="min-h-96">
              <CardContent className="p-4 sm:p-6 lg:p-8">
                <div className="mb-4 sm:mb-6">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                    <Badge variant="secondary" className="w-fit">
                      Question {question.questionIndex + 1}
                    </Badge>
                    <span className="text-xs sm:text-sm text-muted-foreground">
                      {question.topicFocus}
                    </span>
                  </div>
                </div>

                <div className="mb-6 sm:mb-8">
                  <h2 className="text-lg sm:text-xl font-medium text-foreground leading-relaxed">
                    {question.questionText}
                  </h2>
                </div>

                <RadioGroup
                  value={hasAnswer ? question.userAnswer.chosenAnswer : selectedAnswer}
                  onValueChange={setSelectedAnswer}
                  disabled={hasAnswer || isSubmitting}
                >
                  <div className="space-y-3 sm:space-y-4">
                    {question.answerChoices.map((choice: string, index: number) => {
                      const choiceLetter = String.fromCharCode(65 + index); // A, B, C, D
                      const isSelected = hasAnswer 
                        ? question.userAnswer.chosenAnswer === choiceLetter
                        : selectedAnswer === choiceLetter;
                      const isCorrectChoice = choiceLetter === question.correctAnswer;
                      
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

          {/* Question Back (Feedback & Chatbot) */}
          <div className="card-flip-back">
            <Card className="min-h-96">
              <CardContent className="p-6">
                <div className="mb-4">
                  <div className="flex items-center mb-3">
                    <XCircle className="h-5 w-5 text-red-500 mr-2" />
                    <span className="text-lg font-semibold">Incorrect Answer</span>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-gray-700">
                      <strong>Your answer:</strong> {question.userAnswer?.chosenAnswer} - {
                        question.answerChoices.find((choice: string) => 
                          choice.startsWith(question.userAnswer?.chosenAnswer + ".")
                        )?.replace(/^[A-D]\.\s*/, '')
                      }
                      <br />
                      <strong>Correct answer:</strong> {question.correctAnswer} - {
                        question.answerChoices.find((choice: string) => 
                          choice.startsWith(question.correctAnswer + ".")
                        )?.replace(/^[A-D]\.\s*/, '')
                      }
                    </p>
                  </div>
                </div>

                <div className="max-h-[50vh] overflow-y-auto mb-4">
                  {showChat && (
                    <ChatInterface
                      questionVersionId={question.id}
                      chosenAnswer={question.userAnswer?.chosenAnswer}
                      correctAnswer={question.correctAnswer}
                    />
                  )}
                </div>

                <div className="mt-4">
                  <Button onClick={handleContinue} className="w-full">
                    Continue
                  </Button>
                </div>
              </CardContent>
            </Card>
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