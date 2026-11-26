export const SENTIMENT_LABEL: Record<string, string> = {
  positive: "Positive", negative: "Negative", neutral: "Neutral", mixed: "Mixed",
};

/** CSS colour for a sentiment, read from the theme tokens (works in charts and inline styles). */
export const sentimentColor = (s: string | null | undefined, alpha = 1) => {
  const v = { positive: "--pos", negative: "--neg", neutral: "--neu", mixed: "--mix" }[s ?? "neutral"] ?? "--neu";
  return `rgb(var(${v}) / ${alpha})`;
};

export const pct = (x: number | null | undefined, digits = 0) =>
  x === null || x === undefined || Number.isNaN(x) ? "–" : `${(x * 100).toFixed(digits)}%`;

export const num = (x: number | null | undefined, digits = 0) =>
  x === null || x === undefined || Number.isNaN(x) ? "–"
    : x.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });

export const f4 = (x: number | null | undefined) => (x === null || x === undefined ? "–" : x.toFixed(4));

export const date = (s: string | null | undefined, withTime = false) => {
  if (!s) return "–";
  return new Date(s).toLocaleDateString(undefined, {
    day: "numeric", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
};

export const SOURCE_LABEL: Record<string, string> = {
  dataset: "Dataset (test split)", manual: "Typed", voice: "Voice", batch: "Batch upload",
};

export const MODEL_LABEL: Record<string, string> = {
  logistic_regression: "Logistic Regression", linear_svm: "Linear SVM",
};

export const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};
