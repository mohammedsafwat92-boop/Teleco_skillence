import type { UserProfile, Lesson, Roster, UserStats } from '../types';
import { googleSheetService } from './googleSheetService';
import { 
  getMergedAdminUserStats, 
  calculateUserRealTimeScores, 
  subscribeToProgress, 
  getAllUsersProgress,
  getUserProgress
} from './progressService';

const USERS_KEY = 'tp_skillence_users';
const ROSTERS_KEY = 'tp_skillence_rosters';
const CUSTOM_LESSONS_KEY = 'tp_skillence_custom_lessons';

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

/**
 * Merges real-time scores from progressService with backend stats for all users.
 * Acts as the definitive single source of truth for the Admin Panel.
 */
export const getAdminCombinedUsers = (
  userList: UserProfile[],
  adminStats: any,
  selectedWeek: string = 'overall',
  activeWave: string = 'all'
): (UserProfile & UserStats)[] => {
  if (!userList || !Array.isArray(userList)) return [];

  let activeUsers = userList.filter(u => u.role === 'agent');
  if (activeWave !== 'all') {
    activeUsers = activeUsers.filter(u => u.wave === activeWave || u.waveNumber === activeWave);
  }

  return activeUsers.map(user => {
    const backendStats = adminStats?.userStats?.find((s: any) => String(s.userId) === String(user.id)) || {
      weeklyMinutes: 0,
      overallProgress: 0,
      totalCompleted: 0,
      totalAssigned: 0,
      averageScore: 0,
      weeklyAverageScore: 0,
      weeklyHistory: []
    };

    const merged = getMergedAdminUserStats(user, backendStats);

    if (selectedWeek !== 'overall' && backendStats.weeklyHistory) {
      const weekData = backendStats.weeklyHistory.find((w: any) => w.weekLabel === selectedWeek);
      return {
        ...merged,
        weeklyMinutes: weekData ? weekData.minutes : merged.weeklyMinutes,
        overallProgress: weekData ? weekData.progress : merged.overallProgress,
        totalCompleted: weekData ? weekData.completedCount : merged.totalCompleted
      };
    }

    return merged;
  });
};

/**
 * Calculates aggregate KPIs across all agents with real-time accuracy.
 */
export const calculateAdminKPIs = (combinedStats: (UserProfile & UserStats)[]) => {
  const totalAgents = combinedStats.length;
  const totalProgress = combinedStats.reduce((acc, u) => acc + (u.overallProgress || 0), 0);
  const avgProgress = totalAgents > 0 ? Math.round(totalProgress / totalAgents) : 0;

  const totalWeeklyProgress = combinedStats.reduce((acc, u) => acc + (u.weeklyProgress || 0), 0);
  const avgWeeklyProgress = totalAgents > 0 ? Math.round(totalWeeklyProgress / totalAgents) : 0;

  const scoredUsers = combinedStats.filter(u => (u.averageScore || 0) > 0);
  const totalScore = scoredUsers.reduce((acc, u) => acc + (u.averageScore || 0), 0);
  const avgScore = scoredUsers.length > 0 ? Math.round(totalScore / scoredUsers.length) : 0;

  const atRisk = combinedStats.filter(u => (u.overallProgress || 0) < 30).length;

  return {
    totalAgents,
    avgProgress,
    avgWeeklyProgress,
    avgScore,
    atRisk
  };
};

export { 
  getMergedAdminUserStats, 
  calculateUserRealTimeScores, 
  subscribeToProgress, 
  getAllUsersProgress,
  getUserProgress 
};
