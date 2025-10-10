import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { useState } from "react";

interface QuestionTypeEditorProps {
  questionType: string;
  value: any;
  onChange: (value: any) => void;
}

export function QuestionTypeEditor({ questionType, value, onChange }: QuestionTypeEditorProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [deleteChoiceIndex, setDeleteChoiceIndex] = useState<number | null>(null);
  const [deleteIsCorrectAnswer, setDeleteIsCorrectAnswer] = useState<boolean>(false);
  const [newCorrectAnswerForDelete, setNewCorrectAnswerForDelete] = useState<string>("");
  const [deleteAcceptableIndex, setDeleteAcceptableIndex] = useState<number | null>(null);

  const handleArrayChange = (field: string, newArray: any[]) => {
    // Always pass the array as-is to allow for editing empty fields
    // Empty validation should happen on save, not during editing
    onChange({ ...value, [field]: newArray });
  };

  const handleFieldChange = (field: string, newValue: any) => {
    onChange({ ...value, [field]: newValue });
  };

  // Handle delete acceptable answer click
  const handleDeleteAcceptableClick = (index: number) => {
    setDeleteAcceptableIndex(index);
  };

  // Perform deletion of acceptable answer
  const performDeleteAcceptable = () => {
    if (deleteAcceptableIndex !== null) {
      const newAnswers = (value.acceptableAnswers || []).filter((_: any, i: number) => i !== deleteAcceptableIndex);
      handleFieldChange("acceptableAnswers", newAnswers.length === 0 ? [] : newAnswers);
      setDeleteAcceptableIndex(null);
    }
  };

  // Perform deletion of answer choice
  const performDeleteChoice = (fieldName: string = "answerChoices") => {
    console.log("performDeleteChoice called with:", {
      deleteChoiceIndex,
      deleteIsCorrectAnswer,
      newCorrectAnswerForDelete,
      fieldName,
      currentChoices: value[fieldName]
    });
    
    if (deleteChoiceIndex !== null) {
      const newChoices = (value[fieldName] || []).filter((_: any, i: number) => i !== deleteChoiceIndex);
      
      console.log("New choices after deletion:", newChoices);
      
      // Create the complete updated value object with ALL changes
      let updatedValue = {
        ...value,
        [fieldName]: newChoices
      };
      
      // Handle correct answer updates
      if (deleteIsCorrectAnswer && newCorrectAnswerForDelete) {
        // If we're deleting the correct answer, use the new one selected
        console.log("Updating correct answer to:", newCorrectAnswerForDelete);
        updatedValue.correctAnswer = newCorrectAnswerForDelete;
      } else if (!deleteIsCorrectAnswer && value.correctAnswer) {
        // If the correct answer index is after the deleted one, adjust it
        const currentCorrectIndex = value.correctAnswer.charCodeAt(0) - 65;
        if (currentCorrectIndex > deleteChoiceIndex) {
          const newCorrectLetter = String.fromCharCode(65 + currentCorrectIndex - 1);
          console.log("Adjusting correct answer from", value.correctAnswer, "to", newCorrectLetter);
          updatedValue.correctAnswer = newCorrectLetter;
        }
      }
      
      // Make a SINGLE onChange call with ALL updates
      onChange(updatedValue);
      
      // Reset state
      setDeleteChoiceIndex(null);
      setDeleteIsCorrectAnswer(false);
      setNewCorrectAnswerForDelete("");
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number, arrayName: string) => {
    e.preventDefault();
    if (draggedIndex === null) return;
    
    const items = [...(value[arrayName] || [])];
    const draggedItem = items[draggedIndex];
    
    items.splice(draggedIndex, 1);
    items.splice(dropIndex, 0, draggedItem);
    
    handleArrayChange(arrayName, items);
    setDraggedIndex(null);
  };

  // Common component for answer choices array
  const AnswerChoicesEditor = ({ fieldName = "answerChoices", showAddButton = true }: { fieldName?: string, showAddButton?: boolean }) => {
    // Determine if an answer choice is correct
    const isCorrectAnswer = (index: number) => {
      const letter = String.fromCharCode(65 + index);
      return value.correctAnswer === letter;
    };

    // Handle delete button click - show confirmation modal
    const handleDeleteClick = (index: number) => {
      console.log("Delete button clicked for index:", index);
      const isCorrect = isCorrectAnswer(index);
      console.log("Is correct answer?", isCorrect);
      setDeleteChoiceIndex(index);
      setDeleteIsCorrectAnswer(isCorrect);
      if (!isCorrect) {
        // If not the correct answer, we can proceed with normal delete confirmation
        setNewCorrectAnswerForDelete("");
      }
    };

    return (
      <>
        <div className="space-y-2">
          <Label>Answer Choices</Label>
          {(value[fieldName] || []).map((choice: string, index: number) => {
            const isCorrect = isCorrectAnswer(index);
            // Use a stable key based on index and fieldName
            const stableKey = `${fieldName}-choice-${index}`;
            return (
              <div 
                key={stableKey}
                className={`flex items-center gap-2 p-2 rounded-md transition-colors ${
                  isCorrect ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800' : ''
                }`}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index, fieldName)}
              >
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                <span className={`font-semibold min-w-[2rem] ${
                  isCorrect ? 'text-green-700 dark:text-green-400' : ''
                }`}>
                  {String.fromCharCode(65 + index)}.
                </span>
                <Input
                  value={choice}
                  onChange={(e) => {
                    const newChoices = [...(value[fieldName] || [])];
                    newChoices[index] = e.target.value;
                    handleArrayChange(fieldName, newChoices);
                  }}
                  placeholder={`Answer choice ${String.fromCharCode(65 + index)}`}
                  className={isCorrect ? 'border-green-300 dark:border-green-700' : ''}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  type="button"
                  onClick={() => handleDeleteClick(index)}
                  data-testid={`button-remove-choice-${index}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
          {showAddButton && (
            <Button
              onClick={() => {
                const currentArray = value[fieldName] || [];
                const newArray = [...currentArray, ""];
                handleArrayChange(fieldName, newArray);
              }}
              variant="outline"
              size="sm"
              type="button"
              data-testid="button-add-choice"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Choice
            </Button>
          )}
        </div>

        {/* Delete confirmation modal for non-correct answers */}
        <AlertDialog 
          open={deleteChoiceIndex !== null && !deleteIsCorrectAnswer} 
          onOpenChange={(open) => {
            if (!open) {
              setDeleteChoiceIndex(null);
              setDeleteIsCorrectAnswer(false);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Answer Choice</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete answer choice {deleteChoiceIndex !== null ? String.fromCharCode(65 + deleteChoiceIndex) : ''}?
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => performDeleteChoice(fieldName)}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete confirmation modal for correct answer - requires selecting new correct answer */}
        <AlertDialog 
          open={deleteChoiceIndex !== null && deleteIsCorrectAnswer} 
          onOpenChange={(open) => {
            if (!open) {
              setDeleteChoiceIndex(null);
              setDeleteIsCorrectAnswer(false);
              setNewCorrectAnswerForDelete("");
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cannot Delete Correct Answer</AlertDialogTitle>
              <AlertDialogDescription>
                You're trying to delete the correct answer (Choice {deleteChoiceIndex !== null ? String.fromCharCode(65 + deleteChoiceIndex) : ''}).
                Please select a new correct answer before deleting this choice.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Label htmlFor="new-correct-answer">Select New Correct Answer</Label>
              <Select
                value={newCorrectAnswerForDelete}
                onValueChange={setNewCorrectAnswerForDelete}
              >
                <SelectTrigger id="new-correct-answer">
                  <SelectValue placeholder="Choose a new correct answer" />
                </SelectTrigger>
                <SelectContent>
                  {(value[fieldName] || []).map((_: string, i: number) => {
                    // Don't show the choice we're trying to delete
                    if (i === deleteChoiceIndex) return null;
                    const letter = String.fromCharCode(65 + i);
                    return (
                      <SelectItem key={i} value={letter}>
                        {letter} - {value[fieldName][i]}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => performDeleteChoice(fieldName)}
                disabled={!newCorrectAnswerForDelete}
              >
                Update & Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  };

  switch (questionType) {
    case "multiple_choice":
      return (
        <div className="space-y-4">
          <AnswerChoicesEditor showAddButton={false} />
          <div>
            <Label htmlFor="correctAnswer">Correct Answer</Label>
            <Select
              value={value.correctAnswer || ""}
              onValueChange={(val) => handleFieldChange("correctAnswer", val)}
            >
              <SelectTrigger id="correctAnswer" data-testid="select-correct-answer">
                <SelectValue placeholder="Select correct answer" />
              </SelectTrigger>
              <SelectContent>
                {(value.answerChoices || []).map((_: string, index: number) => (
                  <SelectItem key={index} value={String.fromCharCode(65 + index)}>
                    {String.fromCharCode(65 + index)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      );

    case "multiple_response":
      return (
        <div className="space-y-4">
          <AnswerChoicesEditor showAddButton={false} />
          <div>
            <Label>Correct Answers (select multiple)</Label>
            <div className="space-y-2 mt-2">
              {(value.answerChoices || []).map((_: string, index: number) => {
                const letter = String.fromCharCode(65 + index);
                const correctAnswers = Array.isArray(value.correctAnswer) 
                  ? value.correctAnswer 
                  : (value.correctAnswer || "").split(",").filter(Boolean);
                return (
                  <div key={index} className="flex items-center space-x-2">
                    <Checkbox
                      id={`correct-${index}`}
                      checked={correctAnswers.includes(letter)}
                      onCheckedChange={(checked) => {
                        let newCorrect = [...correctAnswers];
                        if (checked) {
                          if (!newCorrect.includes(letter)) {
                            newCorrect.push(letter);
                          }
                        } else {
                          newCorrect = newCorrect.filter(l => l !== letter);
                        }
                        handleFieldChange("correctAnswer", newCorrect.sort());
                      }}
                      data-testid={`checkbox-correct-${index}`}
                    />
                    <Label htmlFor={`correct-${index}`}>{letter}</Label>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );

    case "numerical_entry":
      return (
        <>
          <div className="space-y-4">
            <div>
              <Label htmlFor="correctAnswer">Correct Answer</Label>
              <Input
                id="correctAnswer"
                value={value.correctAnswer || ""}
                onChange={(e) => handleFieldChange("correctAnswer", e.target.value)}
                placeholder="Enter the correct numerical answer"
                data-testid="input-correct-answer"
              />
            </div>
            <div className="space-y-2">
              <Label>Acceptable Answers (alternative correct answers)</Label>
              {(value.acceptableAnswers || []).map((answer: string, index: number) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={answer}
                    onChange={(e) => {
                      const newAnswers = [...(value.acceptableAnswers || [])];
                      newAnswers[index] = e.target.value;
                      handleFieldChange("acceptableAnswers", newAnswers);
                    }}
                    placeholder="Alternative answer"
                    data-testid={`input-acceptable-${index}`}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDeleteAcceptableClick(index);
                    }}
                    data-testid={`button-remove-acceptable-${index}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const currentAnswers = value.acceptableAnswers || [];
                  const newAnswers = [...currentAnswers, ""];
                  handleFieldChange("acceptableAnswers", newAnswers);
                }}
                variant="outline"
                size="sm"
                type="button"
                data-testid="button-add-acceptable"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Acceptable Answer
              </Button>
            </div>
          </div>
          
          {/* Confirmation modal for deleting acceptable answers */}
          <AlertDialog 
            open={deleteAcceptableIndex !== null} 
            onOpenChange={(open) => {
              if (!open) {
                setDeleteAcceptableIndex(null);
              }
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Acceptable Answer</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this acceptable answer? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={performDeleteAcceptable}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      );

    case "select_from_list":
      return (
        <div className="space-y-4">
          <Label>Blanks Configuration</Label>
          {(value.blanks || []).map((blank: any, index: number) => (
            <Card key={index} className="p-4 space-y-3">
              <div className="flex justify-between items-center">
                <Label>Blank {index + 1} (blank_{blank.blank_id || index + 1})</Label>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    const newBlanks = value.blanks.filter((_: any, i: number) => i !== index);
                    handleFieldChange("blanks", newBlanks);
                  }}
                  data-testid={`button-remove-blank-${index}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm">Answer Choices for this blank</Label>
                {(blank.answer_choices || []).map((choice: string, choiceIndex: number) => (
                  <div key={choiceIndex} className="flex items-center gap-2">
                    <Input
                      value={choice}
                      onChange={(e) => {
                        const newBlanks = [...value.blanks];
                        newBlanks[index] = {
                          ...newBlanks[index],
                          answer_choices: [...newBlanks[index].answer_choices]
                        };
                        newBlanks[index].answer_choices[choiceIndex] = e.target.value;
                        handleFieldChange("blanks", newBlanks);
                      }}
                      placeholder="Answer choice"
                      data-testid={`input-blank-${index}-choice-${choiceIndex}`}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        const newBlanks = [...value.blanks];
                        newBlanks[index] = {
                          ...newBlanks[index],
                          answer_choices: newBlanks[index].answer_choices.filter((_: any, i: number) => i !== choiceIndex)
                        };
                        handleFieldChange("blanks", newBlanks);
                      }}
                      data-testid={`button-remove-blank-${index}-choice-${choiceIndex}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  onClick={() => {
                    const newBlanks = [...value.blanks];
                    newBlanks[index] = {
                      ...newBlanks[index],
                      answer_choices: [...(newBlanks[index].answer_choices || []), ""]
                    };
                    handleFieldChange("blanks", newBlanks);
                  }}
                  variant="outline"
                  size="sm"
                  data-testid={`button-add-blank-${index}-choice`}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Choice
                </Button>
              </div>
              
              <div>
                <Label className="text-sm">Correct Answer</Label>
                <Select
                  value={blank.correct_answer || ""}
                  onValueChange={(val) => {
                    const newBlanks = [...value.blanks];
                    newBlanks[index] = { ...newBlanks[index], correct_answer: val };
                    handleFieldChange("blanks", newBlanks);
                  }}
                >
                  <SelectTrigger data-testid={`select-blank-${index}-correct`}>
                    <SelectValue placeholder="Select correct answer" />
                  </SelectTrigger>
                  <SelectContent>
                    {(blank.answer_choices || []).map((choice: string, i: number) => {
                      // Skip empty choices or use index as fallback value
                      const itemValue = choice || `blank-${index}-choice-${i}`;
                      return (
                        <SelectItem key={i} value={itemValue}>
                          {choice || `(Empty Choice ${i + 1})`}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </Card>
          ))}
          <Button
            onClick={() => {
              const newBlanks = [...(value.blanks || []), {
                blank_id: (value.blanks || []).length + 1,
                answer_choices: [],
                correct_answer: ""
              }];
              handleFieldChange("blanks", newBlanks);
            }}
            variant="outline"
            data-testid="button-add-blank"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Blank
          </Button>
        </div>
      );

    case "drag_and_drop":
      return (
        <div className="space-y-4">
          <AnswerChoicesEditor />
          
          <div className="space-y-2">
            <Label>Drop Zones</Label>
            {(value.dropZones || []).map((zone: any, index: number) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={zone.zone_label || ""}
                  onChange={(e) => {
                    const newZones = [...(value.dropZones || [])];
                    newZones[index] = { ...newZones[index], zone_label: e.target.value };
                    handleFieldChange("dropZones", newZones);
                  }}
                  placeholder={`Zone ${index + 1} label`}
                  data-testid={`input-zone-${index}`}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    const newZones = value.dropZones.filter((_: any, i: number) => i !== index);
                    handleFieldChange("dropZones", newZones);
                  }}
                  data-testid={`button-remove-zone-${index}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              onClick={() => {
                const newZones = [...(value.dropZones || []), {
                  zone_id: (value.dropZones || []).length + 1,
                  zone_label: ""
                }];
                handleFieldChange("dropZones", newZones);
              }}
              variant="outline"
              size="sm"
              data-testid="button-add-zone"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Drop Zone
            </Button>
          </div>

          <div>
            <Label>Correct Answer Mapping</Label>
            <Textarea
              value={typeof value.correctAnswer === "object" ? JSON.stringify(value.correctAnswer, null, 2) : value.correctAnswer || ""}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  handleFieldChange("correctAnswer", parsed);
                } catch {
                  handleFieldChange("correctAnswer", e.target.value);
                }
              }}
              placeholder='{"zone_1": ["item1"], "zone_2": ["item2", "item3"]}'
              rows={4}
              className="font-mono text-sm"
              data-testid="textarea-correct-mapping"
            />
            <p className="text-xs text-muted-foreground mt-1">
              JSON format mapping zones to items
            </p>
          </div>
        </div>
      );

    case "either_or":
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Answer Choices (exactly 2)</Label>
            {[0, 1].map((index) => {
              const optionValue = (value.answerChoices || [])[index] || "";
              const isCorrect = value.correctAnswer === optionValue && optionValue !== "";
              return (
                <div 
                  key={index} 
                  className={`flex items-center gap-2 p-2 rounded-md transition-colors ${
                    isCorrect ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800' : ''
                  }`}
                >
                  <span className={`font-semibold min-w-[4rem] ${
                    isCorrect ? 'text-green-700 dark:text-green-400' : ''
                  }`}>
                    Option {index + 1}:
                  </span>
                  <Input
                    value={optionValue}
                    onChange={(e) => {
                      const newChoices = [...(value.answerChoices || ["", ""])];
                      newChoices[index] = e.target.value;
                      handleArrayChange("answerChoices", newChoices);
                    }}
                    placeholder={`Option ${index + 1}`}
                    className={isCorrect ? 'border-green-300 dark:border-green-700' : ''}
                    data-testid={`input-option-${index}`}
                  />
                </div>
              );
            })}
          </div>
          <div>
            <Label htmlFor="correctAnswer">Correct Answer</Label>
            <Select
              value={value.correctAnswer || ""}
              onValueChange={(val) => handleFieldChange("correctAnswer", val)}
            >
              <SelectTrigger id="correctAnswer" data-testid="select-either-or-correct">
                <SelectValue placeholder="Select correct option" />
              </SelectTrigger>
              <SelectContent>
                {(value.answerChoices || []).map((choice: string, index: number) => {
                  // Ensure value is never empty for SelectItem
                  const itemValue = choice || `option-${index}`;
                  return (
                    <SelectItem key={index} value={itemValue}>
                      {choice || `Option ${index + 1}`}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>
      );

    case "short_answer":
      return (
        <>
          <div className="space-y-4">
            <div>
              <Label htmlFor="correctAnswer">Correct Answer</Label>
              <Input
                id="correctAnswer"
                value={value.correctAnswer || ""}
                onChange={(e) => handleFieldChange("correctAnswer", e.target.value)}
                placeholder="Enter the correct answer"
                data-testid="input-short-correct"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Acceptable Answers (alternative correct answers)</Label>
              {(value.acceptableAnswers || []).map((answer: string, index: number) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={answer}
                    onChange={(e) => {
                      const newAnswers = [...(value.acceptableAnswers || [])];
                      newAnswers[index] = e.target.value;
                      handleFieldChange("acceptableAnswers", newAnswers);
                    }}
                    placeholder="Alternative answer"
                    data-testid={`input-short-acceptable-${index}`}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDeleteAcceptableClick(index);
                    }}
                    data-testid={`button-remove-short-acceptable-${index}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const currentAnswers = value.acceptableAnswers || [];
                  const newAnswers = [...currentAnswers, ""];
                  handleFieldChange("acceptableAnswers", newAnswers);
                }}
                variant="outline"
                size="sm"
                type="button"
                data-testid="button-add-short-acceptable"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Acceptable Answer
              </Button>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="caseSensitive"
                checked={value.caseSensitive || false}
                onCheckedChange={(checked) => handleFieldChange("caseSensitive", checked)}
                data-testid="checkbox-case-sensitive"
              />
              <Label htmlFor="caseSensitive">Case Sensitive</Label>
            </div>
          </div>

          {/* Confirmation modal for deleting acceptable answers */}
          <AlertDialog 
            open={deleteAcceptableIndex !== null} 
            onOpenChange={(open) => {
              if (!open) {
                setDeleteAcceptableIndex(null);
              }
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Acceptable Answer</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this acceptable answer? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={performDeleteAcceptable}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      );

    default:
      return (
        <div className="text-muted-foreground">
          Unknown question type: {questionType}
        </div>
      );
  }
}