import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from "react";
import { api, setUnauthorizedHandler, tokenStore } from "../services/api";
import type { User } from "../services/types";

/* ------------------------------------------------------------------ theme */
type Theme = "light" | "dark";
const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({ theme: "dark", toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() =>
    (document.documentElement.dataset.theme as Theme) || "dark");
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("iv-theme", theme); } catch { /* ignore */ }
  }, [theme]);
  const toggle = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), []);
  return <ThemeCtx.Provider value={{ theme, toggle }}>{children}</ThemeCtx.Provider>;
}
export const useTheme = () => useContext(ThemeCtx);

/* ------------------------------------------------------------------ toasts */
type ToastKind = "success" | "error" | "info";
interface Toast { id: number; kind: ToastKind; message: string }
const ToastCtx = createContext<{ notify: (kind: ToastKind, message: string) => void }>({ notify: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const dismiss = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));
  const notify = useCallback((kind: ToastKind, message: string) => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-3), { id, kind, message }]);
    setTimeout(() => dismiss(id), kind === "error" ? 7000 : 4000);
  }, []);
  const icon = { success: CheckCircle2, error: XCircle, info: Info };
  const tone = { success: "text-pos", error: "text-neg", info: "text-brand" };
  return (
    <ToastCtx.Provider value={{ notify }}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-5 right-5 z-[80] flex w-[min(380px,calc(100vw-2.5rem))] flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => {
            const Icon = icon[t.kind];
            return (
              <motion.div key={t.id} role={t.kind === "error" ? "alert" : "status"}
                initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, transition: { duration: 0.15 } }}
                className="pointer-events-auto flex items-start gap-3 rounded-control border border-line bg-surface px-4 py-3 text-sm shadow-pop">
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone[t.kind]}`} aria-hidden />
                <p className="flex-1 text-ink">{t.message}</p>
                <button onClick={() => dismiss(t.id)} aria-label="Dismiss notification" className="text-ink-3 hover:text-ink">
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* ------------------------------------------------------------------ auth */
interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => void;
  setUser: (u: User) => void;
}
const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    api.logout();
    tokenStore.clear();
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => { tokenStore.clear(); setUser(null); });
    if (!tokenStore.get()) { setLoading(false); return; }
    api.me().then(setUser).catch(() => tokenStore.clear()).finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthState>(() => ({
    user, loading, logout, setUser,
    login: async (email, password) => {
      const r = await api.login(email, password);
      tokenStore.set(r.access_token);
      setUser(r.user);
      return r.user;
    },
    register: async (name, email, password) => {
      const r = await api.register(name, email, password);
      tokenStore.set(r.access_token);
      setUser(r.user);
      return r.user;
    },
  }), [user, loading, logout]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

