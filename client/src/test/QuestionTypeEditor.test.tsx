import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QuestionTypeEditor } from '../components/QuestionTypeEditor';
import '@testing-library/jest-dom';

describe('QuestionTypeEditor Delete Functionality', () => {
  const mockOnChange = jest.fn();
  
  beforeEach(() => {
    mockOnChange.mockClear();
  });

  test('should show delete confirmation modal when clicking delete button', () => {
    const value = {
      answerChoices: ['Choice A', 'Choice B', 'Choice C', 'Choice D'],
      correctAnswer: 'B'
    };

    render(
      <QuestionTypeEditor
        questionType="multiple_choice"
        value={value}
        onChange={mockOnChange}
      />
    );

    // Find the delete button for the first choice
    const deleteButton = screen.getByTestId('button-remove-choice-0');
    fireEvent.click(deleteButton);

    // Check that the modal appears
    expect(screen.getByText('Delete Answer Choice')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to delete answer choice A/)).toBeInTheDocument();
  });

  test('should delete non-correct answer when confirmed', async () => {
    const value = {
      answerChoices: ['Choice A', 'Choice B', 'Choice C', 'Choice D'],
      correctAnswer: 'B'
    };

    render(
      <QuestionTypeEditor
        questionType="multiple_choice"
        value={value}
        onChange={mockOnChange}
      />
    );

    // Click delete on Choice A (not the correct answer)
    const deleteButton = screen.getByTestId('button-remove-choice-0');
    fireEvent.click(deleteButton);

    // Confirm deletion
    const confirmButton = screen.getByRole('button', { name: 'Delete' });
    fireEvent.click(confirmButton);

    // Check that onChange was called with the updated choices
    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          answerChoices: ['Choice B', 'Choice C', 'Choice D'],
          correctAnswer: 'B' // Should remain unchanged
        })
      );
    });
  });

  test('should require selecting new correct answer when deleting current correct answer', () => {
    const value = {
      answerChoices: ['Choice A', 'Choice B', 'Choice C', 'Choice D'],
      correctAnswer: 'B'
    };

    render(
      <QuestionTypeEditor
        questionType="multiple_choice"
        value={value}
        onChange={mockOnChange}
      />
    );

    // Click delete on Choice B (the correct answer)
    const deleteButton = screen.getByTestId('button-remove-choice-1');
    fireEvent.click(deleteButton);

    // Check that the special modal appears
    expect(screen.getByText('Cannot Delete Correct Answer')).toBeInTheDocument();
    expect(screen.getByText(/Please select a new correct answer/)).toBeInTheDocument();

    // The confirm button should be disabled initially
    const confirmButton = screen.getByRole('button', { name: 'Update & Delete' });
    expect(confirmButton).toBeDisabled();
  });

  test('should delete acceptable answer for short_answer type', async () => {
    const value = {
      correctAnswer: 'Main Answer',
      acceptableAnswers: ['Alt 1', 'Alt 2', 'Alt 3'],
      caseSensitive: false
    };

    render(
      <QuestionTypeEditor
        questionType="short_answer"
        value={value}
        onChange={mockOnChange}
      />
    );

    // Click delete on the second acceptable answer
    const deleteButton = screen.getByTestId('button-remove-short-acceptable-1');
    fireEvent.click(deleteButton);

    // Check that the modal appears
    expect(screen.getByText('Delete Acceptable Answer')).toBeInTheDocument();

    // Confirm deletion
    const confirmButton = screen.getByRole('button', { name: 'Delete' });
    fireEvent.click(confirmButton);

    // Check that onChange was called with the updated acceptable answers
    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          acceptableAnswers: ['Alt 1', 'Alt 3'],
          correctAnswer: 'Main Answer'
        })
      );
    });
  });
});