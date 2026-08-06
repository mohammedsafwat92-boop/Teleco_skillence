
import type { ReactNode } from 'react';

export enum ResourceType {
  Watch = 'Watch',
  Read = 'Read',
  Listen = 'Listen',
  Hyperlink = 'Hyperlink',
  Practice = 'Practice',
  Simulation = 'Simulation'
}

export type SkillCategory = 'All' | 'Listening' | 'Speaking' | 'Reading' | 'Writing';

export interface ResourceProgress {
  status: 'locked' | 'assigned' | 'open' | 'completed' | 'not_started' | 'in_progress';
  score?: number;
  attempts?: number;
  lastAttempt?: string;
  assignedBy?: string;
  completedAt?: string;
}

export interface Resource {
  id: string;
  title: string;
  url: string;
  type: ResourceType;
  tags: string[];
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'All';
  objective?: string;
  scrapedText?: string;
  duration: number;
  progress: ResourceProgress;
}

export interface UserCredentials {
  tempId: string;
  accessCode: string;
}

export interface AssessmentMetrics {
  fluency?: number | null;
  vocabulary?: number | null;
  grammar?: number | null;
  pronunciation?: number | null;
  coherence?: number | null;
}

export interface UserMetrics {
  svar?: AssessmentMetrics | null;
  writex?: AssessmentMetrics | null;
  fluency?: number | null;
  vocabulary?: number | null;
  grammar?: number | null;
  pronunciation?: number | null;
  coherence?: number | null;
  [key: string]: any;
}

export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  role: 'admin' | 'coach' | 'agent';
  languageLevel: string;
  rosterId: string;
  metrics?: UserMetrics | null;
  assignedModules?: string[];
  assignedCoach?: string; 
  generatedCredentials?: UserCredentials;
  overallProgress?: number;
  weeklyProgress?: number;
  wave?: string;
  assignedScenarioId?: string;
  waveNumber?: string;
}

export interface Roster {
  id: string;
  name: string;
  coachId: string;
  agentIds: string[];
}

export interface Lesson {
  title: string;
  level: string;
  type: ResourceType;
  link?: string;
  duration?: string;
  objective?: string;
  isCustom?: boolean;
  assignedTo?: string;
}

export interface Module {
  id: string;
  title: string;
  icon: ReactNode;
  description: string;
  lessons: Lesson[];
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
}

export type View = 
  | { type: 'dashboard', skill?: SkillCategory }
  | { type: 'module'; moduleId: string }
  | { type: 'admin' }
  | { type: 'lesson'; resource: Resource; fromModuleId?: string }
  | { type: 'quiz'; quizId: string }
  | { type: 'live-coach' }
  | { type: 'live-ai-coach' };

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  type?: 'listening' | 'reading' | 'speaking';
  context?: string;
  speakingPrompt?: string;
}

export interface ActivityLog {
  date: string;
  type: 'lesson' | 'quiz' | 'live-session';
  score?: number;
  title?: string;
}

export interface UserProgress {
  completedLessons: string[];
  quizScores: Record<string, number>;
  activityHistory: ActivityLog[];
}

export interface UserStats {
  userId: string;
  weeklyMinutes: number;
  overallProgress: number;
  totalCompleted: number;
  totalAssigned: number;
  weeklyHistory?: { weekLabel: string, minutes: number, progress: number, completedCount: number }[];
}

export interface AdminStats {
  rosterAverage: number;
  userStats: UserStats[];
}

export interface LessonBlock {
  id: string;
  type: 'text' | 'audio' | 'freetext' | 'smallfreetext';
  content?: string;
  audioUrl?: string;
  audioFilename?: string;
  questionId?: string;
  label?: string;
}

export interface InteractiveLessonData {
  id?: string;
  title: string;
  docxFilename?: string;
  createdAt?: string;
  blocks: LessonBlock[];
  audioFilesMapped?: Record<string, string>;
}

export interface StoredInteractiveLesson {
  id: string;
  title: string;
  createdAt: string;
  lessonData: InteractiveLessonData;
}

export interface FreeTextAnswerSubmission {
  id?: string;
  userId: string;
  lessonId: string;
  submittedAt?: string;
  answers: Record<string, string>;
}
