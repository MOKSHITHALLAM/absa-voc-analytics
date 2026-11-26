/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Hanken Grotesk Variable"', "system-ui", "sans-serif"],
        voice: ['"Newsreader Variable"', "Georgia", "serif"],
      },
      colors: {
        canvas: "rgb(var(--canvas) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        raised: "rgb(var(--raised) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        "ink-2": "rgb(var(--ink-2) / <alpha-value>)",
        "ink-3": "rgb(var(--ink-3) / <alpha-value>)",
        brand: "rgb(var(--brand) / <alpha-value>)",
        "brand-ink": "rgb(var(--brand-ink) / <alpha-value>)",
        pos: "rgb(var(--pos) / <alpha-value>)",
        neg: "rgb(var(--neg) / <alpha-value>)",
        mix: "rgb(var(--mix) / <alpha-value>)",
        neu: "rgb(var(--neu) / <alpha-value>)",
        warn: "rgb(var(--warn) / <alpha-value>)",
      },
      borderRadius: { panel: "14px", control: "8px" },
      opacity: { 8: "0.08", 12: "0.12", 14: "0.14", 35: "0.35", 45: "0.45", 55: "0.55", 65: "0.65" },
      boxShadow: {
        panel: "0 1px 0 rgb(var(--line) / 0.6), 0 8px 24px -16px rgb(0 0 0 / 0.35)",
        pop: "0 18px 50px -12px rgb(0 0 0 / 0.45)",
      },
    },
  },
  plugins: [],
};
