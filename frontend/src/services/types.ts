export type Sentiment = "positive" | "negative" | "neutral";

export interface User { id: number; name: string; email: string; role: "admin" | "analyst" }
export interface TokenResponse { access_token: string; user: User }

export interface AspectHit { aspect: string; probability: number; sentiment: Sentiment; source: "sentence" | "clause" }

export interface Analysis {
  text: string;
  clean_text: string;
  sentiment: Sentiment;
  confidence: number;
  probabilities: Record<string, number>;
  svm_sentiment: Sentiment;
  models_agree: boolean;
  aspects: AspectHit[];
  top_aspect_scores: { aspect: string; probability: number }[];
  key_terms: { term: string; weight: number }[];
  low_coverage: boolean;
  clauses: { text: string; sentiment: Sentiment; confidence: number; aspects: string[] }[];
  threshold: number;
  review_id?: number;
  transcription?: { text: string; language: string; language_probability: number; duration: number };
}

export interface ReviewItem {
  id: number; text: string; source: string; hotel: string | null; sentiment: Sentiment; confidence: number;
  svm_sentiment: Sentiment; aspects: AspectHit[]; true_sentiment: Sentiment | null; true_aspects: string[];
  created_at: string; user: string | null;
  clean_text?: string; probabilities?: Record<string, number>; key_terms?: { term: string; weight: number }[];
  clause_mode?: boolean;
}
export interface Page<T> { total: number; page: number; size: number; items: T[] }

export interface Dist { sentiment: Sentiment; count: number; percent: number }
export interface Freq { aspect: string; count: number; percent: number }
export interface NegRate { aspect: string; total: number; negative: number; positive: number; neutral: number; negative_rate: number }
export interface Corr { aspects: string[]; matrix: (number | null)[][] }

export interface Dashboard {
  total_reviews: number; total_aspect_mentions: number; no_aspect_reviews: number;
  sentiment_distribution: Dist[]; aspect_frequency: Freq[]; negative_rates: NegRate[];
  pain_points: NegRate[]; strengths: NegRate[];
  hotels: { hotel: string; total: number; positive: number; negative: number; neutral: number }[];
  sources: Record<string, number>; model_agreement: number | null; gold_accuracy: number | null; gold_count: number;
  correlation: Corr | null; recent: ReviewItem[]; min_support: number;
}

export interface ModelMetrics { accuracy: number; macro_precision: number; macro_recall: number; macro_f1: number; weighted_f1: number }
export interface AspectMetrics {
  subset_accuracy: number; micro_precision: number; micro_recall: number; micro_f1: number; macro_f1: number;
  hamming_loss: number; per_aspect: { aspect: string; precision: number; recall: number; f1: number; support: number }[];
}

export interface Research {
  generated_at: string;
  dataset: {
    name: string; is_synthetic: boolean; file: string; raw: number; clean: number; train: number; test: number;
    hotels: number | null; aspects: number; aspects_modelled: number; cleaning: Record<string, number>;
    columns: Record<string, string | null>;
  };
  settings: Record<string, string | number>;
  sentiment_distribution: Dist[];
  aspect_model: AspectMetrics;
  sentiment_models: Record<"logistic_regression" | "linear_svm", ModelMetrics>;
  best_by_accuracy: string; best_by_macro_f1: string;
  classwise_lr: { class: string; precision: number; recall: number; f1: number; support: number }[];
  confusion: Record<string, { labels: string[]; matrix: number[][] }>;
  correlation_selected: Corr | null; correlation_full: Corr;
  top_correlated_pairs: { a: string; b: string; r: number }[];
  aspect_frequency: Freq[]; negative_rates: NegRate[];
  top_terms: Record<string, string[]>;
  paper_reported: {
    dataset: Record<string, number>; sentiment_distribution: Record<string, number>;
    aspect_model: Record<string, number>; sentiment_models: Record<string, Record<string, number>>;
  };
  training_seconds: number;
  runs: { id: number; dataset: string; is_synthetic: boolean; generated_at: string; summary: Record<string, unknown> }[];
}

export interface Health {
  status: string; database: string; reviews: number; speech_available: boolean;
  model: { dataset: string; is_synthetic: boolean; trained_at: string; aspects: string[]; threshold: number } | null;
}
export interface FilterOptions { hotels: string[]; aspects: string[]; sources: string[] }
export interface BatchResult { processed: number; text_column: string; sentiment_counts: Record<string, number>; items: ReviewItem[] }
