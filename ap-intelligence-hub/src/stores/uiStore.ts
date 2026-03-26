import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  theme: 'light' | 'dark';
  sidebarCollapsed: boolean;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      sidebarCollapsed: false,

      setTheme: (theme) => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        set({ theme });
      },

      toggleTheme: () => {
        const newTheme = get().theme === 'light' ? 'dark' : 'light';
        document.documentElement.classList.toggle('dark', newTheme === 'dark');
        set({ theme: newTheme });
      },

      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
    }),
    {
      name: 'ap-ui-storage',
      onRehydrateStorage: () => (state) => {
        if (state?.theme === 'dark') {
          document.documentElement.classList.add('dark');
        }
      },
    }
  )
);
