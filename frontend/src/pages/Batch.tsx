import { FileUp } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, ErrorNotice, PageHeader, Panel, SentimentBadge, Toggle } from "../components/ui";
import { num } from "../lib/format";
import { api, errorMessage } from "../services/api";
import type { BatchResult } from "../services/types";

const TEMPLATE = "review,hotel\nThe staff were extremely helpful at check in,Hotel Aurora\nThe room was tiny and the air conditioning was loud,Hotel Aurora\nGreat breakfast and a lovely view from the terrace,Seaside Inn\n";

export function BatchPage() {
  const [file, setFile] = useState<File | null>(null);
  const [clause, setClause] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [res, setRes] = useState<BatchResult | null>(null);

  const submit = async () => {
    if (!file) return;
    setBusy(true); setError(""); setRes(null);
    try { setRes(await api.batch(file, clause)); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Batch upload" description="Analyse many reviews at once. Upload a CSV, Excel or TXT file with one review per row; a column named review or text is used if present, and an optional hotel column groups the results. Up to 2,000 rows per file." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Panel title="Upload file">
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-panel border border-dashed border-line px-6 py-10 text-center hover:border-brand">
            <FileUp className="h-7 w-7 text-ink-3" aria-hidden />
            <span className="font-medium">{file ? file.name : "Choose a .csv, .xlsx or .txt file"}</span>
            <span className="text-[12.5px] text-ink-3">{file ? `${num(file.size / 1024, 1)} KB` : "Maximum 15 MB"}</span>
            <input type="file" accept=".csv,.tsv,.xlsx,.xls,.txt" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <div className="mt-4 space-y-4">
            <Toggle checked={clause} onChange={setClause} label="Clause mode for mixed sentences" />
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={submit} loading={busy} disabled={!file}>Analyse file</Button>
              <Button variant="ghost" onClick={() => {
                const url = URL.createObjectURL(new Blob([TEMPLATE], { type: "text/csv" }));
                const a = document.createElement("a"); a.href = url; a.download = "reviews_template.csv"; a.click();
              }}>Download template</Button>
            </div>
            {error && <ErrorNotice message={error} />}
          </div>
        </Panel>
        <Panel title="Results" description={res ? `${num(res.processed)} reviews analysed from column “${res.text_column}” and saved to the database` : "Results appear here after upload."}>
          {res && (
            <>
              <div className="mb-4 flex flex-wrap gap-2">
                {Object.entries(res.sentiment_counts).map(([s, n]) => (
                  <span key={s} className="flex items-center gap-2 text-sm"><SentimentBadge label={s} /> <span className="num">{num(n)}</span></span>
                ))}
                <Link to="/" className="ml-auto text-[13px] font-medium text-brand hover:underline">See them on the dashboard</Link>
              </div>
              <div className="max-h-[560px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-surface"><tr className="border-b border-line text-left text-[12.5px] text-ink-3">
                    <th className="py-2 font-medium">Review</th><th className="py-2 font-medium">Sentiment</th><th className="py-2 font-medium">Aspects</th></tr></thead>
                  <tbody>
                    {res.items.map((r) => (
                      <tr key={r.id} className="border-b border-line/60 align-top">
                        <td className="py-2 pr-3">{r.text}{r.hotel && <span className="block text-[12px] text-ink-3">{r.hotel}</span>}</td>
                        <td className="py-2 pr-3"><SentimentBadge label={r.sentiment} size="sm" /></td>
                        <td className="py-2 text-[12.5px] text-ink-2">{r.aspects.map((a) => a.aspect).join(", ") || "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {res.processed > res.items.length && <p className="mt-2 text-[12.5px] text-ink-3">Showing the first {res.items.length}; all {num(res.processed)} are in the review database.</p>}
              </div>
            </>
          )}
        </Panel>
      </div>
    </>
  );
}
