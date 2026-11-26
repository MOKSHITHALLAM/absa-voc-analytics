import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AnalysisResult } from "../components/AnalysisResult";
import { ThemeProvider } from "../context/AppProviders";
import { f4, pct } from "../lib/format";
import type { Analysis } from "../services/types";

const result: Analysis = {
  text: "The staff were lovely but the wifi was awful", clean_text: "staff lovely wifi awful", sentiment: "negative",
  confidence: 0.71, probabilities: { negative: 0.71, positive: 0.25, neutral: 0.04 }, svm_sentiment: "negative", models_agree: true,
  aspects: [{ aspect: "Wi-Fi", probability: 0.93, sentiment: "negative", source: "clause" }, { aspect: "Staff", probability: 0.88, sentiment: "positive", source: "clause" }],
  top_aspect_scores: [{ aspect: "Wi-Fi", probability: 0.93 }, { aspect: "Staff", probability: 0.88 }, { aspect: "Room", probability: 0.12 }],
  key_terms: [{ term: "awful", weight: 1.2 }], low_coverage: false,
  clauses: [{ text: "The staff were lovely", sentiment: "positive", confidence: 0.9, aspects: ["Staff"] }, { text: "the wifi was awful", sentiment: "negative", confidence: 0.9, aspects: ["Wi-Fi"] }],
  threshold: 0.5,
};

describe("format helpers", () => {
  it("formats numbers", () => {
    expect(pct(0.5)).toBe("50%");
    expect(f4(0.84531)).toBe("0.8453");
    expect(f4(null)).toBe("–");
  });
});

describe("AnalysisResult", () => {
  it("shows aspects, both models and clauses", () => {
    render(<MemoryRouter><ThemeProvider><AnalysisResult result={result} /></ThemeProvider></MemoryRouter>);
    expect(screen.getAllByText("Wi-Fi").length).toBeGreaterThan(0);
    expect(screen.getByText(/both models agree/)).toBeInTheDocument();
    expect(screen.getByText(/Clause mode/)).toBeInTheDocument();
    expect(screen.getByText("awful")).toBeInTheDocument();
  });
});
