
import type { UserProfile, Lesson, Roster } from '../types';
import { googleSheetService } from './googleSheetService';

const USERS_KEY = 'tp_skillence_users';
const ROSTERS_KEY = 'tp_skillence_rosters';
const CUSTOM_LESSONS_KEY = 'tp_skillence_custom_lessons';

// Mock data has been removed to ensure the app strictly uses real data from the backend.
const initialRosters: Roster[] = [];
const initialUsers: UserProfile[] = [];

export const getUsers = (): UserProfile[] => {
  try {
    const stored = localStorage.getItem(USERS_KEY);
    if (!stored) {
      return initialUsers;
    }
    return JSON.parse(stored);
  } catch (e) {
    return initialUsers;
  }
};

export const saveUsers = (users: UserProfile[]) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

export const getRosters = (): Roster[] => {
  try {
    const stored = localStorage.getItem(ROSTERS_KEY);
    if (!stored) {
      return initialRosters;
    }
    return JSON.parse(stored);
  } catch (e) {
    return initialRosters;
  }
};

export const saveRosters = (rosters: Roster[]) => {
  localStorage.setItem(ROSTERS_KEY, JSON.stringify(rosters));
};

export const getCustomLessons = (): { [moduleId: string]: Lesson[] } => {
  try {
    const stored = localStorage.getItem(CUSTOM_LESSONS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (e) {
    return {};
  }
};

export const saveCustomLessons = (lessons: { [moduleId: string]: Lesson[] }) => {
  localStorage.setItem(CUSTOM_LESSONS_KEY, JSON.stringify(lessons));
};

export const addCustomLesson = (moduleId: string, lesson: Lesson) => {
  const allCustom = getCustomLessons();
  if (!allCustom[moduleId]) allCustom[moduleId] = [];
  const exists = allCustom[moduleId].some(l => l.title === lesson.title);
  if (!exists) {
      allCustom[moduleId].push({ ...lesson, isCustom: true });
      saveCustomLessons(allCustom);
  }
};

export const removeCustomLesson = (moduleId: string, lessonTitle: string) => {
  const allCustom = getCustomLessons();
  if (allCustom[moduleId]) {
    allCustom[moduleId] = allCustom[moduleId].filter(l => l.title !== lessonTitle);
    if (allCustom[moduleId].length === 0) delete allCustom[moduleId];
    saveCustomLessons(allCustom);
  }
};

export const assignLesson = async (userId: string, lessonId: string, adminId: string) => {
  return googleSheetService.assignLesson(userId, lessonId, adminId);
};

export const batchAssignLessons = async (userIds: string[], lessonIds: string[], adminId: string) => {
  return googleSheetService.batchAssignLessons(userIds, lessonIds, adminId);
};
