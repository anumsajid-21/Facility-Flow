import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

export const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

/**
 * Refresh-token rotation on 401.
 *
 * Access tokens are short-lived (30m). When one expires, the first failing
 * request triggers POST /auth/refresh with the stored refresh token; the new
 * pair is persisted and the original request is replayed. Concurrent failures
 * share a single in-flight refresh promise. Auth endpoints themselves (login,
 * refresh, logout…) never trigger the flow, so wrong-password 401s pass
 * through untouched.
 */
let refreshInFlight: Promise<string | null> | null = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error?.config;
    const status = error?.response?.status;
    const url: string = original?.url || "";
    const isAuthRoute = url.includes("/auth/");
    const canRefresh =
      status === 401 &&
      original &&
      !original._retry &&
      !isAuthRoute &&
      typeof window !== "undefined" &&
      !!localStorage.getItem("refresh_token");

    if (canRefresh) {
      original._retry = true;
      refreshInFlight =
        refreshInFlight ||
        (async () => {
          try {
            const res = await axios.post(`${API_URL}/auth/refresh`, {
              refresh_token: localStorage.getItem("refresh_token"),
            });
            const data = (res.data?.data ?? res.data) as {
              access_token: string;
              refresh_token: string;
            };
            localStorage.setItem("token", data.access_token);
            localStorage.setItem("refresh_token", data.refresh_token);
            api.defaults.headers.common["Authorization"] = `Bearer ${data.access_token}`;
            return data.access_token;
          } catch {
            localStorage.removeItem("token");
            localStorage.removeItem("refresh_token");
            return null;
          }
        })();

      try {
        const newToken = await refreshInFlight;
        if (newToken) {
          original.headers.Authorization = `Bearer ${newToken}`;
          return api(original);
        }
        // Refresh rejected (expired/revoked) — session is over.
        window.location.href = "/login";
      } finally {
        refreshInFlight = null;
      }
    }
    return Promise.reject(error);
  }
);

/** Unwraps the backend { data, meta } envelope. */
function unwrap<T = any>(res: { data: any }): T {
  return (res.data?.data ?? res.data) as T;
}
export interface Page<T> { data: T[]; meta: { total: number; page: number; limit: number; pageCount: number } }
function page<T>(res: { data: any }): Page<T> {
  // Backend returns { data: [...], meta } (top level). Be tolerant of nesting just in case.
  const body = res.data ?? {};
  const data: T[] = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : Array.isArray(body?.data?.data) ? body.data.data : [];
  const meta = body?.meta ?? body?.data?.meta ?? { total: data.length, page: 1, limit: Math.max(1, data.length), pageCount: 1 };
  return { data, meta };
}
export function apiError(err: any): string {
  if (!err) return "An unexpected error occurred.";
  const data = err?.response?.data;
  if (data) {
    if (typeof data.message === "string") return data.message;
    if (Array.isArray(data.message)) return data.message.join(", ");
    if (typeof data.error === "string") return data.error;
  }
  return err?.message || "An error occurred while processing your request.";
}

export const authService = {
  login: async (data: { email: string; password: string }) => unwrap(await api.post("/auth/login", data)),
  register: async (data: any) => unwrap(await api.post("/auth/register", data)),
  getProfile: async () => unwrap(await api.get("/auth/me")),
  logout: async (refresh_token: string) => unwrap(await api.post("/auth/logout", { refresh_token })),
};

export const settingsApi = {
  me: async () => unwrap<any>(await api.get("/settings/me")),
  updateProfile: async (data: any) => unwrap<any>(await api.patch("/settings/profile", data)),
  changePassword: async (data: any) => unwrap<any>(await api.post("/settings/change-password", data)),
  getNotifications: async () => unwrap<any>(await api.get("/settings/notifications")),
  updateNotifications: async (data: any) => unwrap<any>(await api.patch("/settings/notifications", data)),
  getSession: async () => unwrap<any>(await api.get("/settings/session")),
};

export const analyticsApi = {
  dashboard: async () => unwrap<any>(await api.get("/analytics")),
  spend: async (params: { from?: string; to?: string } = {}) => unwrap<any>(await api.get("/analytics/spend", { params })),
  exportUrl: (params: { from?: string; to?: string } = {}) => {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return `${API_URL}/analytics/export.csv${query ? `?${query}` : ""}`;
  },
  exportCsv: async (params: { from?: string; to?: string } = {}) => api.get("/analytics/export.csv", { params, responseType: "blob" }),
};

export const adminApi = {
  dashboard: async () => unwrap<any>(await api.get("/admin/dashboard")),
  serviceRequests: async (params: { page?: number; limit?: number } = {}) => page<any>(await api.get("/admin/service-requests", { params: { limit: 50, ...params } })),
  buildings: async (params: { page?: number; limit?: number } = {}) => page<any>(await api.get("/admin/buildings", { params: { limit: 50, ...params } })),
  providers: async () => unwrap<any[]>(await api.get("/admin/providers")),
  organizations: async () => unwrap<any[]>(await api.get("/admin/organizations")),
  users: async () => unwrap<any[]>(await api.get("/admin/users")),
  activity: async () => unwrap<any[]>(await api.get("/admin/activity")),
  verifyProvider: async (id: string, status: string, notes: string) => unwrap(await api.patch(`/admin/providers/${id}/status`, { status, notes })),
  verificationQueue: async () => unwrap<any[]>(await api.get("/admin/verification-queue")),
  bulkReviewDocuments: async (ids: string[], status: "APPROVED" | "REJECTED", notes?: string) =>
    unwrap(await api.post("/admin/verification-documents/bulk-review", { ids, status, notes })),
};

export const orgApi = {
  me: async () => unwrap<any>(await api.get("/organizations/me")),
  update: async (data: { name: string }) => unwrap(await api.patch("/organizations/me", data)),
};

export const facilitiesApi = {
  buildings: async (params: { page?: number; limit?: number } = {}) => page<any>(await api.get("/facilities/buildings", { params: { limit: 100, ...params } })),
  building: async (id: string) => unwrap<any>(await api.get(`/facilities/buildings/${id}`)),
  createBuilding: async (data: any) => unwrap(await api.post("/facilities/buildings", data)),
  updateBuilding: async (id: string, data: any) => unwrap(await api.patch(`/facilities/buildings/${id}`, data)),
  deleteBuilding: async (id: string) => unwrap(await api.delete(`/facilities/buildings/${id}`)),
  archiveBuilding: async (id: string) => unwrap(await api.post(`/facilities/buildings/${id}/archive`)),
  floors: async (buildingId: string) => unwrap<any[]>(await api.get(`/facilities/buildings/${buildingId}/floors`)),
  createFloor: async (buildingId: string, name: string) => unwrap(await api.post(`/facilities/buildings/${buildingId}/floors`, { name })),
  updateFloor: async (id: string, name: string) => unwrap(await api.patch(`/facilities/floors/${id}`, { name })),
  archiveFloor: async (id: string) => unwrap(await api.post(`/facilities/floors/${id}/archive`)),
  areas: async (floorId: string) => unwrap<any[]>(await api.get(`/facilities/floors/${floorId}/areas`)),
  createArea: async (floorId: string, data: { name: string; category?: string }) => unwrap(await api.post(`/facilities/floors/${floorId}/areas`, data)),
  updateArea: async (id: string, data: { name?: string; category?: string }) => unwrap(await api.patch(`/facilities/areas/${id}`, data)),
  areaCategories: async () => unwrap<string[]>(await api.get("/facilities/area-categories")),
};

export const providersApi = {
  list: async (params: { page?: number; limit?: number; categoryId?: string; city?: string } = {}) =>
    page<any>(await api.get("/providers", { params: { limit: params.limit ?? 24, ...params } })),
  public: async (id: string) => unwrap<any>(await api.get(`/provider-public/${id}`)),
};

export const serviceRequestsApi = {
  list: async (params: { page?: number; limit?: number } = {}) => page<any>(await api.get("/service-requests", { params: { limit: 50, ...params } })),
  categories: async () => unwrap<any[]>(await api.get("/service-requests/categories")),
  get: async (id: string) => unwrap<any>(await api.get(`/service-requests/${id}`)),
  create: async (data: any) => unwrap<any>(await api.post("/service-requests", data)),
  update: async (id: string, data: any) => unwrap(await api.patch(`/service-requests/${id}`, data)),
  submit: async (id: string) => unwrap(await api.post(`/service-requests/${id}/submit`)),
  archive: async (id: string) => unwrap(await api.post(`/service-requests/${id}/archive`)),
  matches: async (id: string) => unwrap<any>(await api.get(`/service-requests/${id}/matches`)),
  aiAssistStatus: async () => unwrap<{ enabled: boolean }>(await api.get("/service-requests/ai-assist/status")),
  aiAssist: async (description: string, answers?: Record<string, string>) =>
    unwrap<{ category: { id: string; name: string } | null; title: string; description: string; priority: string; followUpQuestions: string[] }>(
      await api.post("/service-requests/ai-assist", { description, answers }),
    ),
};

export const quotationsApi = {
  list: async (params: { page?: number; limit?: number } = {}) => page<any>(await api.get("/quotations", { params: { limit: 50, ...params } })),
  openRequests: async () => unwrap<any[]>(await api.get("/quotations/open-requests")),
  forRequest: async (requestId: string) => unwrap<any[]>(await api.get(`/quotations/request/${requestId}`)),
  get: async (id: string) => unwrap<any>(await api.get(`/quotations/${id}`)),
  create: async (data: any) => unwrap<any>(await api.post("/quotations", data)),
  submit: async (id: string) => unwrap(await api.post(`/quotations/${id}/submit`)),
  withdraw: async (id: string) => unwrap(await api.post(`/quotations/${id}/withdraw`)),
  accept: async (id: string) => unwrap<any>(await api.post(`/quotations/${id}/accept`)),
};

export const jobsApi = {
  list: async (params: { page?: number; limit?: number } = {}) => page<any>(await api.get("/jobs", { params: { limit: 50, ...params } })),
  get: async (id: string) => unwrap<any>(await api.get(`/jobs/${id}`)),
  create: async (data: any) => unwrap<any>(await api.post("/jobs", data)),
  update: async (id: string, data: any) => unwrap(await api.patch(`/jobs/${id}`, data)),
  start: async (id: string) => unwrap(await api.post(`/jobs/${id}/start`)),
  complete: async (id: string) => unwrap(await api.post(`/jobs/${id}/complete`)),
  assignWorker: async (id: string, workerId: string) => unwrap(await api.post(`/jobs/${id}/assign-worker`, { workerId })),
  workers: async (id: string) => unwrap<any[]>(await api.get(`/jobs/${id}/workers`)),
  activity: async (id: string) => unwrap<any[]>(await api.get(`/jobs/${id}/activity`)),
};

export const workersApi = {
  list: async (params: { page?: number; limit?: number } = {}) => page<any>(await api.get("/workers", { params: { limit: 50, ...params } })),
  get: async (id: string) => unwrap<any>(await api.get(`/workers/${id}`)),
  create: async (data: any) => unwrap<any>(await api.post("/workers", data)),
  update: async (id: string, data: any) => unwrap(await api.patch(`/workers/${id}`, data)),
  invite: async (id: string, email: string) => unwrap(await api.post(`/workers/${id}/invite`, { email })),
  setStatus: async (id: string, status: string) => unwrap(await api.patch(`/workers/${id}/status`, { status })),
  assignments: async (id: string) => unwrap<any[]>(await api.get(`/workers/${id}/assignments`)),
};

export const proofApi = {
  add: async (jobId: string, data: any, beforePhotoIds: string[] = [], afterPhotoIds: string[] = []) =>
    unwrap<any>(await api.post(`/jobs/${jobId}/proof`, { ...data, beforePhotoIds, afterPhotoIds })),
  get: async (jobId: string) => unwrap<any>(await api.get(`/jobs/${jobId}/proof`)),
  byProvider: async (providerId: string) => unwrap<any[]>(await api.get(`/jobs/proof/by-provider/${providerId}`)),
};

export const approvalsApi = {
  listForJob: async (jobId: string) => unwrap<any[]>(await api.get(`/jobs/${jobId}/approvals`)),
  approve: async (jobId: string, notes?: string) => unwrap(await api.post(`/jobs/${jobId}/approve`, { type: "approve", notes: notes ?? "" })),
  rework: async (jobId: string, reason?: string) => unwrap(await api.post(`/jobs/${jobId}/rework`, { type: "rework", notes: reason ?? "" })),
};

export const invoicesApi = {
  list: async (params: { page?: number; limit?: number } = {}) => page<any>(await api.get("/invoices", { params: { limit: 50, ...params } })),
  get: async (id: string) => unwrap<any>(await api.get(`/invoices/${id}`)),
  updateStatus: async (id: string, status: string) => unwrap(await api.patch(`/invoices/${id}/status`, { status })),
  addPayment: async (id: string, data: { amount: number; paymentMethod: string; date?: string }) =>
    unwrap(await api.post(`/invoices/${id}/payments`, data)),
  pdfUrl: (id: string) => `${API_URL}/invoices/${id}/pdf`,
  paymentHistory: async (params: { from?: string; to?: string; providerId?: string; category?: string } = {}) => {
    const body: any = await api.get("/invoices/payment-history", { params }).then((r) => r.data?.data ?? r.data);
    const data: any[] = Array.isArray(body) ? body : (body?.data ?? []);
    const total = Array.isArray(body) ? data.reduce((s: number, r: any) => s + Number(r.amount || 0), 0) : Number(body?.total ?? 0);
    return { data, total, count: data.length };
  },
  paymentHistoryCsvUrl: (params: { from?: string; to?: string; providerId?: string; category?: string } = {}) =>
    `${API_URL}/invoices/payment-history/csv?${new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString()}`,
};

export const checklistsApi = {
  list: async () => unwrap<any[]>(await api.get("/checklists")),
  byCategory: async (categoryId: string) => unwrap<any[]>(await api.get(`/checklists/category/${categoryId}`)),
  create: async (data: any, items: any[]) => unwrap<any>(await api.post("/checklists", { ...data, items })),
  saveResults: async (jobId: string, results: { checklistItemId: string; isChecked: boolean; notes?: string }[]) =>
    unwrap<any>(await api.post(`/checklists/jobs/${jobId}/results`, { results })),
  jobResults: async (jobId: string) => unwrap<any[]>(await api.get(`/checklists/jobs/${jobId}/results`)),
};

export const reviewsApi = {
  listMine: async () => unwrap<any[]>(await api.get("/reviews")),
  byProvider: async (providerId: string) => unwrap<any>(await api.get(`/reviews/provider/${providerId}`)),
  create: async (data: { jobId: string; providerId: string; [k: string]: any }) => unwrap(await api.post("/reviews", data)),
};

export const notificationsApi = {
  list: async () => unwrap<any>(await api.get("/notifications")),
  markRead: async (id: string) => unwrap(await api.post(`/notifications/${id}/read`)),
  markAllRead: async () => unwrap(await api.post("/notifications/read-all")),
};

export const filesApi = {
  upload: async (file: File, kind: string) => {
    const form = new FormData();
    form.append("file", file);
    const res = await api.post(`/files/upload/${kind}`, form, { headers: { "Content-Type": "multipart/form-data" } });
    return unwrap<{ id: string; originalName: string }>(res);
  },
  url: (id: string) => `${API_URL}/files/${id}/download`,
};

export const contractsApi = {
  list: async (params: { page?: number; limit?: number } = {}) => page<any>(await api.get("/contracts", { params: { limit: 50, ...params } })),
  get: async (id: string) => unwrap<any>(await api.get(`/contracts/${id}`)),
  create: async (data: any) => unwrap<any>(await api.post("/contracts", data)),
  update: async (id: string, data: any) => unwrap(await api.patch(`/contracts/${id}`, data)),
  activity: async (id: string) => unwrap<any[]>(await api.get(`/contracts/${id}/activity`)),
};

export const messagingApi = {
  threads: async () => unwrap<any>(await api.get("/messages/threads")),
  thread: async (id: string) => unwrap<any>(await api.get(`/messages/threads/${id}`)),
  create: async (data: any) => unwrap<any>(await api.post("/messages/threads", data)),
  send: async (id: string, body: string, audio?: { audioFileId: string; audioSeconds: number }) =>
    unwrap<any>(await api.post(`/messages/threads/${id}/messages`, { body, ...audio })),
};

export const slaApi = {
  policies: async () => unwrap<any[]>(await api.get("/sla/policies")),
  createPolicy: async (data: any) => unwrap<any>(await api.post("/sla/policies", data)),
  job: async (id: string) => unwrap<any>(await api.get(`/sla/jobs/${id}`)),
};

export const recurringApi = {
  get: async (contractId: string) => unwrap<any>(await api.get(`/recurring/contracts/${contractId}`)),
  save: async (contractId: string, data: any) => unwrap<any>(await api.post(`/recurring/contracts/${contractId}`, data)),
  pause: async (contractId: string, paused: boolean) => unwrap<any>(await api.patch(`/recurring/contracts/${contractId}`, { paused })),
};