import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ApiKeyState {
  apiKey: string;
  setApiKey: (apiKey: string) => void;
  clearApiKey: () => void;
}

export const useApiKeyStore = create<ApiKeyState>()(
  persist(
    (set) => ({
      apiKey: '',
      setApiKey: (apiKey) => set({ apiKey }),
      clearApiKey: () => set({ apiKey: '' }),
    }),
    {
      name: 'claudeflare-api-key',
    }
  )
);

interface ThemeState {
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'claudeflare-theme',
    }
  )
);

interface PreferencesState {
  language: string;
  setLanguage: (language: string) => void;
  autoSave: boolean;
  setAutoSave: (autoSave: boolean) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      language: 'typescript',
      setLanguage: (language) => set({ language }),
      autoSave: true,
      setAutoSave: (autoSave) => set({ autoSave }),
    }),
    {
      name: 'claudeflare-preferences',
    }
  )
);
