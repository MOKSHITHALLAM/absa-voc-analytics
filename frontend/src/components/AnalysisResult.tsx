import { Info } from "lucide-react";
import { capitalize, pct, sentimentColor } from "../lib/format";
import type { Analysis } from "../services/types";
import { Chip, SentimentBadge } from "./ui";

/** Probability bar for one aspect, with the 0.50 decision threshold marked. */
function AspectScore({ aspect, p, threshold }: { aspect: string; p: number; threshold: number }) {
  const on = p >= threshold;
  return (
    <li className="grid grid-cols-[150px_1fr_52px] items-center gap-3 text-[13px]">
      <span className={on ? "font-medium text-ink" : "text-ink-3"}>{aspect}</span>
      <span className="relative h-2 rounded-full bg-raised">
        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${p * 100}%`, background: on ? "rgb(var(--brand))" : "rgb(var(--ink-3) / 0.45)" }} />
        <span className="absolute -top-1 bottom-[-4px] w-px bg-ink-3" style={{ left: `${threshold * 100}%` }} aria-hidden />
      </span>
      <span className="num text-right text-ink-2">{p.toFixed(2)}</span>
    </li>
  );
}

export function AnalysisResult({ result }: { result: Analysis }) {
  const sentiments = ["positive", "negative", "neutral"].filter((s) => s in result.probabilities);
  return (
    <div className="space-y-5">
      {result.transcription && (
        <div className="rounded-control border border-line bg-raised/50 px-4 py-3 text-[13px] text-ink-2">
          Transcribed {result.transcription.duration}s of audio · detected language {result.transcription.language.toUpperCase()}
          {result.transcription.language !== "en" && " (translated to English)"}
        </div>
      )}
      <blockquote className="voice border-l-[3px] pl-4" style={{ borderColor: sentimentColor(result.sentiment) }}>
        “{result.text}”
      </blockquote>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-panel border border-line p-4">
          <p className="label">Sentence sentiment</p>
          <div className="flex flex-wrap items-center gap-3">
            <SentimentBadge label={result.sentiment} />
            <span className="num text-sm text-ink-2">Logistic Regression · {pct(result.confidence, 1)} confidence</span>
          </div>
          <ul className="mt-3 space-y-1.5">
            {sentiments.map((s) => (
              <li key={s} className="grid grid-cols-[72px_1fr_48px] items-center gap-2 text-[12.5px]">
                <span className="text-ink-2">{capitalize(s)}</span>
                <span className="h-1.5 rounded-full bg-raised">
                  <span className="block h-full rounded-full" style={{ width: `${result.probabilities[s] * 100}%`, background: sentimentColor(s) }} />
                </span>
                <span className="num text-right text-ink-3">{pct(result.probabilities[s])}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12.5px] text-ink-3">
            Linear SVM says <b className="text-ink-2">{result.svm_sentiment}</b>
            {result.models_agree ? " — both models agree." : " — the two models disagree, so treat this one with care."}
          </p>
        </div>

        <div className="rounded-panel border border-line p-4">
          <p className="label">Detected aspects ({result.aspects.length})</p>
          {result.aspects.length ? (
            <ul className="flex flex-wrap gap-2">
              {result.aspects.map((a) => (
                <li key={a.aspect} className="inline-flex items-center gap-2 rounded-full py-1 pl-3 pr-2 text-[13px] font-medium"
                  style={{ background: sentimentColor(a.sentiment, 0.13), color: sentimentColor(a.sentiment) }}>
                  {a.aspect}
                  <span className="num rounded-full bg-surface/70 px-1.5 text-[11px] text-ink-2">{a.probability.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-3">No aspect passed the {result.threshold.toFixed(2)} threshold. The closest candidates are listed below.</p>
          )}
          {result.key_terms.length > 0 && (
            <>
              <p className="label mt-4">Words that drove the sentiment</p>
              <div className="flex flex-wrap gap-1.5">
                {result.key_terms.map((t) => <Chip key={t.term}>{t.term}</Chip>)}
              </div>
            </>
          )}
        </div>
      </div>

      {result.clauses.length > 1 && (
        <div className="rounded-panel border border-line p-4">
          <p className="label">Clause mode: each part of the sentence scored separately</p>
          <ul className="space-y-2">
            {result.clauses.map((c, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                <SentimentBadge label={c.sentiment} size="sm" />
                <span className="text-ink">“{c.text}”</span>
                {c.aspects.map((a) => <Chip key={a} tone="brand">{a}</Chip>)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-panel border border-line p-4">
        <p className="label">Aspect probabilities (One-vs-Rest Logistic Regression, top 6)</p>
        <ul className="space-y-2">
          {result.top_aspect_scores.map((s) => <AspectScore key={s.aspect} aspect={s.aspect} p={s.probability} threshold={result.threshold} />)}
        </ul>
        <p className="mt-3 flex items-center gap-1.5 text-[12px] text-ink-3"><Info className="h-3.5 w-3.5" aria-hidden />The vertical line marks the {result.threshold.toFixed(2)} decision threshold used in the paper.</p>
      </div>
      {result.low_coverage && (
        <p className="rounded-control bg-warn/12 px-3 py-2 text-[13px] text-warn">None of these words appear in the training vocabulary, so the prediction is unreliable.</p>
      )}
    </div>
  );
}
