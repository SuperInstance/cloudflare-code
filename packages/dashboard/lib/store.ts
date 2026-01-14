/**
 * Global state management using Zustand
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DashboardStore, Project, ChatSession, WSNotification, User } from '@/types';

export const useDashboardStore = create<DashboardStore>()(
  persist(
    (set) => ({
      // State
      user: null,
      projects: [],
      currentProject: null,
      chatSessions: [],
      currentSession: null,
      notifications: [],
      theme: 'dark',
      sidebarOpen: true,
      isLoading: false,
      error: null,

      // Actions
      setUser: (user) => set({ user }),

      setProjects: (projects) => set({ projects }),

      setCurrentProject: (project) => set({ currentProject: project }),

      setChatSessions: (sessions) => set({ chatSessions: sessions }),

      setCurrentSession: (session) => set({ currentSession: session }),

      addNotification: (notification) =>
        set((state) => ({
          notifications: [notification, ...state.notifications].slice(0, 50),
        })),

      markNotificationRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        })),

      clearNotifications: () => set({ notifications: [] }),

      setTheme: (theme) => set({ theme }),

      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      setLoading: (isLoading) => set({ isLoading }),

      setError: (error) => set({ error }),
    }),
    {
      name: 'claudeflare-dashboard',
      partialize: (state) => ({
        theme: state.theme,
        sidebarOpen: state.sidebarOpen,
        user: state.user,
      }),
    }
  )
);

// ============================================================================
// Chat Store
// ============================================================================

interface ChatStore {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingMessageId: string | null;

  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  deleteMessage: (id: string) => void;
  setStreaming: (isStreaming: boolean, messageId?: string | null) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  isStreaming: false,
  streamingMessageId: null,

  setMessages: (messages) => set({ messages }),

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, ...updates } : m
      ),
    })),

  deleteMessage: (id) =>
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== id),
    })),

  setStreaming: (isStreaming, messageId) =>
    set({
      isStreaming,
      streamingMessageId: messageId || null,
    }),

  clearMessages: () => set({ messages: [] }),
}));

// ============================================================================
// Editor Store
// ============================================================================

interface EditorStore {
  openFiles: Array<{
    id: string;
    name: string;
    path: string;
    content: string;
    modified: boolean;
  }>;
  activeFileId: string | null;
  cursorPosition: { line: number; column: number } | null;

  openFile: (file: {
    id: string;
    name: string;
    path: string;
    content: string;
  }) => void;
  closeFile: (fileId: string) => void;
  setActiveFile: (fileId: string) => void;
  updateFileContent: (fileId: string, content: string) => void;
  setFileModified: (fileId: string, modified: boolean) => void;
  setCursorPosition: (position: { line: number; column: number } | null) => void;
  closeAllFiles: () => void;
}

export const useEditorStore = create<EditorStore>((set) => ({
  openFiles: [],
  activeFileId: null,
  cursorPosition: null,

  openFile: (file) =>
    set((state) => {
      const exists = state.openFiles.find((f) => f.id === file.id);
      if (exists) {
        return { activeFileId: file.id };
      }
      return {
        openFiles: [...state.openFiles, { ...file, modified: false }],
        activeFileId: file.id,
      };
    }),

  closeFile: (fileId) =>
    set((state) => {
      const newFiles = state.openFiles.filter((f) => f.id !== fileId);
      const newActiveFileId =
        state.activeFileId === fileId
          ? newFiles.length > 0
            ? newFiles[newFiles.length - 1].id
            : null
          : state.activeFileId;
      return {
        openFiles: newFiles,
        activeFileId: newActiveFileId,
      };
    }),

  setActiveFile: (fileId) => set({ activeFileId: fileId }),

  updateFileContent: (fileId, content) =>
    set((state) => ({
      openFiles: state.openFiles.map((f) =>
        f.id === fileId ? { ...f, content, modified: true } : f
      ),
    })),

  setFileModified: (fileId, modified) =>
    set((state) => ({
      openFiles: state.openFiles.map((f) =>
        f.id === fileId ? { ...f, modified } : f
      ),
    })),

  setCursorPosition: (position) => set({ cursorPosition: position }),

  closeAllFiles: () =>
    set({
      openFiles: [],
      activeFileId: null,
      cursorPosition: null,
    }),
}));

// ============================================================================
// Collaboration Store
// ============================================================================

interface PresenceUser {
  userId: string;
  name: string;
  avatar?: string;
  fileId?: string;
  cursor?: { line: number; column: number };
  color: string;
  lastSeen: number;
}

interface CollabStore {
  users: Map<string, PresenceUser>;
  cursors: Map<string, { line: number; column: number }>;

  setUsers: (users: PresenceUser[]) => void;
  addUser: (user: PresenceUser) => void;
  removeUser: (userId: string) => void;
  updateUser: (userId: string, updates: Partial<PresenceUser>) => void;
  setUserCursor: (userId: string, cursor: { line: number; column: number }) => void;
  clearUsers: () => void;
}

const generateColor = (userId: string): string => {
  const colors = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
    '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
    '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
    '#ec4899', '#f43f5e'
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export const useCollabStore = create<CollabStore>((set) => ({
  users: new Map(),
  cursors: new Map(),

  setUsers: (users) =>
    set(() => {
      const userMap = new Map();
      const cursorMap = new Map();
      users.forEach((user) => {
        userMap.set(user.userId, { ...user, color: generateColor(user.userId) });
        if (user.cursor) {
          cursorMap.set(user.userId, user.cursor);
        }
      });
      return { users: userMap, cursors: cursorMap };
    }),

  addUser: (user) =>
    set((state) => {
      const newUsers = new Map(state.users);
      newUsers.set(user.userId, { ...user, color: generateColor(user.userId) });
      return { users: newUsers };
    }),

  removeUser: (userId) =>
    set((state) => {
      const newUsers = new Map(state.users);
      const newCursors = new Map(state.cursors);
      newUsers.delete(userId);
      newCursors.delete(userId);
      return { users: newUsers, cursors: newCursors };
    }),

  updateUser: (userId, updates) =>
    set((state) => {
      const newUsers = new Map(state.users);
      const existing = newUsers.get(userId);
      if (existing) {
        newUsers.set(userId, { ...existing, ...updates });
      }
      return { users: newUsers };
    }),

  setUserCursor: (userId, cursor) =>
    set((state) => {
      const newCursors = new Map(state.cursors);
      newCursors.set(userId, cursor);
      return { cursors: newCursors };
    }),

  clearUsers: () => set({ users: new Map(), cursors: new Map() }),
}));
