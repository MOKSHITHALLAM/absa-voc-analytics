import axios, { AxiosError } from "axios";
import type {
  Analysis, BatchResult, Dashboard, FilterOptions, Health, Page, Research, ReviewItem, TokenResponse, User,
} from "./types";

const TOKEN_KEY = "voc-token";
export const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

export const http = axios.create({ baseURL: API_BASE, timeout: 180_000 });

export const tokenStore = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t: string) => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* storage unavailable */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ } },
};

http.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

http.interceptors.response.use(
  (r) => r,
  (error: AxiosError) => {
    if (error.response?.status === 401 && !String(error.config?.url).includes("/auth/")) onUnauthorized?.();
    return Promise.reject(error);
  },
);

/** Human-readable message from any API error. */
export function errorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) return "The server could not be reached. Check that the backend is running on port 8000.";
    const data = err.response.data as { detail?: unknown } | undefined;
    if (data && typeof data === "object" && "detail" in data) {
      const d = data.detail;
      if (typeof d === "string") return d;
      if (Array.isArray(d)) return d.map((x) => (x as { msg?: string }).msg ?? "").join("; ");
    }
    return `Request failed (${err.response.status}).`;
  }
  return err instanceof Error ? err.message : fallback;
}

const clean = (f: object) =>
  Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined && v !== "" && v !== null));

/** Figures are served next to the API (…/figures/x.png). */
export const figureUrl = (name: string) => `${API_BASE.replace(/\/api$/, "")}/figures/${name}`;

export const api = {
  login: (email: string, password: string) => http.post<TokenResponse>("/auth/login", { email, password }).then((r) => r.data),
  register: (name: string, email: string, password: string) =>
    http.post<TokenResponse>("/auth/register", { name, email, password }).then((r) => r.data),
  me: () => http.get<User>("/auth/me").then((r) => r.data),
  logout: () => undefined,

  health: () => http.get<Health>("/health").then((r) => r.data),
  analyze: (text: string, clause_mode: boolean, hotel?: string, save = true) =>
    http.post<Analysis>("/analyze", { text, clause_mode, hotel: hotel || null, save }).then((r) => r.data),
  voice: (blob: Blob, filename: string, clause_mode: boolean, hotel?: string) => {
    const fd = new FormData();
    fd.append("audio", blob, filename);
    fd.append("clause_mode", String(clause_mode));
    if (hotel) fd.append("hotel", hotel);
    return http.post<Analysis>("/voice", fd).then((r) => r.data);
  },
  batch: (file: File, clause_mode: boolean) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("clause_mode", String(clause_mode));
    return http.post<BatchResult>("/analyze/batch", fd).then((r) => r.data);
  },

  reviews: (p: { page?: number; size?: number; q?: string; sentiment?: string; aspect?: string; source?: string; hotel?: string }) =>
    http.get<Page<ReviewItem>>("/reviews", { params: clean(p) }).then((r) => r.data),
  review: (id: number) => http.get<ReviewItem>(`/reviews/${id}`).then((r) => r.data),
  deleteReview: (id: number) => http.delete(`/reviews/${id}`),
  exportCsv: (source?: string) =>
    http.get<Blob>("/reviews/export.csv", { params: clean({ source }), responseType: "blob" }).then((r) => r.data),
  filters: () => http.get<FilterOptions>("/filters").then((r) => r.data),
  dashboard: (p: { source?: string; hotel?: string }) => http.get<Dashboard>("/dashboard", { params: clean(p) }).then((r) => r.data),
  research: () => http.get<Research>("/research").then((r) => r.data),
  reseed: () => http.post<{ removed: number; added: number }>("/admin/reseed").then((r) => r.data),
};

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
