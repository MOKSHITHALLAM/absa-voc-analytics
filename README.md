# INSIGHTVOICE AI: Aspect-Based Sentiment and Voice of Customer Analytics

KL University B.Tech capstone project (Portal Use-Case ID DSCI-12, Team C2C-160).

This project implements the method of the team paper **"Aspect Based Sentiment and Voice of
Customer Analytics"** on the **HRAST** hotel-review dataset, and puts it inside a working web
application with login, a database, live/voice/batch analysis and a VoC dashboard.

> **Quick start:** see [RUN_COMMANDS.md](RUN_COMMANDS.md).

## What it does

| Paper step | Where it is implemented |
|---|---|
| Load HRAST, check missing values, invalid labels, duplicates | `backend/ml/data_loader.py` (auto-detects the column layout) |
| Lower-casing, punctuation removal, stop-words, lemmatisation | `backend/ml/preprocess.py` |
| 80/20 split (stratified by sentiment, random_state 42) | `backend/ml/train.py` |
| TF-IDF features (fitted on the training split only) | `backend/ml/train.py` |
| Multi-label aspects: One-vs-Rest Logistic Regression, threshold 0.50 | `backend/ml/train.py`, `backend/ml/predictor.py` |
| Sentiment: Logistic Regression vs Linear SVM | `backend/ml/train.py` |
| Accuracy, macro/micro P/R/F1, subset accuracy, Hamming loss, class-wise report, confusion matrices | `backend/ml/train.py` → `artifacts/results.json` |
| Pearson (phi) correlation, aspect frequency, negative rate NR_a | `backend/ml/analytics.py` |
| Figures 2–6 of the paper | `backend/ml/figures.py` → `artifacts/figures/` |

The web application adds:
- **Analyse a review:** type or **speak** a review (Whisper speech-to-text), and see the detected aspects with probabilities, LR and SVM sentiment and the words that drove the prediction.
- **Clause mode** (extension): splits "…, but …" sentences so each aspect gets its own sentiment. The paper lists this as future work.
- **Batch upload** of CSV/XLSX/TXT files.
- **Review database** (SQLite by default, MySQL optional) with filters, gold-label comparison and CSV export.
- **VoC dashboard:** sentiment distribution, aspect frequency, negative-rate pain points, aspect co-occurrence, per-hotel sentiment.
- **Research results** page: every metric of the run, side by side with the values reported in the paper.
- JWT login with admin/analyst roles.

## Honest notes
- The repository ships with a **synthetic demo sample** (`backend/data/demo/DEMO_SYNTHETIC_hrast_format.csv`, generated from templates) so the app runs before the dataset is downloaded. Its scores are near-perfect and **mean nothing**. The UI shows a warning until the model is retrained on HRAST.
- HRAST must be downloaded from Kaggle (login required): https://www.kaggle.com/datasets/costastziouvas/hotel-reviews-aspects-sentiments-and-topics
- Re-running the experiment may give numbers slightly different from the paper (preprocessing details, library versions, hyper-parameters). The Research page always reports what was actually measured.
- One documented deviation: negation words (not, no, never…) are kept during stop-word removal, because removing them flips sentiment.
- `class_weight="balanced"` is used for the aspect and LR sentiment models (use `--no-class-weight` to train without it).

## Tech stack
React + TypeScript + Vite + Tailwind + Recharts (frontend) · Python FastAPI + SQLAlchemy + JWT (backend) · SQLite / MySQL (database) · scikit-learn, NLTK, pandas, matplotlib (ML) · faster-whisper (voice).

## Project structure
```
backend/
  ml/            data loading, preprocessing, training, analytics, figures, predictor
  app/           FastAPI app: routes, models (4 tables), auth, services, speech
  data/raw/      put the HRAST file here
  data/demo/     synthetic demo sample
  artifacts/     trained model, results.json, test_predictions.csv, figures/
  scripts/       generate_demo_data.py
  tests/         pytest suite
frontend/        React application
scripts/         take_screenshots.py
docs/screenshots/
```
