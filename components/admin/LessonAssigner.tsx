import React, { useState, useEffect, useMemo } from 'react';
import { googleSheetService } from '../../services/googleSheetService';
import { batchAssignLessons } from '../../services/adminService';
import type { UserProfile } from '../../types';
import {
  UserCheck,
  BookOpen,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Search,
  CheckSquare,
  Square,
  Users,
  Layers
} from 'lucide-react';

interface LessonAssignerProps {
  currentAdminId?: string;
  onAssignmentComplete?: () => void;
}

export const LessonAssigner: React.FC<LessonAssignerProps> = ({
  currentAdminId = 'admin_master',
  onAssignmentComplete
}) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);

  // Multi-select state arrays
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedLessonIds, setSelectedLessonIds] = useState<string[]>([]);

  // Search terms for fast filtering
  const [userSearchTerm, setUserSearchTerm] = useState<string>('');
  const [lessonSearchTerm, setLessonSearchTerm] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      // 1. Fetch Users
      const fetchedUsers = await googleSheetService.fetchAllUsers();
      const validUsers = Array.isArray(fetchedUsers) ? fetchedUsers : [];
      setUsers(validUsers);

      // 2. Fetch Interactive Lessons
      const fetchedLessons = await googleSheetService.getInteractiveLessons();
      const validLessons = Array.isArray(fetchedLessons) ? fetchedLessons : [];
      setLessons(validLessons);
    } catch (err: any) {
      console.error("Failed to load users or interactive lessons for Assigner:", err);
      setErrorMessage("Could not load users or interactive lessons from backend.");
    } finally {
      setIsLoading(false);
    }
  };

  // Filtered Lists
  const filteredUsers = useMemo(() => {
    if (!userSearchTerm.trim()) return users;
    const term = userSearchTerm.toLowerCase();
    return users.filter(u => {
      const name = (u.name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const id = (u.id || '').toLowerCase();
      const roster = (u.rosterId || '').toLowerCase();
      return name.includes(term) || email.includes(term) || id.includes(term) || roster.includes(term);
    });
  }, [users, userSearchTerm]);

  const filteredLessons = useMemo(() => {
    if (!lessonSearchTerm.trim()) return lessons;
    const term = lessonSearchTerm.toLowerCase();
    return lessons.filter(l => {
      const title = (l.title || l.lessonData?.title || '').toLowerCase();
      const id = (l.id || '').toLowerCase();
      return title.includes(term) || id.includes(term);
    });
  }, [lessons, lessonSearchTerm]);

  // User Selection Handlers
  const toggleUser = (userId: string) => {
    if (!userId) return;
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleSelectAllUsers = () => {
    const filteredUserKeyList = filteredUsers
      .map(u => u.id || u.email || '')
      .filter(Boolean);
    const combined = Array.from(new Set([...selectedUserIds, ...filteredUserKeyList]));
    setSelectedUserIds(combined);
  };

  const handleDeselectAllUsers = () => {
    const filteredSet = new Set(
      filteredUsers.map(u => u.id || u.email || '').filter(Boolean)
    );
    setSelectedUserIds(prev => prev.filter(id => !filteredSet.has(id)));
  };

  // Lesson Selection Handlers
  const toggleLesson = (lessonId: string) => {
    if (!lessonId) return;
    setSelectedLessonIds(prev =>
      prev.includes(lessonId) ? prev.filter(id => id !== lessonId) : [...prev, lessonId]
    );
  };

  const handleSelectAllLessons = () => {
    const filteredLessonKeyList = filteredLessons
      .map(l => l.id || '')
      .filter(Boolean);
    const combined = Array.from(new Set([...selectedLessonIds, ...filteredLessonKeyList]));
    setSelectedLessonIds(combined);
  };

  const handleDeselectAllLessons = () => {
    const filteredSet = new Set(
      filteredLessons.map(l => l.id || '').filter(Boolean)
    );
    setSelectedLessonIds(prev => prev.filter(id => !filteredSet.has(id)));
  };

  // Batch Assign Submission
  const handleAssign = async () => {
    if (selectedUserIds.length === 0 || selectedLessonIds.length === 0) {
      setErrorMessage("Please select at least one user and at least one interactive lesson.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await batchAssignLessons(selectedUserIds, selectedLessonIds, currentAdminId);

      const userCount = selectedUserIds.length;
      const lessonCount = selectedLessonIds.length;
      const totalCreated = result?.count ?? (userCount * lessonCount);

      setSuccessMessage(
        `Successfully assigned ${lessonCount} lesson${lessonCount > 1 ? 's' : ''} to ${userCount} user${userCount > 1 ? 's' : ''}! (${totalCreated} assignment record${totalCreated !== 1 ? 's' : ''} created/updated).`
      );

      if (onAssignmentComplete) {
        onAssignmentComplete();
      }
    } catch (err: any) {
      console.error("Error batch assigning lessons:", err);
      setErrorMessage(err?.message || "Failed to assign lessons to selected users.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalCalculatedAssignments = selectedUserIds.length * selectedLessonIds.length;

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-gray-100 max-w-5xl mx-auto my-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
        <div className="w-12 h-12 bg-tp-purple/10 text-tp-purple rounded-2xl flex items-center justify-center font-black flex-shrink-0">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-black text-gray-900 tracking-tight">Batch Lesson Shield Assigner</h2>
          <p className="text-xs font-semibold text-gray-500">
            Multi-select learners and interactive lessons to grant batch access authorization
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-gray-500 font-bold flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-tp-purple animate-spin" />
          <p className="text-xs uppercase tracking-widest">Loading Roster & Interactive Lessons...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {errorMessage && (
            <div className="p-4 bg-red-50 border-2 border-red-200 text-red-800 rounded-2xl flex items-start gap-3 text-xs font-bold">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="p-4 bg-emerald-50 border-2 border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-3 text-xs font-bold">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div>{successMessage}</div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Multi-Select Users Panel */}
            <div className="bg-gray-50/70 rounded-2xl p-4 border border-gray-200/80 flex flex-col h-[420px]">
              <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                <label className="text-xs font-black uppercase tracking-widest text-gray-800 flex items-center gap-2">
                  <Users className="w-4 h-4 text-tp-purple" /> Select Users ({selectedUserIds.length}/{users.length})
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllUsers}
                    className="text-[10px] font-bold text-tp-purple hover:underline bg-white px-2 py-1 rounded-lg border border-gray-200 shadow-sm"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAllUsers}
                    className="text-[10px] font-bold text-gray-500 hover:underline bg-white px-2 py-1 rounded-lg border border-gray-200 shadow-sm"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* User Search Bar */}
              <div className="my-2 relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter users by name, email..."
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white border border-gray-200 text-xs font-medium focus:outline-none focus:border-tp-purple"
                />
              </div>

              {/* Scrollable Checkbox List */}
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {filteredUsers.length === 0 ? (
                  <p className="text-xs text-gray-400 italic p-4 text-center">No users found</p>
                ) : (
                  filteredUsers.map((u, idx) => {
                    const uid = u.id || u.email || `user_${idx}`;
                    const isChecked = selectedUserIds.includes(uid);
                    return (
                      <div
                        key={uid}
                        onClick={() => toggleUser(uid)}
                        className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                          isChecked
                            ? 'bg-tp-purple/10 border-tp-purple/40 text-gray-900 font-bold shadow-sm'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100/80'
                        }`}
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-tp-purple flex-shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold leading-tight truncate">{u.name}</p>
                          <p className="text-[10px] text-gray-500 font-normal truncate">
                            {u.email || u.id} • {u.role?.toUpperCase() || 'AGENT'}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Multi-Select Lessons Panel */}
            <div className="bg-gray-50/70 rounded-2xl p-4 border border-gray-200/80 flex flex-col h-[420px]">
              <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                <label className="text-xs font-black uppercase tracking-widest text-gray-800 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-tp-red" /> Select Interactive Lessons ({selectedLessonIds.length}/{lessons.length})
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllLessons}
                    className="text-[10px] font-bold text-tp-red hover:underline bg-white px-2 py-1 rounded-lg border border-gray-200 shadow-sm"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAllLessons}
                    className="text-[10px] font-bold text-gray-500 hover:underline bg-white px-2 py-1 rounded-lg border border-gray-200 shadow-sm"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Lesson Search Bar */}
              <div className="my-2 relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter lessons by title or ID..."
                  value={lessonSearchTerm}
                  onChange={(e) => setLessonSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white border border-gray-200 text-xs font-medium focus:outline-none focus:border-tp-red"
                />
              </div>

              {/* Scrollable Checkbox List */}
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {filteredLessons.length === 0 ? (
                  <p className="text-xs text-gray-400 italic p-4 text-center">No interactive lessons found</p>
                ) : (
                  filteredLessons.map((l, idx) => {
                    const lid = l.id || `les_${idx}`;
                    const title = l.title || l.lessonData?.title || 'Untitled Lesson';
                    const isChecked = selectedLessonIds.includes(lid);
                    return (
                      <div
                        key={lid}
                        onClick={() => toggleLesson(lid)}
                        className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                          isChecked
                            ? 'bg-tp-red/10 border-tp-red/40 text-gray-900 font-bold shadow-sm'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100/80'
                        }`}
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-tp-red flex-shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold leading-tight truncate">{title}</p>
                          <p className="text-[10px] text-gray-500 font-normal truncate">ID: {lid}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Prospective Summary Banner */}
          <div className="p-4 bg-purple-50/70 border border-purple-100 rounded-2xl flex items-center justify-between gap-4 text-xs font-bold text-purple-900">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-tp-purple flex-shrink-0" />
              <span>
                Batch Assignment Calculation: <strong>{selectedUserIds.length} User(s)</strong> × <strong>{selectedLessonIds.length} Lesson(s)</strong>
              </span>
            </div>
            <div className="px-3 py-1 rounded-xl bg-tp-purple text-white font-black text-xs shadow-sm">
              {totalCalculatedAssignments} Total Operations
            </div>
          </div>

          {/* Submit Action Button */}
          <button
            type="button"
            onClick={handleAssign}
            disabled={isSubmitting || selectedUserIds.length === 0 || selectedLessonIds.length === 0}
            className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-2 ${
              isSubmitting || selectedUserIds.length === 0 || selectedLessonIds.length === 0
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                : 'bg-gradient-to-r from-tp-purple to-tp-red text-white hover:opacity-95 shadow-tp-purple/20'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Batch Updating Brain_ManualAssignments...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Assign {selectedLessonIds.length} Lesson(s) to {selectedUserIds.length} User(s)
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default LessonAssigner;
