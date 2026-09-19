import { create } from "zustand";
import { notificationsApi, messagingApi } from "@/services/api";

interface UnreadState {
  notifications: number;
  messages: number;
  refreshNotifications: () => Promise<void>;
  refreshMessages: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

/**
 * Single source of truth for unread counts so the Sidebar nav badge, the
 * TopBar bell/message icons and the Messages page itself never disagree —
 * previously each fetched independently and only some of them polled, so a
 * thread marked read in one place left a stale badge everywhere else.
 */
export const useUnreadStore = create<UnreadState>((set) => ({
  notifications: 0,
  messages: 0,
  refreshNotifications: async () => {
    try {
      const res = await notificationsApi.list();
      set({ notifications: Number(res?.unreadCount ?? 0) });
    } catch {
      // Leave last-known value on transient failure.
    }
  },
  refreshMessages: async () => {
    try {
      const res = await messagingApi.threads();
      set({ messages: Number(res?.unreadCount ?? 0) });
    } catch {
      // Leave last-known value on transient failure.
    }
  },
  refreshAll: async () => {
    await Promise.all([useUnreadStore.getState().refreshNotifications(), useUnreadStore.getState().refreshMessages()]);
  },
}));
