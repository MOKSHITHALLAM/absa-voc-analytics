import { AlertTriangle, ImageDown } from "lucide-react";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { ConfusionGrid, GroupedBars, HBar, Heatmap, SentimentDonut, useChartColors } from "../charts";
import { ErrorNotice, PageHeader, Panel, Skeleton, Tabs } from "../components/ui";
import { capitalize, date, f4, MODEL_LABEL, num } from "../lib/format";
import { api, errorMessage, figureUrl } from "../services/api";
import type { Research } from "../services/types";

function Table({ head, rows, align }: { head: ReactNode[]; rows: ReactNode[][]; align?: ("l" | "r")[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-line text-[12.5px] text-ink-3">
          {head.map((h, i) => <th key={i} className={`py-2 pr-3 font-medium ${align?.[i] === "l" || i === 0 ? "text-left" : "text-right"}`}>{h}</th>)}
        </tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={i} className="border-b border-line/60">
            {r.map((c, j) => <td key={j} className={`py-2 pr-3 ${align?.[j] === "l" || j === 0 ? "text-left" : "num text-right"}`}>{c}</td>)}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

const Paper = ({ v }: { v: ReactNode }) => <span className="text-ink-3">{v}</span>;

export function ResearchPage() {
  const c = useChartColors();
  const [r, setR] = useState<Research | null>(null);
  const [error, setError] = useState("");
  const [cm, setCm] = useState<"logistic_regression" | "linear_svm">("logistic_regression");
  const [corrView, setCorrView] = useState<"six" | "all">("six");
  useEffect(() => { api.research().then(setR).catch((e) => setError(errorMessage(e))); }, []);

  if (error) return <><PageHeader title="Research results" /><ErrorNotice message={error} /></>;
  if (!r) return <><PageHeader title="Research results" /><div className="grid gap-4 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-56" />)}</div></>;

  const P = r.paper_reported;
  const d = r.dataset;
  const am = r.aspect_model;
  const sm = r.sentiment_models;
  const counts = Object.fromEntries(r.sentiment_distribution.map((x) => [x.sentiment, x.count]));
  const corr = corrView === "six" && r.correlation_selected ? r.correlation_selected : r.correlation_full;

  return (
    <>
      <PageHeader title="Research results"
        description="Reproduction of the paper's experiment: TF-IDF features, One-vs-Rest Logistic Regression for multi-label aspects, Logistic Regression vs Linear SVM for sentiment, and Voice of Customer analytics. Values measured on this machine are shown next to the values reported in the paper."
        actions={<span className="text-[12.5px] text-ink-3">Trained {date(r.generated_at, true)} in {r.training_seconds}s</span>} />

      {d.is_synthetic && (
        <div role="alert" className="mb-6 flex gap-3 rounded-panel border border-warn/40 bg-warn/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warn" aria-hidden />
          <div className="space-y-1 text-ink">
            <p className="font-semibold">These numbers come from the synthetic demo sample, not from HRAST.</p>
            <p className="text-ink-2">The demo sentences are generated from templates, so the near-perfect scores mean nothing. Download the HRAST dataset from Kaggle,
              put the file in <code className="rounded bg-raised px-1">backend/data/raw/</code>, run <code className="rounded bg-raised px-1">python -m ml.train</code> and restart the backend. This page will then show the real results.</p>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title="Dataset and split" description={d.name}>
            <Table head={["", "This run", "Paper"]} rows={[
              ["Original records", num(d.raw), <Paper v={num(P.dataset.raw)} />],
              ["Records after preprocessing", num(d.clean), <Paper v={num(P.dataset.clean)} />],
              ["Training records (80%)", num(d.train), <Paper v={num(P.dataset.train)} />],
              ["Testing records (20%)", num(d.test), <Paper v={num(P.dataset.test)} />],
              ["Hotels", d.hotels ?? "–", <Paper v={P.dataset.hotels} />],
              ["Aspect categories", d.aspects, <Paper v={21} />],
            ]} />
            <p className="mt-3 text-[12.5px] text-ink-3">
              Removed during cleaning: {num(d.cleaning.dropped_missing)} empty, {num(d.cleaning.dropped_bad_sentiment)} invalid sentiment,
              {" "}{num(d.cleaning.dropped_no_aspect)} without an aspect, {num(d.cleaning.dropped_duplicates)} duplicates.
            </p>
          </Panel>
          <Panel title="Sentiment distribution" description="Cleaned dataset, all sentences">
            <SentimentDonut counts={counts} />
            <p className="mt-3 text-[12.5px] text-ink-3">Paper: {num(P.sentiment_distribution.positive)} positive, {num(P.sentiment_distribution.negative)} negative, {num(P.sentiment_distribution.neutral)} neutral. The small neutral class is why neutral F1 is low.</p>
          </Panel>
        </div>

        <Panel title="Multi-label aspect identification" description="One-vs-Rest Logistic Regression, decision threshold 0.50, test split">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <Table head={["Metric", "This run", "Paper"]} rows={[
              ["Subset accuracy", f4(am.subset_accuracy), <Paper v={f4(P.aspect_model.subset_accuracy)} />],
              ["Micro precision", f4(am.micro_precision), <Paper v={f4(P.aspect_model.micro_precision)} />],
              ["Micro recall", f4(am.micro_recall), <Paper v={f4(P.aspect_model.micro_recall)} />],
              ["Micro F1-score", f4(am.micro_f1), <Paper v={f4(P.aspect_model.micro_f1)} />],
              ["Macro F1-score", f4(am.macro_f1), <Paper v={f4(P.aspect_model.macro_f1)} />],
              ["Hamming loss", f4(am.hamming_loss), <Paper v={f4(P.aspect_model.hamming_loss)} />],
            ]} />
            <div>
              <p className="label">F1-score per aspect (test split)</p>
              <HBar data={[...am.per_aspect].sort((a, b) => b.f1 - a.f1).map((a) => ({ name: a.aspect, value: a.f1, note: `${a.support} test sentences` }))} valueLabel="F1" />
            </div>
          </div>
        </Panel>

        <Panel title="Sentiment classification: Logistic Regression vs Linear SVM" description="Three classes, same TF-IDF features, test split">
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="space-y-4">
              <Table head={["Model", "Accuracy", "Macro P", "Macro R", "Macro F1"]} rows={[
                ...(["logistic_regression", "linear_svm"] as const).map((m) => [
                  <b key={m}>{MODEL_LABEL[m]}</b>, f4(sm[m].accuracy), f4(sm[m].macro_precision), f4(sm[m].macro_recall), f4(sm[m].macro_f1)]),
                ...(["logistic_regression", "linear_svm"] as const).map((m) => [
                  <Paper key={m} v={`${MODEL_LABEL[m]} (paper)`} />, <Paper v={f4(P.sentiment_models[m].accuracy)} />, <Paper v={f4(P.sentiment_models[m].macro_precision)} />,
                  <Paper v={f4(P.sentiment_models[m].macro_recall)} />, <Paper v={f4(P.sentiment_models[m].macro_f1)} />]),
              ]} />
              <p className="text-[13px] text-ink-2">
                Highest accuracy in this run: <b>{MODEL_LABEL[r.best_by_accuracy]}</b>. Highest macro F1: <b>{MODEL_LABEL[r.best_by_macro_f1]}</b>.
                As in the paper, macro F1 is used to choose the model for class-wise analysis, because accuracy hides the weak neutral class.
              </p>
            </div>
            <GroupedBars height={250} series={[{ key: "lr", name: "Logistic Regression", color: c.brand }, { key: "svm", name: "Linear SVM", color: c.warn }]}
              data={(["accuracy", "macro_precision", "macro_recall", "macro_f1"] as const).map((k) => ({
                name: { accuracy: "Accuracy", macro_precision: "Macro precision", macro_recall: "Macro recall", macro_f1: "Macro F1" }[k],
                lr: sm.logistic_regression[k], svm: sm.linear_svm[k] }))} />
          </div>
        </Panel>

        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title="Class-wise performance of Logistic Regression">
            <Table head={["Class", "Precision", "Recall", "F1", "Support"]}
              rows={r.classwise_lr.map((x) => [capitalize(x.class), f4(x.precision), f4(x.recall), f4(x.f1), num(x.support)])} />
          </Panel>
          <Panel title="Confusion matrix" actions={<Tabs value={cm} onChange={setCm} items={[{ value: "logistic_regression", label: "LR" }, { value: "linear_svm", label: "SVM" }]} />}>
            <ConfusionGrid labels={r.confusion[cm].labels} matrix={r.confusion[cm].matrix} />
          </Panel>
        </div>

        <Panel title="Correlation between aspect indicators" description="Pearson correlation of the binary gold aspect labels (equal to the phi coefficient), whole cleaned dataset"
          actions={r.correlation_selected ? <Tabs value={corrView} onChange={setCorrView} items={[{ value: "six", label: "Paper's six aspects" }, { value: "all", label: `All ${r.correlation_full.aspects.length}` }]} /> : undefined}>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
            <Heatmap corr={corr} />
            <div>
              <p className="label">Strongest pairs</p>
              <ul className="space-y-1.5 text-sm">
                {r.top_correlated_pairs.map((p) => (
                  <li key={p.a + p.b} className="flex justify-between gap-3"><span className="text-ink-2">{p.a} × {p.b}</span><span className="num font-medium">{p.r.toFixed(3)}</span></li>
                ))}
              </ul>
              <p className="mt-3 text-[12.5px] text-ink-3">Positive values: the two aspects tend to appear in the same sentence. Negative: they rarely appear together.</p>
            </div>
          </div>
        </Panel>

        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title="Aspect frequency" description="Number of sentences mentioning each aspect (gold labels)">
            <HBar data={r.aspect_frequency.slice(0, 10).map((f) => ({ name: f.aspect, value: f.count, note: `${f.percent}% of sentences` }))} />
          </Panel>
          <Panel title="Aspect-wise negative sentiment rate" description="NR = negative sentences ÷ all sentences of the aspect">
            <HBar color={c.negative} suffix="%" valueLabel="Negative rate"
              data={r.negative_rates.slice(0, 10).map((n) => ({ name: n.aspect, value: n.negative_rate, note: `${num(n.negative)} of ${num(n.total)} sentences` }))} />
          </Panel>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title="Most influential words" description="Highest Logistic Regression weights per sentiment class">
            <div className="space-y-3">
              {Object.entries(r.top_terms).map(([cls, terms]) => (
                <div key={cls}>
                  <p className="mb-1 text-[13px] font-medium capitalize">{cls}</p>
                  <p className="text-[13px] leading-relaxed text-ink-2">{terms.join(" · ")}</p>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Experimental settings">
            <dl className="grid grid-cols-[130px_1fr] gap-x-4 gap-y-2 text-[13px]">
              {Object.entries(r.settings).map(([k, v]) => (<Fragment key={k}><dt className="capitalize text-ink-3">{k.replace(/_/g, " ")}</dt><dd className="text-ink-2">{String(v)}</dd></Fragment>))}
              <dt className="text-ink-3">Columns used</dt><dd className="text-ink-2">text = {d.columns.text}, sentiment = {d.columns.sentiment}, aspects = {d.columns.aspect_mode}{d.columns.hotel ? `, hotel = ${d.columns.hotel}` : ""}</dd>
            </dl>
          </Panel>
        </div>

        <Panel title="Figures for the report" description="PNG versions of the charts above, generated by the training script (backend/artifacts/figures)">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[["fig2_sentiment_distribution.png", "Fig. 2 Sentiment distribution"], ["fig3_correlation_selected.png", "Fig. 3 Correlation heatmap"],
              ["fig4_model_comparison.png", "Fig. 4 LR vs SVM"], ["fig5_aspect_frequency.png", "Fig. 5 Aspect frequency"],
              ["fig6_negative_rates.png", "Fig. 6 Negative rates"], ["fig3b_correlation_all_aspects.png", "All-aspect correlation"],
              ["confusion_logistic_regression.png", "Confusion matrix LR"], ["confusion_linear_svm.png", "Confusion matrix SVM"]].map(([file, label]) => (
              <a key={file} href={figureUrl(file)} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-control border border-line hover:border-brand">
                <img src={figureUrl(file)} alt={label} className="aspect-[4/3] w-full bg-white object-contain" />
                <span className="flex items-center gap-1.5 px-3 py-2 text-[12.5px] text-ink-2 group-hover:text-ink"><ImageDown className="h-3.5 w-3.5" aria-hidden />{label}</span>
              </a>
            ))}
          </div>
        </Panel>

        {r.runs.length > 0 && (
          <Panel title="Training runs recorded in the database">
            <Table head={["Trained", "Dataset", "Test sentences", "Aspect micro F1", "LR acc.", "SVM acc."]} align={["l", "l", "r", "r", "r", "r"]}
              rows={r.runs.map((x) => {
                const s = x.summary as { test: number; aspect_model: { micro_f1: number }; sentiment_models: Record<string, { accuracy: number }> };
                return [date(x.generated_at, true), `${x.dataset}${x.is_synthetic ? " (synthetic)" : ""}`, num(s.test), f4(s.aspect_model.micro_f1),
                  f4(s.sentiment_models.logistic_regression.accuracy), f4(s.sentiment_models.linear_svm.accuracy)];
              })} />
          </Panel>
        )}
      </div>
    </>
  );
}
