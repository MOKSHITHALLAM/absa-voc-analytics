import clsx from "clsx";
import {
  AlertTriangle, Database, FileUp, FlaskConical, Inbox, LayoutDashboard, LogOut, Menu, Moon, ScanText, Sun, X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Logo } from "../components/Logo";
import { ConfirmDialog } from "../components/ui";
import { useAuth, useTheme } from "../context/AppProviders";
import { api } from "../services/api";
import type { Health } from "../services/types";

const NAV = [
  { to: "/", label: "VoC dashboard", icon: LayoutDashboard, end: true },
  { to: "/analyze", label: "Analyse a review", icon: ScanText },
  { to: "/batch", label: "Batch upload", icon: FileUp },
  { to: "/reviews", label: "Review database", icon: Inbox },
  { to: "/research", label: "Research results", icon: FlaskConical },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const loc = useLocation();
  const nav = useNavigate();
  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => { api.health().then(setHealth).catch(() => setHealth(null)); }, [loc.pathname]);

  return (
    <div className="flex min-h-full">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[90] focus:rounded-control focus:bg-surface focus:px-3 focus:py-2">Skip to content</a>
      {open && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setOpen(false)} aria-hidden />}
      <aside className={clsx("fixed inset-y-0 left-0 z-50 flex w-[248px] shrink-0 flex-col border-r border-line bg-surface transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full")} aria-label="Main navigation">
        <div className="flex h-16 items-center justify-between px-4">
          <Logo />
          <button className="rounded-control p-1.5 text-ink-3 hover:bg-raised lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => clsx("group flex items-center gap-3 rounded-control px-3 py-2 text-[14px] font-medium transition-colors",
                isActive ? "bg-brand/12 text-ink" : "text-ink-2 hover:bg-raised hover:text-ink")}>
              {({ isActive }) => (<>
                <Icon className={clsx("h-[18px] w-[18px]", isActive ? "text-brand" : "text-ink-3 group-hover:text-ink-2")} aria-hidden />
                {label}
              </>)}
            </NavLink>
          ))}
        </nav>
        {health && (
          <div className="mx-3 mb-3 rounded-control border border-line bg-raised/60 p-3 text-[12px] leading-relaxed text-ink-3">
            <p className="flex items-center gap-1.5 font-medium text-ink-2"><Database className="h-3.5 w-3.5" aria-hidden />{health.database.split(" (")[0]} connected</p>
            <p className="num">{health.reviews.toLocaleString()} reviews stored</p>
            {health.model && <p className="truncate" title={health.model.dataset}>Model: {health.model.is_synthetic ? "demo sample" : health.model.dataset}</p>}
          </div>
        )}
        <div className="border-t border-line p-3">
          <div className="flex items-center gap-3 rounded-control px-2 py-2">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand/15 text-sm font-semibold text-brand" aria-hidden>
              {user?.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-medium">{user?.name}</p>
              <p className="text-[12px] capitalize text-ink-3">{user?.role}</p>
            </div>
            <button onClick={() => setConfirmOut(true)} className="rounded-control p-2 text-ink-3 hover:bg-raised hover:text-ink" aria-label="Sign out" title="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-line bg-canvas/85 px-4 backdrop-blur-md sm:px-6">
          <button className="rounded-control p-2 text-ink-2 hover:bg-raised lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <div className="min-w-0 flex-1">
            {health?.model?.is_synthetic ? (
              <NavLink to="/research" className="inline-flex max-w-full items-center gap-2 rounded-full bg-warn/15 px-3 py-1 text-[12.5px] font-medium text-warn">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate">Running on the synthetic demo sample. Train on the HRAST file for real results.</span>
              </NavLink>
            ) : (
              <p className="hidden truncate text-[13px] text-ink-3 lg:block">
                Aspect-based sentiment and Voice of Customer analytics{health?.model ? ` · trained on ${health.model.dataset}` : ""}
              </p>
            )}
          </div>
          <button onClick={toggle} className="rounded-control p-2 text-ink-2 hover:bg-raised hover:text-ink"
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} title="Toggle theme">
            {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </button>
        </header>
        <main id="main" className="page-glow flex-1">
          <div className="mx-auto w-full max-w-[1400px] px-4 py-7 sm:px-6 lg:px-8">
            <Outlet context={health} />
          </div>
        </main>
      </div>
      <ConfirmDialog open={confirmOut} title="Sign out?" message="You will need to sign in again to view the analytics." confirmLabel="Sign out" danger={false}
        onCancel={() => setConfirmOut(false)} onConfirm={() => { setConfirmOut(false); logout(); nav("/login"); }} />
    </div>
  );
}
