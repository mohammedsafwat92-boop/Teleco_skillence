
/// <reference types="vite/client" />

const WEB_APP_URL = import.meta.env.VITE_GOOGLE_SHEET_URL || "https://script.google.com/macros/s/AKfycbxgBQN-meFmv79fyEa7XwEd3hdtXNVvD6i-dURda_hOOYE-inzuoFTFiGrmXBUFCowK/exec";
if (!import.meta.env.VITE_GOOGLE_SHEET_URL) console.warn("[googleSheetService] VITE_GOOGLE_SHEET_URL is missing from the environment. Using hardcoded fallback.");

async function callApi(action: string, payload: any = {}) {
  const requestBody = JSON.stringify({ 
    action, 
    ...payload 
  });

  try {
    const response = await fetch(WEB_APP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: requestBody,
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`NETWORK_ERROR: HTTP ${response.status}`);
    }

    const rawText = await response.text();
    let json;
    try {
      json = JSON.parse(rawText);
    } catch (parseError) {
      console.error("[googleSheetService] Critical parsing failure. Raw text received from backend:", rawText);
      throw new Error(`DEPLOYMENT_MISMATCH: Backend returned a string instead of JSON.`);
    }

    if (!json.success) {
      if (json.message === "Invalid credentials") {
        throw new Error("AUTH_FAILED: Incorrect credentials.");
      }
      throw new Error(json.message || 'GENERAL_BACKEND_FAULT');
    }
    
    return json.data;
  } catch (error) {
    console.debug(`[CallStack] Action: ${action}`, (error as Error).message);
    throw error;
  }
}

export const googleSheetService = {
  testConnection: async () => {
    try {
      await callApi('test_connection');
      return true;
    } catch (e) {
      return false;
    }
  },

  login: (email: string, pass: string) => 
    callApi('login', { email, password: pass }),
    
  fetchUserPlan: async (uid: string, role: string) => {
    // Explicitly send uid and role as requested
    return await callApi('get_user_plan', { uid, role });
  },

  fetchGlobalResources: async () => {
    return await callApi('get_all_resources');
  },

  getAllResources: async () => {
    return await callApi('get_all_resources');
  },
    
  createUser: (userData: any): Promise<{ uid: string; userProfile: any; resources: any[] }> => 
    callApi('register_shl_user', userData),
    
  fetchAllUsers: (requesterEmail?: string, requesterRole?: string) => 
    callApi('admin_get_users', { requesterEmail, requesterRole }),
    
  submitQuizResult: (uid: string, resourceId: string, passed: boolean, score: number, timeTaken?: number) =>
    callApi('submit_progress', { uid, resourceId, passed, score, timeTaken }),

  submitProgress: (uid: string, resourceId: string, passed: boolean, score: number, timeTaken?: number) =>
    callApi('submit_progress', { uid, resourceId, passed, score, timeTaken }),

  importResource: (resourceData: any) => 
    callApi('admin_import_resource', resourceData),

  bulkImportResources: (resources: any[]) => {
    return callApi('bulk_import_resources', { resources });
  },

  unlockResource: (uid: string, resourceId: string) =>
    callApi('admin_unlock_resource', { uid, resourceId }),

  assignManualResource: (targetUid: string, resourceId: string, adminId: string) =>
    // Explicitly send targetUid, resourceId, and adminId as requested
    callApi('assign_manual_resource', { targetUid, resourceId, adminId }),

  getAdminStats: (requesterEmail?: string, requesterRole?: string) =>
    callApi('get_admin_stats', { requesterEmail, requesterRole }),

  bulkAssignRoster: async (adminId: string, wave?: string) => {
    try {
      return await callApi('bulk_assign_roster', { adminId, wave });
    } catch (apiError: any) {
      console.warn("[googleSheetService] bulk_assign_roster backend action failed or is not deployed. Running client-side bulk assignment fallback...", apiError?.message);
      
      let adminEmail = undefined;
      let adminRole = undefined;
      try {
        const cached = localStorage.getItem('tp_skillence_user_session');
        if (cached) {
          const u = JSON.parse(cached);
          adminEmail = u.email;
          adminRole = u.role;
        }
      } catch (e) {
        console.warn("Failed to parse cached user session:", e);
      }
      
      const users = await googleSheetService.fetchAllUsers(adminEmail, adminRole);
      if (!Array.isArray(users)) {
        throw new Error("Could not fetch user list for fallback bulk assignment");
      }
      
      const targetAgents = users.filter((u: any) => 
        u.role === 'agent' && (!wave || wave === 'all' || u.wave === wave || u.waveNumber === wave)
      );
      
      if (targetAgents.length === 0) {
        return { success: true, count: 0, newAssignments: 0, updatedAssignments: 0, message: "No agents found for wave: " + wave };
      }
      
      const resResponse = await googleSheetService.getAllResources();
      const resources = Array.isArray(resResponse) ? resResponse : [];
      if (resources.length === 0) {
        throw new Error("No resources found to assign");
      }
      
      const isLevelMatchLocal = (resLevel: string, userLevel: string) => {
        const r = String(resLevel || 'All').toUpperCase();
        const u = String(userLevel || '').toUpperCase();
        if (r === 'ALL') return true;
        if (r === u) return true;
        if (u && r.indexOf(u) !== -1) return true;
        return false;
      };
      
      const assignments: { targetUid: string; resourceId: string }[] = [];
      for (const agent of targetAgents) {
        const userLevel = agent.languageLevel || 'B1';
        for (const res of resources) {
          if (isLevelMatchLocal(res.level, userLevel)) {
            assignments.push({
              targetUid: agent.id,
              resourceId: res.id
            });
          }
        }
      }
      
      console.log(`[googleSheetService] Fallback: Total of ${assignments.length} assignments to process...`);
      
      const chunkSize = 5;
      for (let i = 0; i < assignments.length; i += chunkSize) {
        const chunk = assignments.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map(asg => 
            googleSheetService.assignManualResource(asg.targetUid, asg.resourceId, adminId)
              .catch(e => console.error(`Failed to assign ${asg.resourceId} to ${asg.targetUid}`, e))
          )
        );
      }
      
      return { success: true, count: assignments.length, newAssignments: assignments.length, updatedAssignments: 0 };
    }
  },

  getWeeklyAssignments: async (): Promise<Record<number, string[]>> => {
    try {
      return await callApi('get_weekly_assignments');
    } catch (e: any) {
      console.warn("[googleSheetService] getWeeklyAssignments Web App failed, retrieving from localStorage. Error:", e?.message);
      try {
        const stored = localStorage.getItem("local_weekly_assignments");
        return stored ? JSON.parse(stored) : {};
      } catch (parseErr) {
        return {};
      }
    }
  },

  getWaveConfigs: async () => {
    try {
      return await callApi('get_wave_configs');
    } catch (e: any) {
      console.warn("[googleSheetService] getWaveConfigs Web App failed, utilizing localStorage fallback. Error:", e?.message);
      try {
        const stored = localStorage.getItem("local_wave_configs");
        return stored ? JSON.parse(stored) : {};
      } catch (parseErr) {
        return {};
      }
    }
  },

  setWaveConfig: async (waveNumber: string, goalType: 'default' | 'weekly', goalMinutes: number) => {
    try {
      return await callApi('set_wave_config', { waveNumber, goalType, goalMinutes });
    } catch (e: any) {
      console.warn("[googleSheetService] setWaveConfig Web App failed, utilizing localStorage fallback. Error:", e?.message);
      let local: Record<string, any> = {};
      try {
        const stored = localStorage.getItem("local_wave_configs");
        local = stored ? JSON.parse(stored) : {};
      } catch (parseErr) {
        local = {};
      }
      
      if (!local[waveNumber]) {
        local[waveNumber] = {
          defaultGoal: 180,
          currentWeekGoal: null,
          activeGoal: 180
        };
      }
      
      if (goalType === 'default') {
        local[waveNumber].defaultGoal = goalMinutes;
      } else {
        local[waveNumber].currentWeekGoal = goalMinutes || null;
      }
      
      local[waveNumber].activeGoal = local[waveNumber].currentWeekGoal || local[waveNumber].defaultGoal || 180;
      
      localStorage.setItem("local_wave_configs", JSON.stringify(local));
      return local;
    }
  },

  assignToWeek: async (weekNumber: number, resourceIds: string[], adminId: string, targetWave?: string): Promise<Record<number, string[]>> => {
    try {
      return await callApi('assign_to_week', { weekNumber, resourceIds, adminId, targetWave: targetWave || 'All' });
    } catch (e: any) {
      console.warn("[googleSheetService] assignToWeek Web App failed, utilizing localStorage fallback. Error:", e?.message);
      let local: Record<number, string[]> = {};
      try {
        const stored = localStorage.getItem("local_weekly_assignments");
        local = stored ? JSON.parse(stored) : {};
      } catch (parseErr) {
        local = {};
      }
      local[weekNumber] = resourceIds;
      localStorage.setItem("local_weekly_assignments", JSON.stringify(local));
      return local;
    }
  },

  saveTranscript: async (userId: string, transcript: any): Promise<any> => {
    try {
      return await callApi('save_transcript', { userId, transcript });
    } catch (e: any) {
      console.warn("[googleSheetService] saveTranscript Web App failed, utilizing localStorage fallback. Error:", e?.message);
      const key = `local_transcripts_${userId}`;
      let local: any[] = [];
      try {
        local = JSON.parse(localStorage.getItem(key) || "[]");
      } catch (parseErr) {
        local = [];
      }
      const id = 't-' + Date.now();
      const dateString = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      const newEntry = {
        id,
        userId,
        date: dateString,
        topic: transcript.topic || 'General Coaching Session',
        duration: transcript.duration || '5:00',
        overallScore: transcript.overallScore || 'Completed',
        messages: transcript.messages || []
      };
      local.push(newEntry);
      localStorage.setItem(key, JSON.stringify(local));
      return { id };
    }
  },

  getTranscripts: async (userId: string): Promise<any[]> => {
    try {
      return await callApi('get_transcripts', { userId });
    } catch (e: any) {
      console.warn("[googleSheetService] getTranscripts Web App failed, retrieving from localStorage. Error:", e?.message);
      const key = `local_transcripts_${userId}`;
      try {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : [];
      } catch (parseErr) {
        return [];
      }
    }
  },

  proxyGemini: (model: string, payload: any): Promise<any> =>
    callApi('proxy_gemini', { model, payload }),

  proxyGeminiRequest: (payload: any): Promise<any> =>
    callApi('proxy_gemini_request', { payload }),

  addSingleUser: async (userData: { name: string; email: string; waveNumber: string; role: 'agent' }): Promise<boolean> => {
    try {
      await callApi('addSingleUser', userData);
      return true;
    } catch (e) {
      console.error("[googleSheetService] addSingleUser failed:", e);
      return false;
    }
  },

  saveLesson: async (title: string, lessonData: any): Promise<{ id: string; title: string }> => {
    try {
      return await callApi('saveLesson', { title, lessonData });
    } catch (e: any) {
      console.warn("[googleSheetService] saveLesson Web App failed, saving to localStorage fallback:", e?.message);
      const id = 'les_' + Date.now();
      const existing = JSON.parse(localStorage.getItem('local_interactive_lessons') || '[]');
      const newLesson = { id, title, createdAt: new Date().toISOString(), lessonData };
      existing.unshift(newLesson);
      localStorage.setItem('local_interactive_lessons', JSON.stringify(existing));
      return { id, title };
    }
  },

  saveAnswers: async (userId: string, lessonId: string, answers: Record<string, string>): Promise<{ id: string }> => {
    try {
      return await callApi('saveAnswers', { userId, lessonId, answers });
    } catch (e: any) {
      console.warn("[googleSheetService] saveAnswers Web App failed, saving to localStorage fallback:", e?.message);
      const id = 'ans_' + Date.now();
      const key = `local_freetext_answers_${userId}`;
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      existing.push({ id, userId, lessonId, submittedAt: new Date().toISOString(), answers });
      localStorage.setItem(key, JSON.stringify(existing));
      return { id };
    }
  },

  getInteractiveLessons: async (): Promise<any[]> => {
    try {
      return await callApi('getInteractiveLessons');
    } catch (e: any) {
      console.warn("[googleSheetService] getInteractiveLessons Web App failed, fetching from localStorage fallback:", e?.message);
      return JSON.parse(localStorage.getItem('local_interactive_lessons') || '[]');
    }
  },

  getFreeTextAnswers: async (lessonId?: string, userId?: string): Promise<any[]> => {
    try {
      return await callApi('getFreeTextAnswers', { lessonId, userId });
    } catch (e: any) {
      console.warn("[googleSheetService] getFreeTextAnswers Web App failed, fetching from localStorage fallback:", e?.message);
      const key = userId ? `local_freetext_answers_${userId}` : 'local_freetext_answers_all';
      return JSON.parse(localStorage.getItem(key) || '[]');
    }
  },

  assignLesson: async (userId: string, lessonId: string, adminId: string): Promise<{ id: string; userId: string; lessonId: string }> => {
    try {
      return await callApi('assignLesson', { userId, lessonId, adminId });
    } catch (e: any) {
      console.warn("[googleSheetService] assignLesson Web App failed, saving to localStorage fallback:", e?.message);
      const id = 'asgn_' + Date.now();
      const existing = JSON.parse(localStorage.getItem('local_manual_assignments') || '[]');
      const newAsgn = { id, userId, lessonId, adminId, assignedAt: new Date().toISOString() };
      existing.push(newAsgn);
      localStorage.setItem('local_manual_assignments', JSON.stringify(existing));
      return newAsgn;
    }
  },

  batchAssignLessons: async (userIds: string[], lessonIds: string[], adminId: string): Promise<{ count: number; totalRequested: number; usersCount: number; lessonsCount: number }> => {
    try {
      return await callApi('batchAssignLessons', { userIds, lessonIds, adminId });
    } catch (e: any) {
      console.warn("[googleSheetService] batchAssignLessons Web App failed, saving to localStorage fallback:", e?.message);
      const existing = JSON.parse(localStorage.getItem('local_manual_assignments') || '[]');
      const existingSet = new Set(existing.map((a: any) => `${a.userId}|${a.lessonId}`));
      
      let createdCount = 0;
      const assignedAt = new Date().toISOString();
      
      userIds.forEach(uId => {
        lessonIds.forEach(lId => {
          const key = `${uId}|${lId}`;
          if (!existingSet.has(key)) {
            existingSet.add(key);
            existing.push({
              id: 'asgn_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
              userId: uId,
              lessonId: lId,
              adminId,
              assignedAt
            });
            createdCount++;
          }
        });
      });

      localStorage.setItem('local_manual_assignments', JSON.stringify(existing));
      return {
        count: createdCount,
        totalRequested: userIds.length * lessonIds.length,
        usersCount: userIds.length,
        lessonsCount: lessonIds.length
      };
    }
  },

  getMyLessons: async (userId: string): Promise<any[]> => {
    try {
      return await callApi('getMyLessons', { userId });
    } catch (e: any) {
      console.warn("[googleSheetService] getMyLessons Web App failed, fetching from localStorage fallback:", e?.message);
      const localAssignments = JSON.parse(localStorage.getItem('local_manual_assignments') || '[]');
      const userLessonIds = localAssignments
        .filter((a: any) => String(a.userId) === String(userId))
        .map((a: any) => String(a.lessonId));
      const allInteractive = JSON.parse(localStorage.getItem('local_interactive_lessons') || '[]');
      if (userLessonIds.length === 0) return [];
      return allInteractive.filter((l: any) => userLessonIds.includes(String(l.id)));
    }
  }
};

