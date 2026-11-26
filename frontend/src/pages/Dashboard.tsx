import { Inbox } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AspectSentimentBars, HBar, Heatmap, SentimentDonut, useChartColors } from "../charts";
import { EmptyState, ErrorNotice, PageHeader, Panel, SentimentBadge, Skeleton } from "../components/ui";
import { num, SOURCE_LABEL } from "../lib/format";
import { api, errorMessage } from "../services/api";
import type { Dashboard, FilterOptions } from "../services/types";

function Kpi({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="panel px-5 py-4">
      <p className="text-[13px] text-ink-3">{label}</p>
      <p className="num mt-1 text-[26px] font-semibold leading-tight">{value}</p>
      {note && <p className="mt-1 text-[12.5px] text-ink-3">{note}</p>}
    </div>
  );
}

export function DashboardPage() {
  const c = useChartColors();
  const [data, setData] = useState<Dashboard | null>(null);
  const [opts, setOpts] = useState<FilterOptions | null>(null);
  const [source, setSource] = useState("");
  const [hotel, setHotel] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setError("");
    api.dashboard({ source, hotel }).then(setData).catch((e) => setError(errorMessage(e)));
  }, [source, hotel]);
  useEffect(load, [load]);
  useEffect(() => { api.filters().then(setOpts).catch(() => undefined); }, []);

  const counts = Object.fromEntries((data?.sentiment_distribution ?? []).map((d) => [d.sentiment, d.count]));
  const worst = data?.pain_points[0];

  return (
    <>
      <PageHeader title="Voice of Customer dashboard"
        description="What guests talk about most, and which hotel services draw the most negative feedback, across every review stored in the database."
        actions={(
          <div className="flex flex-wrap gap-2">
            <select className="field !w-auto" value={source} onChange={(e) => setSource(e.target.value)} aria-label="Source">
              <option value="">All sources</option>
              {(opts?.sources ?? []).map((s) => <option key={s} value={s}>{SOURCE_LABEL[s] ?? s}</option>)}
            </select>
            {!!opts?.hotels.length && (
              <select className="field !w-auto" value={hotel} onChange={(e) => setHotel(e.target.value)} aria-label="Hotel">
                <option value="">All hotels</option>
                {opts.hotels.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            )}
          </div>
        )} />
      {error && <div className="mb-4"><ErrorNotice message={error} onRetry={load} /></div>}
      {!data ? (
        <div className="grid gap-4 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : data.total_reviews === 0 ? (
        <Panel><EmptyState icon={<Inbox className="h-5 w-5" />} title="No reviews match these filters"
          action={<Link to="/analyze" className="font-medium text-brand hover:underline">Analyse a review</Link>}>
          Add reviews by typing, speaking or uploading a CSV.</EmptyState></Panel>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Reviews analysed" value={num(data.total_reviews)} note={Object.entries(data.sources).map(([k, v]) => `${num(v)} ${(SOURCE_LABEL[k] ?? k).toLowerCase()}`).join(" · ")} />
            <Kpi label="Aspect mentions" value={num(data.total_aspect_mentions)} note={`${num(data.total_aspect_mentions / data.total_reviews, 2)} per review · ${num(data.no_aspect_reviews)} with none`} />
            <Kpi label="Biggest pain point" value={worst ? worst.aspect : "–"} note={worst ? `${worst.negative_rate}% negative across ${num(worst.total)} mentions` : "Not enough data"} />
            {data.gold_accuracy !== null ? (
              <Kpi label="Accuracy on labelled test reviews" value={`${data.gold_accuracy}%`} note={`Logistic Regression vs gold labels, ${num(data.gold_count)} held-out sentences`} />
            ) : (
              <Kpi label="LR and SVM agree" value={data.model_agreement === null ? "–" : `${data.model_agreement}%`} note="Share of reviews where both models give the same sentiment" />
            )}
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <Panel title="Sentiment distribution" description="Sentence-level sentiment predicted by Logistic Regression">
              <SentimentDonut counts={counts} unit="reviews" />
            </Panel>
            <Panel title="Most discussed aspects" description="Share of reviews that mention each aspect">
              <HBar data={data.aspect_frequency.slice(0, 8).map((f) => ({ name: f.aspect, value: f.count, note: `${f.percent}% of reviews` }))} valueLabel="Reviews" />
            </Panel>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Panel title="Highest negative sentiment rate" description={`NR = negative mentions ÷ all mentions of the aspect (aspects with at least ${data.min_support} mentions)`}>
              <HBar color={c.negative} suffix="%" valueLabel="Negative rate"
                data={data.pain_points.map((p) => ({ name: p.aspect, value: p.negative_rate, note: `${num(p.negative)} of ${num(p.total)} mentions` }))} />
              <p className="mt-2 text-[12.5px] text-ink-3">These are the services to fix first.</p>
            </Panel>
            <Panel title="Sentiment within each aspect" description="Ordered by number of mentions">
              <AspectSentimentBars rows={data.negative_rates} limit={10} />
            </Panel>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            {data.correlation && (
              <Panel title="Which aspects are mentioned together" description="Pearson (phi) correlation of the eight most frequent predicted aspects">
                <Heatmap corr={data.correlation} compact />
              </Panel>
            )}
            <Panel title="Latest reviews" actions={<Link to="/reviews" className="text-[13px] font-medium text-brand hover:underline">Open database</Link>}>
              <ul className="divide-y divide-line">
                {data.recent.map((r) => (
                  <li key={r.id} className="py-3">
                    <p className="line-clamp-2 text-[14px] text-ink">{r.text}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <SentimentBadge label={r.sentiment} size="sm" />
                      {r.aspects.map((a) => <span key={a.aspect} className="text-[12px] text-ink-3">{a.aspect}</span>)}
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          {data.hotels.length > 1 && (
            <Panel title="Sentiment by hotel">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-line text-left text-[12.5px] text-ink-3">
                    <th className="py-2 font-medium">Hotel</th><th className="py-2 text-right font-medium">Reviews</th>
                    <th className="py-2 pl-6 font-medium">Positive / neutral / negative</th></tr></thead>
                  <tbody>
                    {data.hotels.map((h) => (
                      <tr key={h.hotel} className="border-b border-line/60">
                        <td className="py-2">{h.hotel}</td>
                        <td className="num py-2 text-right">{num(h.total)}</td>
                        <td className="py-2 pl-6">
                          <div className="flex h-2.5 w-full max-w-[320px] overflow-hidden rounded-full" title={`${h.positive} positive, ${h.neutral} neutral, ${h.negative} negative`}>
                            <span style={{ width: `${(100 * h.positive) / h.total}%`, background: c.positive }} />
                            <span style={{ width: `${(100 * h.neutral) / h.total}%`, background: c.neutral }} />
                            <span style={{ width: `${(100 * h.negative) / h.total}%`, background: c.negative }} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </div>
      )}
    </>
  );
}
