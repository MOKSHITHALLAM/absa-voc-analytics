import { Check, Download, Search, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button, ConfirmDialog, EmptyState, ErrorNotice, Modal, PageHeader, Pagination, Panel, SentimentBadge, Spinner } from "../components/ui";
import { useAuth, useToast } from "../context/AppProviders";
import { date, pct, SOURCE_LABEL, sentimentColor } from "../lib/format";
import { api, downloadBlob, errorMessage } from "../services/api";
import type { FilterOptions, Page, ReviewItem } from "../services/types";

const SIZE = 15;

export function ReviewsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [opts, setOpts] = useState<FilterOptions | null>(null);
  const [f, setF] = useState({ q: "", sentiment: "", aspect: "", source: "", hotel: "" });
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<ReviewItem> | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<ReviewItem | null>(null);
  const [del, setDel] = useState<ReviewItem | null>(null);

  const load = useCallback(() => {
    setError("");
    api.reviews({ ...f, page, size: SIZE }).then(setData).catch((e) => setError(errorMessage(e)));
  }, [f, page]);
  useEffect(load, [load]);
  useEffect(() => { api.filters().then(setOpts).catch(() => undefined); }, []);
  useEffect(() => { const t = setTimeout(() => { setF((p) => ({ ...p, q })); setPage(1); }, 350); return () => clearTimeout(t); }, [q]);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => { setF((p) => ({ ...p, [k]: e.target.value })); setPage(1); };

  const showDetail = async (r: ReviewItem) => { setOpen(r); try { setOpen(await api.review(r.id)); } catch { /* keep summary */ } };

  return (
    <>
      <PageHeader title="Review database" description="Every analysed review stored in the database, with the predicted sentiment and aspects. Reviews imported from the dataset's held-out test split also show their gold labels, so you can see where the model is right or wrong."
        actions={<Button icon={<Download className="h-4 w-4" />} onClick={async () => {
          try { downloadBlob(await api.exportCsv(f.source || undefined), "voc_reviews.csv"); } catch (e) { toast.notify("error", errorMessage(e)); }
        }}>Export CSV</Button>} />
      <Panel>
        <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
            <input className="field !pl-9" placeholder="Search review text" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
          </label>
          <select className="field" value={f.sentiment} onChange={set("sentiment")} aria-label="Sentiment">
            <option value="">All sentiments</option><option value="positive">Positive</option><option value="negative">Negative</option><option value="neutral">Neutral</option>
          </select>
          <select className="field" value={f.aspect} onChange={set("aspect")} aria-label="Aspect">
            <option value="">All aspects</option>{opts?.aspects.map((a) => <option key={a}>{a}</option>)}
          </select>
          <select className="field" value={f.source} onChange={set("source")} aria-label="Source">
            <option value="">All sources</option>{opts?.sources.map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
          </select>
          <select className="field" value={f.hotel} onChange={set("hotel")} aria-label="Hotel">
            <option value="">All hotels</option>{opts?.hotels.map((h) => <option key={h}>{h}</option>)}
          </select>
        </div>
        {error && <ErrorNotice message={error} onRetry={load} />}
        {!data ? <Spinner /> : data.items.length === 0 ? <EmptyState title="No reviews match these filters" /> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-line text-left text-[12.5px] text-ink-3">
                  <th className="py-2 pr-2 font-medium">#</th><th className="py-2 font-medium">Review</th>
                  <th className="py-2 font-medium">Sentiment</th><th className="py-2 font-medium">Aspects</th>
                  <th className="py-2 font-medium">Gold label</th><th className="py-2 font-medium">Source</th><th /></tr></thead>
                <tbody>
                  {data.items.map((r) => (
                    <tr key={r.id} className="cursor-pointer border-b border-line/60 align-top hover:bg-raised/50" onClick={() => showDetail(r)}>
                      <td className="num py-2.5 pr-2 text-ink-3">{r.id}</td>
                      <td className="max-w-[420px] py-2.5 pr-3"><span className="line-clamp-2">{r.text}</span>{r.hotel && <span className="text-[12px] text-ink-3">{r.hotel}</span>}</td>
                      <td className="py-2.5 pr-3"><SentimentBadge label={r.sentiment} size="sm" /></td>
                      <td className="py-2.5 pr-3 text-[12.5px]">
                        {r.aspects.length ? r.aspects.map((a) => <span key={a.aspect} className="mr-1.5 inline-block" style={{ color: sentimentColor(a.sentiment) }}>{a.aspect}</span>) : <span className="text-ink-3">–</span>}
                      </td>
                      <td className="py-2.5 pr-3 text-[12.5px]">
                        {r.true_sentiment ? (
                          <span className="inline-flex items-center gap-1" title={`Gold aspects: ${r.true_aspects.join(", ")}`}>
                            {r.true_sentiment === r.sentiment ? <Check className="h-3.5 w-3.5 text-pos" aria-label="matches" /> : <X className="h-3.5 w-3.5 text-neg" aria-label="differs" />}
                            {r.true_sentiment}
                          </span>
                        ) : <span className="text-ink-3">–</span>}
                      </td>
                      <td className="whitespace-nowrap py-2.5 pr-3 text-[12.5px] text-ink-2">{SOURCE_LABEL[r.source] ?? r.source}</td>
                      <td className="py-2.5">
                        {(user?.role === "admin" || r.user === user?.name) && (
                          <button className="rounded-control p-1.5 text-ink-3 hover:bg-raised hover:text-neg" aria-label={`Delete review ${r.id}`}
                            onClick={(e) => { e.stopPropagation(); setDel(r); }}><Trash2 className="h-4 w-4" /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4"><Pagination page={page} pages={Math.max(1, Math.ceil(data.total / SIZE))} total={data.total} pageSize={SIZE} onPage={setPage} /></div>
          </>
        )}
      </Panel>

      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? `Review #${open.id}` : ""} width="max-w-2xl">
        {open && (
          <div className="space-y-4 text-sm">
            <p className="voice">“{open.text}”</p>
            <dl className="grid grid-cols-[150px_1fr] gap-x-4 gap-y-2">
              <dt className="text-ink-3">Logistic Regression</dt><dd className="flex items-center gap-2"><SentimentBadge label={open.sentiment} size="sm" /> <span className="num text-ink-2">{pct(open.confidence, 1)}</span></dd>
              <dt className="text-ink-3">Linear SVM</dt><dd><SentimentBadge label={open.svm_sentiment} size="sm" /></dd>
              {open.true_sentiment && (<><dt className="text-ink-3">Gold sentiment</dt><dd><SentimentBadge label={open.true_sentiment} size="sm" /></dd>
                <dt className="text-ink-3">Gold aspects</dt><dd>{open.true_aspects.join(", ") || "–"}</dd></>)}
              <dt className="text-ink-3">Predicted aspects</dt>
              <dd>{open.aspects.map((a) => `${a.aspect} (${a.probability.toFixed(2)}, ${a.sentiment})`).join(", ") || "None above threshold"}</dd>
              {open.clean_text !== undefined && (<><dt className="text-ink-3">Preprocessed text</dt><dd className="font-mono text-[12.5px] text-ink-2">{open.clean_text}</dd></>)}
              {!!open.key_terms?.length && (<><dt className="text-ink-3">Key terms</dt><dd>{open.key_terms.map((t) => t.term).join(", ")}</dd></>)}
              <dt className="text-ink-3">Source</dt><dd>{SOURCE_LABEL[open.source]}{open.hotel ? ` · ${open.hotel}` : ""}{open.user ? ` · added by ${open.user}` : ""}</dd>
              <dt className="text-ink-3">Stored</dt><dd>{date(open.created_at, true)}</dd>
            </dl>
          </div>
        )}
      </Modal>
      <ConfirmDialog open={!!del} title="Delete this review?" message="It will be removed from the database and the dashboard." confirmLabel="Delete"
        onCancel={() => setDel(null)} onConfirm={async () => {
          if (!del) return;
          try { await api.deleteReview(del.id); toast.notify("success", `Review #${del.id} deleted`); load(); } catch (e) { toast.notify("error", errorMessage(e)); }
          setDel(null);
        }} />
    </>
  );
}
