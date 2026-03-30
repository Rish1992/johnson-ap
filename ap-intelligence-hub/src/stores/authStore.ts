import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Session } from '@/types/user';

interface AuthState {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  loginAttempts: number;
  lockedUntil: number | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      loginAttempts: 0,
      lockedUntil: null,

      login: async (email: string, password: string) => {
        const state = get();
        if (state.lockedUntil && Date.now() < state.lockedUntil) {
          set({ error: 'Too many attempts. Please try again in 5 minutes.' });
          return;
        }

        set({ isLoading: true, error: null });

        try {
          const { login } = await import('@/lib/handlers');
          const session = await login(email, password);
          set({
            user: session.user,
            session,
            isAuthenticated: true,
            isLoading: false,
            error: null,
            loginAttempts: 0,
            lockedUntil: null,
          });
        } catch {
          const attempts = state.loginAttempts + 1;
          set({
            isLoading: false,
            error: 'Invalid email or password.',
            loginAttempts: attempts,
            lockedUntil: attempts >= 5 ? Date.now() + 5 * 60 * 1000 : null,
          });
        }
      },

      logout: () => {
        // Clear API token from localStorage
        localStorage.removeItem('ap-auth-token');
        set({
          user: null,
          session: null,
          isAuthenticated: false,
          error: null,
        });
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'ap-auth-storage',
      partialize: (state) => ({
        user: state.user,
        session: state.session,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        // Restore API token from persisted session on page reload
        if (state?.session?.token) {
          localStorage.setItem('ap-auth-token', state.session.token);
        }
      },
    }
  )
);
