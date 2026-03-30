import { create } from 'zustand';
import type { Notification } from '@/types/notification';

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isOpen: boolean;
  isLoading: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  togglePanel: () => void;
  closePanel: () => void;
}

export const useNotificationStore = create<NotificationState>()((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isOpen: false,
  isLoading: false,

  fetchNotifications: async () => {
    set({ isLoading: true });
    try {
      const { fetchNotifications } = await import('@/lib/handlers');
      const notifications = await fetchNotifications();
      const unreadCount = notifications.filter(n => !n.isRead).length;
      set({ notifications, unreadCount, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  markAsRead: async (id: string) => {
    try {
      const { markNotificationRead } = await import('@/lib/handlers');
      await markNotificationRead(id);
      const notifications = get().notifications.map(n =>
        n.id === id ? { ...n, isRead: true } : n
      );
      const unreadCount = notifications.filter(n => !n.isRead).length;
      set({ notifications, unreadCount });
    } catch {
      // handle error
    }
  },

  markAllAsRead: async () => {
    try {
      const { markAllNotificationsRead } = await import('@/lib/handlers');
      await markAllNotificationsRead();
      const notifications = get().notifications.map(n => ({ ...n, isRead: true }));
      set({ notifications, unreadCount: 0 });
    } catch {
      // handle error
    }
  },

  togglePanel: () => set({ isOpen: !get().isOpen }),
  closePanel: () => set({ isOpen: false }),
}));
