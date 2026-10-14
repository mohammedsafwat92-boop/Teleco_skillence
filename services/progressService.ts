import type { UserProgress, ActivityLog, UserProfile, UserStats } from '../types';
import { googleSheetService } from './googleSheetService';

const STORAGE_KEY = 'tp_skillence_progress_v3';
export const PROGRESS_UPDATED_EVENT = 'tp_progress_updated';

export interface DetailedResourceProgress {
  status: 'assigned' | 'completed' | 'open';
  score: number;
  completedAt: string;
  duration?: number;
  title?: string;
  attempts?: number;
}

export interface ExtendedUserProgress extends UserProgress {
  resourceProgress?: Record<string, DetailedResourceProgress>;
}

export const initialProgress: ExtendedUserProgress = {
  completedLessons: [],
  quizScores: {},
  activityHistory: [],
  resourceProgress: {}
};

// In-memory subscription listeners
type ProgressListener = (userId?: string) => void;
const listeners = new Set<ProgressListener>();

export const subscribeToProgress = (listener: ProgressListener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const notifyProgressUpdated = (userId?: string) => {
  listeners.forEach(l => {
    try {
      l(userId);
    } catch (e) {
      console.error("[progressService] Listener error:", e);
    }
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PROGRESS_UPDATED_EVENT, { detail: { userId } }));
  }
};

// Set up cross-tab / storage listener once
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      notifyProgressUpdated();
    }
  });
}

// Retrieve progress for all users (for Admin Panel & Analytics)
export const getAllUsersProgress = (): Record<string, ExtendedUserProgress> => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (e) {
    console.error("[progressService] Failed to load all progress", e);
    return {};
  }
};

// Retrieve progress for a specific user
export const getUserProgress = (userId: string): ExtendedUserProgress => {
  try {
    const all = getAllUsersProgress();
    const userProg = all[userId];
    if (!userProg) return { ...initialProgress, quizScores: {}, completedLessons: [], activityHistory: [], resourceProgress: {} };
    return {
      ...initialProgress,
      ...userProg,
      quizScores: userProg.quizScores || {},
      completedLessons: userProg.completedLessons || [],
      activityHistory: userProg.activityHistory || [],
      resourceProgress: userProg.resourceProgress || {}
    };
  } catch (e) {
    return { ...initialProgress };
  }
};

// Save progress for a specific user
export const saveUserProgress = (userId: string, progress: ExtendedUserProgress) => {
  try {
    const all = getAllUsersProgress();
    all[userId] = progress;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    notifyProgressUpdated(userId);
  } catch (e) {
    console.error("[progressService] Failed to save progress", e);
  }
};

// Primary entry point for real-time score recording
export const recordUserScore = (
  userId: string,
  resourceId: string,
  score: number,
  passed: boolean = true,
  duration: number = 15,
  title?: string
) => {
  if (!userId || !resourceId) return;

  try {
    const all = getAllUsersProgress();
    const existing = all[userId] || {
      completedLessons: [],
      quizScores: {},
      activityHistory: [],
      resourceProgress: {}
    };

    const quizScores = { ...(existing.quizScores || {}) };
    quizScores[resourceId] = Math.max(0, Math.min(100, Math.round(score)));

    const completedLessons = Array.from(new Set([
      ...(existing.completedLessons || []),
      ...(passed ? [resourceId, ...(title ? [title] : [])] : [])
    ]));

    const timestamp = new Date().toISOString();
    const activityHistory = [
      ...(existing.activityHistory || []),
      {
        date: timestamp,
        type: 'quiz' as const,
        score: Math.max(0, Math.min(100, Math.round(score))),
        title: title || resourceId
      }
    ];

    const resourceProgress = { ...(existing.resourceProgress || {}) };
    resourceProgress[resourceId] = {
      status: passed ? 'completed' : 'assigned',
      score: Math.max(0, Math.min(100, Math.round(score))),
      completedAt: timestamp,
      duration: duration || 15,
      title: title || resourceId,
      attempts: (resourceProgress[resourceId]?.attempts || 0) + 1
    };

    all[userId] = {
      completedLessons,
      quizScores,
      activityHistory,
      resourceProgress
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    notifyProgressUpdated(userId);
  } catch (err) {
    console.error("[progressService] Failed to record user score:", err);
  }
};

// Sync plan data into progressService when fetched from backend
export const syncPlanProgress = (userId: string, resources: any[]) => {
  if (!userId || !Array.isArray(resources) || resources.length === 0) return;

  try {
    const all = getAllUsersProgress();
    const existing = all[userId] || {
      completedLessons: [],
      quizScores: {},
      activityHistory: [],
      resourceProgress: {}
    };

    let hasChanges = false;
    const quizScores = { ...(existing.quizScores || {}) };
    const completedLessons = new Set(existing.completedLessons || []);
    const resourceProgress = { ...(existing.resourceProgress || {}) };

    resources.forEach((r: any) => {
      const rId = String(r.id);
      const prog = r.progress;
      if (!prog) return;

      if (prog.score !== undefined && prog.score !== null && prog.score > 0) {
        if (quizScores[rId] === undefined || prog.score > quizScores[rId]) {
          quizScores[rId] = Number(prog.score);
          hasChanges = true;
        }
      }

      if (prog.status === 'completed') {
        if (!completedLessons.has(rId)) {
          completedLessons.add(rId);
          hasChanges = true;
        }
        if (r.title && !completedLessons.has(r.title)) {
          completedLessons.add(r.title);
          hasChanges = true;
        }
      }

      if (prog.status) {
        resourceProgress[rId] = {
          status: prog.status,
          score: prog.score !== undefined && prog.score !== null ? Number(prog.score) : (quizScores[rId] || 0),
          completedAt: prog.completedAt || new Date().toISOString(),
          duration: r.duration || 15,
          title: r.title || rId,
          attempts: prog.attempts || 1
        };
      }
    });

    if (hasChanges) {
      all[userId] = {
        ...existing,
        quizScores,
        completedLessons: Array.from(completedLessons),
        resourceProgress
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      notifyProgressUpdated(userId);
    }
  } catch (err) {
    console.warn("[progressService] syncPlanProgress error:", err);
  }
};

// Calculate start of current week (Sunday midnight)
export const getStartOfWeek = (): Date => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  start.setHours(0, 0, 0, 0);
  return start;
};

// Unified helper to calculate real-time scores and progress for a single user
export const calculateUserRealTimeScores = (
  userId: string,
  userStatsFromBackend?: any
): {
  averageScore: number;
  weeklyAverageScore: number;
  totalCompleted: number;
  totalAssigned: number;
  overallProgress: number;
  weeklyMinutes: number;
  weeklyProgress: number;
  hasScores: boolean;
  scoreCount: number;
} => {
  const userProg = getUserProgress(userId);
  const startOfWeek = getStartOfWeek();

  // Collect all scored items
  const scores: number[] = [];
  const weeklyScores: number[] = [];
  let calculatedWeeklyMinutes = 0;

  // 1. From quizScores
  Object.values(userProg.quizScores || {}).forEach(score => {
    if (typeof score === 'number' && score > 0) {
      scores.push(score);
    }
  });

  // 2. From detailed resourceProgress
  if (userProg.resourceProgress) {
    Object.values(userProg.resourceProgress).forEach(item => {
      if (item.status === 'completed' && item.completedAt) {
        const itemDate = new Date(item.completedAt);
        if (itemDate >= startOfWeek) {
          calculatedWeeklyMinutes += (item.duration || 15);
          if (item.score > 0) {
            weeklyScores.push(item.score);
          }
        }
      }
    });
  }

  // 3. From activityHistory if quizScores was empty
  if (scores.length === 0 && userProg.activityHistory) {
    userProg.activityHistory.forEach(act => {
      if (act.score !== undefined && act.score !== null && act.score > 0) {
        scores.push(act.score);
        const actDate = new Date(act.date);
        if (actDate >= startOfWeek) {
          weeklyScores.push(act.score);
        }
      }
    });
  }

  const averageScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : (userStatsFromBackend?.averageScore || 0);

  const weeklyAverageScore = weeklyScores.length > 0
    ? Math.round(weeklyScores.reduce((a, b) => a + b, 0) / weeklyScores.length)
    : (scores.length > 0 ? averageScore : (userStatsFromBackend?.weeklyAverageScore || 0));

  // Merge backend counts with local completed count
  const localCompletedCount = (userProg.completedLessons || []).length;
  const backendCompleted = userStatsFromBackend?.totalCompleted || 0;
  const totalCompleted = Math.max(localCompletedCount, backendCompleted);

  const backendAssigned = userStatsFromBackend?.totalAssigned || 0;
  const totalAssigned = Math.max(totalCompleted, backendAssigned);

  const overallProgress = totalAssigned > 0
    ? Math.round((totalCompleted / totalAssigned) * 100)
    : (userStatsFromBackend?.overallProgress || (totalCompleted > 0 ? 100 : 0));

  const weeklyMinutes = Math.max(calculatedWeeklyMinutes, userStatsFromBackend?.weeklyMinutes || 0);
  const weeklyProgress = Math.min(Math.round((weeklyMinutes / 180) * 100), 100);

  return {
    averageScore,
    weeklyAverageScore,
    totalCompleted,
    totalAssigned,
    overallProgress,
    weeklyMinutes,
    weeklyProgress,
    hasScores: scores.length > 0 || (userStatsFromBackend?.averageScore && userStatsFromBackend.averageScore > 0),
    scoreCount: scores.length
  };
};

// Build merged real-time user stats for Admin Panel
export const getMergedAdminUserStats = (
  user: UserProfile,
  backendUserStats?: any
): UserProfile & UserStats => {
  const realTime = calculateUserRealTimeScores(user.id, backendUserStats);

  return {
    ...user,
    userId: user.id,
    weeklyMinutes: realTime.weeklyMinutes,
    weeklyProgress: realTime.weeklyProgress,
    overallProgress: realTime.overallProgress,
    totalCompleted: realTime.totalCompleted,
    totalAssigned: realTime.totalAssigned,
    averageScore: realTime.averageScore,
    weeklyAverageScore: realTime.weeklyAverageScore,
    weeklyHistory: backendUserStats?.weeklyHistory || []
  };
};

export const getUserId = (): string => {
  return 'tp-agent-default';
};

export const getMyLessons = async (userId: string) => {
  return googleSheetService.getMyLessons(userId);
};
