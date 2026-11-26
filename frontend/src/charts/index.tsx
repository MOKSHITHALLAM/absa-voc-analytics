import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useTheme } from "../context/AppProviders";
import { capitalize, num, pct } from "../lib/format";
import type { Corr, NegRate } from "../services/types";

/** Resolve theme tokens to concrete colours (SVG attributes cannot use CSS var()). */
export function useChartColors() {
  const { theme } = useTheme();
  return useMemo(() => {
    const cs = getComputedStyle(document.documentElement);
    const v = (name: string) => `rgb(${(cs.getPropertyValue(name) || "128 128 128").trim().split(/\s+/).join(",")})`;
    return {
      positive: v("--pos"), negative: v("--neg"), neutral: v("--neu"), mixed: v("--mix"), brand: v("--brand"),
      warn: v("--warn"), ink: v("--ink"), ink2: v("--ink-2"), ink3: v("--ink-3"), line: v("--line"),
      surface: v("--surface"), raised: v("--raised"), theme,
    };
  }, [theme]);
}

const SENTIMENT_KEYS = ["positive", "negative", "neutral"] as const;

function TooltipBox({ title, rows }: { title?: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="rounded-control border border-line bg-surface px-3 py-2 text-xs shadow-pop">
      {title && <p className="mb-1 font-semibold text-ink">{title}</p>}
      {rows.map((r) => (
        <p key={r.label} className="flex items-center justify-between gap-4 text-ink-2">
          <span className="flex items-center gap-1.5">{r.color && <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />}{r.label}</span>
          <span className="num font-medium text-ink">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

function axisProps(c: ReturnType<typeof useChartColors>) {
  return { stroke: c.line, tick: { fill: c.ink3, fontSize: 11.5 }, tickLine: false, axisLine: false };
}

/* ------------------------------------------------------------------ donut */
export function SentimentDonut({ counts, unit = "sentences" }: { counts: Record<string, number>; unit?: string }) {
  const c = useChartColors();
  const data = SENTIMENT_KEYS.map((k) => ({ key: k, name: capitalize(k), value: counts[k] ?? 0 })).filter((d) => d.value > 0);
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div className="relative h-[180px] w-[180px] shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={84} paddingAngle={2}
              stroke={c.surface} strokeWidth={2} startAngle={90} endAngle={-270} isAnimationActive={false}>
              {data.map((d) => <Cell key={d.key} fill={c[d.key]} />)}
            </Pie>
            <Tooltip content={({ active, payload }) => active && payload?.length ? (
              <TooltipBox rows={[{ label: String(payload[0].name), value: `${num(Number(payload[0].value))} (${pct(Number(payload[0].value) / total, 1)})`, color: c[(payload[0].payload as { key: "positive" }).key] }]} />
            ) : null} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div><p className="num text-2xl font-semibold">{num(total)}</p><p className="text-[11px] text-ink-3">{unit}</p></div>
        </div>
      </div>
      <ul className="w-full space-y-2 text-sm">
        {SENTIMENT_KEYS.map((k) => (
          <li key={k} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 whitespace-nowrap text-ink-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c[k] }} />{capitalize(k)}</span>
            <span className="num whitespace-nowrap text-ink">{num(counts[k] ?? 0)} <span className="text-ink-3">{total ? pct((counts[k] ?? 0) / total, 1) : "–"}</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ horizontal bars */
export function HBar({ data, valueLabel = "Sentences", height, color, suffix = "", yWidth = 150 }: {
  data: { name: string; value: number; note?: string }[]; valueLabel?: string; height?: number; color?: string; suffix?: string; yWidth?: number;
}) {
  const c = useChartColors();
  const fill = color ?? c.brand;
  return (
    <ResponsiveContainer width="100%" height={height ?? Math.max(150, data.length * 30 + 20)}>
      <BarChart data={data} layout="vertical" barCategoryGap={7} margin={{ top: 0, right: 56, left: 0, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" width={yWidth} {...axisProps(c)} tick={{ fill: c.ink2, fontSize: 12 }} />
        <Tooltip cursor={{ fill: c.raised, opacity: 0.6 }} content={({ active, payload, label }) => active && payload?.length ? (
          <TooltipBox title={String(label)} rows={[
            { label: valueLabel, value: `${num(Number(payload[0].value), suffix ? 1 : 0)}${suffix}`, color: fill },
            ...((payload[0].payload as { note?: string }).note ? [{ label: "Based on", value: String((payload[0].payload as { note?: string }).note) }] : []),
          ]} />
        ) : null} />
        <Bar dataKey="value" fill={fill} radius={[0, 4, 4, 0]} isAnimationActive={false}
          label={{ position: "right", fill: c.ink2, fontSize: 11.5, formatter: (v: number) => (v ? `${num(v, suffix ? 1 : 0)}${suffix}` : "") }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ aspect sentiment split (100% stacked) */
export function AspectSentimentBars({ rows, limit = 12 }: { rows: NegRate[]; limit?: number }) {
  const c = useChartColors();
  const data = rows.slice(0, limit).map((r) => ({
    name: r.aspect, total: r.total,
    positive: r.positive / r.total, neutral: r.neutral / r.total, negative: r.negative / r.total,
  }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 30 + 40)}>
      <BarChart data={data} layout="vertical" barCategoryGap={7} margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
        <XAxis type="number" domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} {...axisProps(c)} />
        <YAxis type="category" dataKey="name" width={150} {...axisProps(c)} tick={{ fill: c.ink2, fontSize: 12 }} />
        <Tooltip cursor={{ fill: c.raised, opacity: 0.6 }} content={({ active, payload, label }) => active && payload?.length ? (
          <TooltipBox title={`${label} · ${num((payload[0].payload as { total: number }).total)} mentions`}
            rows={payload.map((p) => ({ label: String(p.name), value: pct(Number(p.value), 1), color: String(p.color) }))} />
        ) : null} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: c.ink2 }} />
        <Bar dataKey="positive" name="Positive" stackId="s" fill={c.positive} stroke={c.surface} strokeWidth={2} isAnimationActive={false} />
        <Bar dataKey="neutral" name="Neutral" stackId="s" fill={c.neutral} stroke={c.surface} strokeWidth={2} isAnimationActive={false} />
        <Bar dataKey="negative" name="Negative" stackId="s" fill={c.negative} stroke={c.surface} strokeWidth={2} radius={[0, 4, 4, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ grouped comparison */
export function GroupedBars({ data, series, height = 260 }: {
  data: Record<string, string | number>[]; series: { key: string; name: string; color: string }[]; height?: number;
}) {
  const c = useChartColors();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 12, right: 8, left: -10, bottom: 0 }} barCategoryGap="24%" barGap={2}>
        <CartesianGrid stroke={c.line} vertical={false} strokeOpacity={0.6} />
        <XAxis dataKey="name" {...axisProps(c)} interval={0} tick={{ fill: c.ink2, fontSize: 11.5 }} />
        <YAxis {...axisProps(c)} domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
        <Tooltip cursor={{ fill: c.raised, opacity: 0.6 }} content={({ active, payload, label }) => active && payload?.length ? (
          <TooltipBox title={String(label)} rows={payload.map((p) => ({ label: String(p.name), value: Number(p.value).toFixed(4), color: String(p.color) }))} />
        ) : null} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: c.ink2 }} />
        {series.map((s) => <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} isAnimationActive={false} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ correlation heatmap (HTML grid) */
export function Heatmap({ corr, compact = false }: { corr: Corr; compact?: boolean }) {
  const c = useChartColors();
  const [hover, setHover] = useState<{ i: number; j: number } | null>(null);
  const n = corr.aspects.length;
  const rot = compact || n > 10;
  const cell = n > 10 ? 30 : compact ? 46 : 64;
  const color = (v: number | null) => {
    if (v === null) return c.raised;
    const base = v >= 0 ? c.negative : c.brand;
    const a = Math.min(1, Math.abs(v));
    return base.replace("rgb(", "rgba(").replace(")", `,${(0.08 + a * 0.85).toFixed(3)})`);
  };
  const short = (s: string) => (rot ? (s.length > 14 ? s.slice(0, 13) + "…" : s) : s);
  const hv = hover ? corr.matrix[hover.i][hover.j] : null;
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="border-separate" style={{ borderSpacing: 2 }} onMouseLeave={() => setHover(null)}>
          <thead>
            <tr>
              <th />
              {corr.aspects.map((a, j) => (
                <th key={a} className="align-bottom text-[11px] font-medium text-ink-3" style={{ height: rot ? 110 : 36 }}>
                  <div className={rot ? "w-[30px] origin-bottom-left translate-x-[18px] -rotate-[55deg] whitespace-nowrap text-left" : "px-1"}
                    style={{ color: hover?.j === j ? c.ink : undefined }}>{short(a)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {corr.matrix.map((row, i) => (
              <tr key={corr.aspects[i]}>
                <th className="whitespace-nowrap pr-2 text-right text-[12px] font-medium text-ink-2" style={{ color: hover?.i === i ? c.ink : undefined }}>
                  {short(corr.aspects[i])}
                </th>
                {row.map((v, j) => (
                  <td key={j} onMouseEnter={() => setHover({ i, j })}
                    className="num rounded-[4px] text-center text-[11px] transition-[outline] hover:outline hover:outline-2 hover:outline-ink"
                    style={{ width: cell, minWidth: cell, maxWidth: cell, height: n > 10 ? 26 : compact ? 34 : 44, background: color(v), color: v !== null && Math.abs(v) > 0.55 ? "#fff" : c.ink }}
                    aria-label={`${corr.aspects[i]} and ${corr.aspects[j]}: ${v === null ? "not defined" : v.toFixed(3)}`}>
                    {n <= 10 ? (v === null ? "–" : v.toFixed(2)) : ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-3">
        <span className="flex items-center gap-2">
          <span>−1</span>
          <span className="h-2.5 w-40 rounded-full" style={{ background: `linear-gradient(90deg, ${c.brand}, ${c.raised}, ${c.negative})` }} />
          <span>+1</span>
          <span className="ml-1">Pearson (phi) r</span>
        </span>
        <span className="min-h-[1.25rem] text-ink-2">
          {hover ? <>{corr.aspects[hover.i]} × {corr.aspects[hover.j]}: <b className="num text-ink">{hv === null ? "not defined" : hv.toFixed(3)}</b></> : "Hover a cell for the exact value"}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ confusion matrix */
export function ConfusionGrid({ labels, matrix }: { labels: string[]; matrix: number[][] }) {
  const c = useChartColors();
  const max = Math.max(...matrix.flat(), 1);
  return (
    <div className="overflow-x-auto">
      <table className="border-separate text-sm" style={{ borderSpacing: 3 }}>
        <thead>
          <tr>
            <th className="text-left text-[11px] font-normal text-ink-3">Actual ↓ / Predicted →</th>
            {labels.map((l) => <th key={l} className="px-2 text-xs font-medium text-ink-2">{capitalize(l)}</th>)}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => {
            const rowTotal = row.reduce((s, v) => s + v, 0) || 1;
            return (
              <tr key={labels[i]}>
                <th className="pr-2 text-right text-xs font-medium text-ink-2">{capitalize(labels[i])}</th>
                {row.map((v, j) => (
                  <td key={j} title={`${pct(v / rowTotal, 1)} of actual ${labels[i]}`}
                    className="num min-w-[76px] rounded-[6px] px-3 py-2.5 text-center"
                    style={{
                      background: (i === j ? c.positive : c.negative).replace("rgb(", "rgba(").replace(")", `,${(0.06 + 0.8 * v / max).toFixed(3)})`),
                      color: v / max > 0.55 ? "#fff" : c.ink,
                    }}>
                    <span className="block font-semibold">{num(v)}</span>
                    <span className="block text-[10.5px] opacity-80">{pct(v / rowTotal, 1)}</span>
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
