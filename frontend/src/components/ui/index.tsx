import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, Star, X } from "lucide-react";
import {
  forwardRef, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode, type SelectHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { SENTIMENT_LABEL, sentimentColor } from "../../lib/format";

/* ------------------------------------------------------------------ Button */
type Variant = "primary" | "secondary" | "ghost" | "danger";
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md";
  loading?: boolean;
  icon?: ReactNode;
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, icon, className, children, disabled, ...rest }, ref) {
  return (
    <button ref={ref} disabled={disabled || loading} {...rest}
      className={clsx(
        "inline-flex select-none items-center justify-center gap-2 rounded-control font-medium transition-[background,border,color,box-shadow] duration-150 disabled:cursor-not-allowed disabled:opacity-55",
        size === "sm" ? "h-8 px-3 text-[13px]" : "h-10 px-4 text-sm",
        variant === "primary" && "bg-brand text-brand-ink shadow-[0_1px_0_rgb(255_255_255/0.15)_inset] hover:brightness-110",
        variant === "secondary" && "border border-line bg-surface text-ink hover:border-ink-3/60 hover:bg-raised",
        variant === "ghost" && "text-ink-2 hover:bg-raised hover:text-ink",
        variant === "danger" && "bg-neg text-white hover:brightness-110",
        className)}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

/* ------------------------------------------------------------------ Badges */
export function SentimentBadge({ label, size = "md" }: { label: string | null | undefined; size?: "sm" | "md" }) {
  if (!label) return <span className="text-xs text-ink-3">Not analysed</span>;
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full font-medium",
      size === "sm" ? "px-2 py-0.5 text-[11.5px]" : "px-2.5 py-1 text-xs")}
      style={{ background: sentimentColor(label, 0.14), color: sentimentColor(label) }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: sentimentColor(label) }} aria-hidden />
      {SENTIMENT_LABEL[label] ?? label}
    </span>
  );
}

export function Chip({ children, tone = "default", className }: { children: ReactNode; tone?: "default" | "brand" | "warn"; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium",
      tone === "default" && "bg-raised text-ink-2 ring-1 ring-inset ring-line",
      tone === "brand" && "bg-brand/12 text-brand",
      tone === "warn" && "bg-warn/15 text-warn", className)}>
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ Panel */
export function Panel({ title, description, actions, children, className, bodyClassName }: {
  title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string;
}) {
  return (
    <section className={clsx("panel flex flex-col", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] text-ink-3">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={clsx("flex-1 px-5 pb-5 pt-3", bodyClassName)}>{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ Loading / empty / error */
export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-control bg-raised", className)} aria-hidden />;
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 text-sm text-ink-3">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {label}
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon && <div className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-raised text-ink-3">{icon}</div>}
      <p className="font-medium text-ink">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-ink-3">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-control border border-neg/30 bg-neg/8 px-4 py-3 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-neg" aria-hidden />
      <p className="flex-1 text-ink">{message}</p>
      {onRetry && <button className="font-medium text-brand hover:underline" onClick={onRetry}>Try again</button>}
    </div>
  );
}

/* ------------------------------------------------------------------ Tooltip */
export function Tooltip({ content, children, side = "top" }: { content: ReactNode; children: ReactNode; side?: "top" | "bottom" }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} aria-describedby={open ? id : undefined}>
      {children}
      <AnimatePresence>
        {open && (
          <motion.span id={id} role="tooltip" initial={{ opacity: 0, y: side === "top" ? 4 : -4 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.12 }}
            className={clsx("pointer-events-none absolute left-1/2 z-50 w-max max-w-[280px] -translate-x-1/2 rounded-control border border-line bg-surface px-3 py-2 text-left text-xs font-normal leading-relaxed text-ink-2 shadow-pop",
              side === "top" ? "bottom-full mb-2" : "top-full mt-2")}>
            {content}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

/* ------------------------------------------------------------------ Modal + confirm */
export function Modal({ open, onClose, title, children, footer, width = "max-w-lg" }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; width?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    setTimeout(() => ref.current?.querySelector<HTMLElement>("[data-autofocus], button, input, textarea, select")?.focus(), 20);
    return () => { window.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [open, onClose]);
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] grid place-items-center p-4">
          <motion.div className="absolute inset-0 bg-[rgb(4_8_20/0.55)] backdrop-blur-[2px]" onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div ref={ref} role="dialog" aria-modal="true" aria-label={title}
            initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className={clsx("relative w-full rounded-panel border border-line bg-surface shadow-pop", width)}>
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="text-base font-semibold">{title}</h2>
              <button onClick={onClose} aria-label="Close dialog" className="rounded-control p-1 text-ink-3 hover:bg-raised hover:text-ink"><X className="h-4 w-4" /></button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-5 py-4 scrollbar-thin">{children}</div>
            {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel, onConfirm, onCancel, danger = true, loading }: {
  open: boolean; title: string; message: ReactNode; confirmLabel: string; onConfirm: () => void; onCancel: () => void; danger?: boolean; loading?: boolean;
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title} width="max-w-md"
      footer={<>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading} data-autofocus>{confirmLabel}</Button>
      </>}>
      <div className="text-sm leading-relaxed text-ink-2">{message}</div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ Form bits */
export function Select({ label, className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  const id = useId();
  return (
    <div className={className}>
      {label && <label htmlFor={rest.id ?? id} className="label">{label}</label>}
      <select id={rest.id ?? id} {...rest} className="field h-10 cursor-pointer appearance-none bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-9"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238892a8' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}>
        {children}
      </select>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-ink-2">
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={clsx("relative h-5 w-9 shrink-0 rounded-full transition-colors", checked ? "bg-brand" : "bg-line")}>
        <span className={clsx("absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform", checked ? "translate-x-4" : "translate-x-0.5")} />
      </button>
      {label}
    </label>
  );
}

export function Tabs<T extends string>({ value, onChange, items, className }: {
  value: T; onChange: (v: T) => void; items: { value: T; label: string; icon?: ReactNode }[]; className?: string;
}) {
  return (
    <div role="tablist" className={clsx("inline-flex rounded-control border border-line bg-raised p-1", className)}>
      {items.map((it) => (
        <button key={it.value} role="tab" aria-selected={value === it.value} onClick={() => onChange(it.value)}
          className={clsx("relative inline-flex h-8 items-center gap-2 rounded-[6px] px-3 text-[13px] font-medium transition-colors",
            value === it.value ? "text-ink" : "text-ink-3 hover:text-ink-2")}>
          {value === it.value && (
            <motion.span layoutId={`tab-${items.map((i) => i.value).join("")}`} className="absolute inset-0 rounded-[6px] bg-surface shadow-sm ring-1 ring-line"
              transition={{ type: "spring", stiffness: 500, damping: 38 }} />
          )}
          <span className="relative inline-flex items-center gap-2">{it.icon}{it.label}</span>
        </button>
      ))}
    </div>
  );
}

export function StarRating({ value, onChange, size = 22, readOnly }: { value: number | null; onChange?: (v: number | null) => void; size?: number; readOnly?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;
  if (readOnly) {
    return (
      <span className="inline-flex items-center gap-0.5" aria-label={value ? `${value} out of 5 stars` : "No rating"}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} style={{ width: size, height: size }} className={i <= (value ?? 0) ? "fill-warn text-warn" : "text-line"} aria-hidden />
        ))}
      </span>
    );
  }
  return (
    <div role="radiogroup" aria-label="Star rating" className="inline-flex items-center gap-1" onMouseLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" role="radio" aria-checked={value === i} aria-label={`${i} star${i > 1 ? "s" : ""}`}
          onMouseEnter={() => setHover(i)} onClick={() => onChange?.(value === i ? null : i)}
          className="rounded-[4px] p-0.5 transition-transform hover:scale-110">
          <Star style={{ width: size, height: size }} className={i <= shown ? "fill-warn text-warn" : "text-ink-3/50"} />
        </button>
      ))}
    </div>
  );
}

export function Pagination({ page, pages, total, pageSize, onPage }: { page: number; pages: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const nums: (number | "…")[] = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) nums.push(p);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="num text-ink-3">{from}–{to} of {total.toLocaleString()}</p>
      <div className="flex items-center gap-1">
        <button aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}
          className="grid h-8 w-8 place-items-center rounded-control text-ink-2 hover:bg-raised disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
        {nums.map((n, i) => n === "…" ? <span key={`e${i}`} className="px-1 text-ink-3">…</span> : (
          <button key={n} onClick={() => onPage(n)} aria-current={n === page ? "page" : undefined}
            className={clsx("num h-8 min-w-8 rounded-control px-2", n === page ? "bg-brand/15 font-semibold text-brand" : "text-ink-2 hover:bg-raised")}>{n}</button>
        ))}
        <button aria-label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)}
          className="grid h-8 w-8 place-items-center rounded-control text-ink-2 hover:bg-raised disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
      </div>
    </nav>
  );
}

export function ProgressBar({ value, tone = "brand", label }: { value: number; tone?: "brand" | "pos" | "neg"; label?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-raised" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={clsx("h-full rounded-full transition-[width] duration-300", { brand: "bg-brand", pos: "bg-pos", neg: "bg-neg" }[tone])} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h1 className="text-[26px] font-semibold leading-tight">{title}</h1>
        {description && <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
