import { createContext, useContext, useState, ReactNode } from "react";

interface QuestionState {
  isFlipped: boolean;
}

interface QuestionContextType {
  getQuestionState: (questionId: number) => QuestionState;
  setQuestionFlipped: (questionId: number, isFlipped: boolean) => void;
}

const QuestionContext = createContext<QuestionContextType | null>(null);

export function QuestionProvider({ children }: { children: ReactNode }) {
  const [questionStates, setQuestionStates] = useState<Record<number, QuestionState>>({});

  const getQuestionState = (questionId: number): QuestionState => {
    return questionStates[questionId] || { isFlipped: false };
  };

  const setQuestionFlipped = (questionId: number, isFlipped: boolean) => {
    setQuestionStates(prev => ({
      ...prev,
      [questionId]: { ...prev[questionId], isFlipped }
    }));
  };

  return (
    <QuestionContext.Provider value={{ getQuestionState, setQuestionFlipped }}>
      {children}
    </QuestionContext.Provider>
  );
}

export function useQuestionContext() {
  const context = useContext(QuestionContext);
  if (!context) {
    throw new Error("useQuestionContext must be used within a QuestionProvider");
  }
  return context;
}