import { create } from "zustand";
import { api, authService } from "@/services/api";

export type Role = "HIRING_ORG" | "PROVIDER" | "ADMIN" | "WORKER";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatarUrl?: string | null;
  phone?: string | null;
  hiringOrgId?: string | null;
  providerId?: string | null;
  workerId?: string | null;
  hiringOrg?: any;
  provider?: any;
  notificationPreference?: any;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  ready: boolean;
  setAuth: (user: User, token: string, refreshToken?: string) => void;
  updateUser: (partial: Partial<User>) => void;
  logout: () => Promise<void>;
  restore: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: typeof window !== "undefined" ? localStorage.getItem("token") : null,
  isAuthenticated: false,
  ready: false,
  setAuth: (user, token, refreshToken) => {
    localStorage.setItem("token", token);
    if (refreshToken) localStorage.setItem("refresh_token", refreshToken);
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    set({ user, token, isAuthenticated: true, ready: true });
  },
  updateUser: (partial) => {
    set((state) => ({
      user: state.user ? { ...state.user, ...partial } : null,
    }));
  },
  logout: async () => {
    // Best-effort server-side revocation of this session's refresh token.
    try {
      const refresh = localStorage.getItem("refresh_token");
      if (refresh) await authService.logout(refresh);
    } catch {
      /* token already invalid — clear locally regardless */
    }
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    delete api.defaults.headers.common["Authorization"];
    set({ user: null, token: null, isAuthenticated: false, ready: true });
  },
  restore: async () => {
    const token = get().token;
    if (!token) {
      set({ ready: true, isAuthenticated: false });
      return;
    }
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    try {
      const user = await authService.getProfile();
      set({ user, isAuthenticated: true, ready: true });
    } catch {
      // Expired access token: the axios interceptor refreshes transparently;
      // reaching here means refresh also failed (or no refresh token).
      localStorage.removeItem("token");
      localStorage.removeItem("refresh_token");
      delete api.defaults.headers.common["Authorization"];
      set({ user: null, token: null, isAuthenticated: false, ready: true });
    }
  },
}));
