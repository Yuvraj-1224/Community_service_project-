import axios, { AxiosError } from "axios";
import type {
  AdminDashboard, ApiEnvelope, AuthResponse, DashboardStats, Disease, DiseaseInput, ModelInfo, Paginated, Scan,
  ScanDetail, User,
} from "./types";

const TOKEN_KEY = "agrovision.token";
export const API_BASE = `${(import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "")}/api`;

export const tokenStore = {
  get: (): string | null => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (t: string) => {
    try {
      localStorage.setItem(TOKEN_KEY, t);
    } catch {
      /* ignore */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

export const http = axios.create({ baseURL: API_BASE, timeout: 60_000 });

http.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: (() => void) | null) => {
  onUnauthorized = fn;
};

http.interceptors.response.use(
  (r) => r,
  (error: AxiosError<{ error?: { code?: string } }>) => {
    const code = error.response?.data?.error?.code;
    if (error.response?.status === 401 && (code === "invalid_token" || code === "unauthorized")) onUnauthorized?.();
    return Promise.reject(error);
  },
);

export interface ApiErrorInfo {
  code: string;
  message: string;
  status?: number;
  fields?: { field: string; message: string }[];
}

/** Normalise any error into {code, message} – `code` is used for i18n lookup (errors.<code>). */
export async function parseApiError(err: unknown): Promise<ApiErrorInfo> {
  if (axios.isAxiosError(err)) {
    if (!err.response) return { code: "network", message: "Network error" };
    let data: unknown = err.response.data;
    if (data instanceof Blob) {
      try {
        data = JSON.parse(await data.text());
      } catch {
        data = null;
      }
    }
    const d = data as { message?: string; error?: { code?: string; details?: { errors?: { field: string; message: string }[] } } } | null;
    return {
      code: d?.error?.code ?? "http_error",
      message: d?.message ?? err.message,
      status: err.response.status,
      fields: d?.error?.details?.errors,
    };
  }
  return { code: "unknown", message: err instanceof Error ? err.message : String(err) };
}

const unwrap = <T,>(p: Promise<{ data: ApiEnvelope<T> }>) => p.then((r) => r.data.data);

export const authApi = {
  register: (body: {
    full_name: string; email: string; mobile: string; password: string; confirm_password: string;
    preferred_language: "en" | "hi"; role: "farmer";
  }) => unwrap<AuthResponse>(http.post("/auth/register", body)),
  login: (email: string, password: string) => unwrap<AuthResponse>(http.post("/auth/login", { email, password })),
  me: () => unwrap<User>(http.get("/auth/me")),
};

export const detectionApi = {
  predict: (file: File, onProgress?: (pct: number) => void) => {
    const fd = new FormData();
    fd.append("file", file);
    return unwrap<ScanDetail>(
      http.post("/detection/predict", fd, {
        onUploadProgress: (e) => e.total && onProgress?.(Math.round((e.loaded / e.total) * 100)),
      }),
    );
  },
  history: (params: Record<string, string | number | undefined>) =>
    unwrap<Paginated<Scan>>(http.get("/detection/history", { params })),
  get: (id: number) => unwrap<ScanDetail>(http.get(`/detection/${id}`)),
  remove: (id: number) => unwrap<{ id: number }>(http.delete(`/detection/${id}`)),
  imageBlob: (url: string) => http.get(url.replace(/^\/api/, ""), { responseType: "blob" }).then((r) => r.data as Blob),
  report: (id: number, lang: "en" | "hi") =>
    http.get(`/detection/${id}/report`, { params: { lang }, responseType: "blob" }).then((r) => r.data as Blob),
  modelInfo: () => unwrap<ModelInfo>(http.get("/detection/model-info")),
};

export const diseaseApi = {
  list: (params: Record<string, string | boolean | undefined> = {}) =>
    unwrap<{ items: Disease[]; total: number; filters: { crops: string[]; disease_types: string[] } }>(
      http.get("/diseases", { params }),
    ),
  search: (q: string, params: Record<string, string | boolean | undefined> = {}) =>
    unwrap<{ items: Disease[]; total: number }>(http.get("/diseases/search", { params: { q, ...params } })),
  get: (id: number) => unwrap<Disease>(http.get(`/diseases/${id}`)),
};

export const dashboardApi = {
  stats: () => unwrap<DashboardStats>(http.get("/dashboard/stats")),
  recent: (limit = 5) => unwrap<Scan[]>(http.get("/dashboard/recent-scans", { params: { limit } })),
};

export const userApi = {
  profile: () => unwrap<User>(http.get("/users/profile")),
  update: (body: Partial<Pick<User, "full_name" | "mobile" | "preferred_language">>) =>
    unwrap<User>(http.put("/users/profile", body)),
  changePassword: (body: { current_password: string; new_password: string; confirm_password: string }) =>
    unwrap<null>(http.put("/users/change-password", body)),
};

export const adminApi = {
  dashboard: () => unwrap<AdminDashboard>(http.get("/admin/dashboard")),
  users: (params: Record<string, string | number | undefined>) => unwrap<Paginated<User>>(http.get("/admin/users", { params })),
  setUserActive: (id: number, is_active: boolean) => unwrap<User>(http.patch(`/admin/users/${id}`, { is_active })),
  createDisease: (body: Partial<DiseaseInput>) => unwrap<Disease>(http.post("/admin/diseases", body)),
  updateDisease: (id: number, body: Partial<DiseaseInput>) => unwrap<Disease>(http.put(`/admin/diseases/${id}`, body)),
  deleteDisease: (id: number) => unwrap<{ id: number }>(http.delete(`/admin/diseases/${id}`)),
};
