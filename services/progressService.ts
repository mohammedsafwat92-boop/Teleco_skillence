
import type { UserProgress } from '../types';
import { googleSheetService } from './googleSheetService';

const STORAGE_KEY = 'tp_skillence_progress_v3';

export const initialProgress: UserProgress = {
  completedLessons: [],
  quizScores: {},
  activityHistory: []
};

// Retrieve progress for all users (for Admin Panel)
export const getAllUsersProgress = (): Record<string, UserProgress> => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (e) {
    console.error("Failed to load all progress", e);
    return {};
  }
};

// Retrieve progress for a specific user
export const getUserProgress = (userId: string): UserProgress => {
  try {
    const all = getAllUsersProgress();
    // Return specific user progress or initial state if new
    return all[userId] || initialProgress;
  } catch (e) {
    return initialProgress;
  }
};

// Save progress for a specific user
export const saveUserProgress = (userId: string, progress: UserProgress) => {
  try {
    const all = getAllUsersProgress();
    all[userId] = progress;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (e) {
     console.error("Failed to save progress", e);
  }
};

export const getUserId = (): string => {
    return 'tp-agent-default'; 
};

export const getMyLessons = async (userId: string) => {
  return googleSheetService.getMyLessons(userId);
};
