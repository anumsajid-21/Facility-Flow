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
  setAuth: (user: User, token: string) => void;
  updateUser: (partial: Partial<User>) => void;
  logout: () => void;
  restore: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: typeof window !== "undefined" ? localStorage.getItem("token") : null,
  isAuthenticated: false,
  ready: false,
  setAuth: (user, token) => {
    localStorage.setItem("token", token);
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    set({ user, token, isAuthenticated: true, ready: true });
  },
  updateUser: (partial) => {
    set((state) => ({
      user: state.user ? { ...state.user, ...partial } : null,
    }));
  },
  logout: () => {
    localStorage.removeItem("token");
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
      localStorage.removeItem("token");
      delete api.defaults.headers.common["Authorization"];
      set({ user: null, token: null, isAuthenticated: false, ready: true });
    }
  },
}));
