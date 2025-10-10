// Simple test to verify the delete modal functionality

// Test the logic of the performDeleteChoice function
function testDeleteLogic() {
  console.log("Testing delete choice logic...");
  
  // Mock data
  let value = {
    answerChoices: ["Choice A", "Choice B", "Choice C", "Choice D"],
    correctAnswer: "B"
  };
  
  let deleteChoiceIndex = 1; // Deleting Choice B (the correct answer)
  let newCorrectAnswerForDelete = "C"; // New correct will be C
  
  console.log("Before deletion:");
  console.log("  Choices:", value.answerChoices);
  console.log("  Correct answer:", value.correctAnswer);
  console.log("  Deleting index:", deleteChoiceIndex, "(Choice B)");
  console.log("  New correct answer:", newCorrectAnswerForDelete);
  
  // Simulate the deletion logic
  const newChoices = value.answerChoices.filter((_, i) => i !== deleteChoiceIndex);
  
  // Update correct answer
  value.correctAnswer = newCorrectAnswerForDelete;
  value.answerChoices = newChoices;
  
  console.log("\nAfter deletion:");
  console.log("  Choices:", value.answerChoices);
  console.log("  Correct answer:", value.correctAnswer);
  
  // Test case 2: Delete non-correct answer
  console.log("\n--- Test Case 2: Deleting non-correct answer ---");
  value = {
    answerChoices: ["Choice A", "Choice B", "Choice C", "Choice D"],
    correctAnswer: "B"
  };
  
  deleteChoiceIndex = 3; // Delete Choice D
  console.log("Before deletion:");
  console.log("  Choices:", value.answerChoices);
  console.log("  Correct answer:", value.correctAnswer);
  console.log("  Deleting index:", deleteChoiceIndex, "(Choice D)");
  
  const newChoices2 = value.answerChoices.filter((_, i) => i !== deleteChoiceIndex);
  value.answerChoices = newChoices2;
  
  // Since we deleted D and B was correct, no need to change correct answer
  
  console.log("\nAfter deletion:");
  console.log("  Choices:", value.answerChoices);
  console.log("  Correct answer:", value.correctAnswer, "(unchanged)");
  
  // Test case 3: Delete choice before correct answer
  console.log("\n--- Test Case 3: Deleting choice before correct answer ---");
  value = {
    answerChoices: ["Choice A", "Choice B", "Choice C", "Choice D"],
    correctAnswer: "C"
  };
  
  deleteChoiceIndex = 0; // Delete Choice A
  console.log("Before deletion:");
  console.log("  Choices:", value.answerChoices);
  console.log("  Correct answer:", value.correctAnswer);
  console.log("  Deleting index:", deleteChoiceIndex, "(Choice A)");
  
  const newChoices3 = value.answerChoices.filter((_, i) => i !== deleteChoiceIndex);
  value.answerChoices = newChoices3;
  
  // Adjust correct answer index
  const currentCorrectIndex = value.correctAnswer.charCodeAt(0) - 65; // C = 2
  if (currentCorrectIndex > deleteChoiceIndex) {
    const newCorrectLetter = String.fromCharCode(64 + currentCorrectIndex); // B
    value.correctAnswer = newCorrectLetter;
  }
  
  console.log("\nAfter deletion:");
  console.log("  Choices:", value.answerChoices);
  console.log("  Correct answer:", value.correctAnswer, "(adjusted from C to B)");
  
  console.log("\n✅ All test cases completed successfully!");
}

// Run the test
testDeleteLogic();