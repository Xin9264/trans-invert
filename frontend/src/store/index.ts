import { create } from 'zustand';
import { User, Text, PracticeSession, TypingState } from '../types';

interface AppState {
  // User state
  user: User | null;
  isAuthenticated: boolean;
  
  // Text state
  currentText: Text | null;
  textAnalysis: any | null;
  
  // Practice state
  currentSession: PracticeSession | null;
  typingState: TypingState;
  
  // UI state
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setUser: (user: User | null) => void;
  setCurrentText: (text: Text) => void;
  setTextAnalysis: (analysis: any) => void;
  startPractice: () => void;
  updateTypingState: (state: Partial<TypingState>) => void;
  submitAnswer: (answer: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  logout: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  user: null,
  isAuthenticated: false,
  currentText: null,
  textAnalysis: null,
  currentSession: null,
  typingState: {
    currentIndex: 0,
    userInput: '',
    isCompleted: false,
    errors: 0,
    startTime: null,
    endTime: null,
  },
  isLoading: false,
  error: null,
  
  // Actions
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  
  setCurrentText: (text) => set({ currentText: text }),
  
  setTextAnalysis: (analysis) => set({ textAnalysis: analysis }),
  
  startPractice: () => {
    set({
      currentSession: null,
      typingState: {
        currentIndex: 0,
        userInput: '',
        isCompleted: false,
        errors: 0,
        startTime: new Date(),
        endTime: null,
      }
    });
  },
  
  updateTypingState: (newState) => {
    const { typingState } = get();
    set({
      typingState: { ...typingState, ...newState }
    });
  },
  
  submitAnswer: (answer) => {
    // This will be implemented with API call
    console.log('Submitting answer:', answer);
  },
  
  setLoading: (loading) => set({ isLoading: loading }),
  
  setError: (error) => set({ error }),
  
  logout: () => set({
    user: null,
    isAuthenticated: false,
    currentText: null,
    textAnalysis: null,
    currentSession: null,
    typingState: {
      currentIndex: 0,
      userInput: '',
      isCompleted: false,
      errors: 0,
      startTime: null,
      endTime: null,
    }
  })
}));
