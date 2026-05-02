export interface User {
  id: string;
  username: string;
  email: string;
  createdAt: string;
}

export interface Text {
  id: string;
  title: string;
  content: string;
  difficultyLevel: number;
  wordCount: number;
  createdBy: string;
  createdAt: string;
  lastOpened?: string;
  type?: 'translation'; // 添加类型字段
  folder_id?: string; // 添加文件夹ID字段
}

export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
  children?: Folder[];
  child_count?: number;
}

export interface DifficultWord {
  word: string;
  meaning: string;
}

export interface TextAnalysis {
  id: string;
  textId: string;
  difficultWords: DifficultWord[];
  difficulty: number;
  translation: string;
  keyPoints: string[];
  createdAt: string;
}

export interface PracticeSession {
  id: string;
  userId: string;
  textId: string;
  userInput: string;
  aiFeedback: {
    score: number;
    corrections: Array<{
      original: string;
      suggestion: string;
      reason: string;
    }>;
    overall: string;
  };
  score: number;
  completedAt: string;
}

export interface TypingState {
  currentIndex: number;
  userInput: string;
  isCompleted: boolean;
  errors: number;
  startTime: Date | null;
  endTime: Date | null;
}

export interface APIResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}
