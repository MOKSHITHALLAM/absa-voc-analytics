# All commands in one place (Windows, Command Prompt)

Project folder used below: `C:\Users\moksh\Desktop\absa-voc-analytics`
(change the path if you extracted it somewhere else).

You need **Python 3.10–3.13** and **Node.js 18+** installed.

---

## A. First-time setup (do once)

### Terminal 1 — backend
```bat
cd C:\Users\moksh\Desktop\absa-voc-analytics\backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m nltk.downloader wordnet omw-1.4
```

Optional, for the microphone / voice feature:
```bat
pip install faster-whisper
```

### Terminal 2 — frontend
```bat
cd C:\Users\moksh\Desktop\absa-voc-analytics\frontend
npm install
```

---

## B. Train on the real HRAST dataset (do once, after downloading it)

1. Download from https://www.kaggle.com/datasets/costastziouvas/hotel-reviews-aspects-sentiments-and-topics
2. Copy the downloaded file into `backend\data\raw\`
3. In Terminal 1 (venv active):
```bat
python -m ml.inspect_data data\raw\<your file name>
python -m ml.train
del storage\voc_analytics.db
```
(The last line clears the demo reviews so the database is refilled with HRAST test sentences.)

Without this step the app runs on the small **synthetic demo sample** and shows a yellow warning.

---

## C. Every time you show the project

### Terminal 1 — backend
```bat
cd C:\Users\moksh\Desktop\absa-voc-analytics\backend
.venv\Scripts\activate
uvicorn app.main:app --reload
```
Wait for `Application startup complete`.

### Terminal 2 — frontend
```bat
cd C:\Users\moksh\Desktop\absa-voc-analytics\frontend
npm run dev
```

Open **http://localhost:5173** and sign in:
- Email: `admin@vocanalytics.app`
- Password: `admin123`

API documentation (for the evaluator): **http://127.0.0.1:8000/docs**

---

## D. Showing the database

The database file is `backend\storage\voc_analytics.db` (SQLite).
In VS Code: install the **SQLite Viewer** extension, then *File → Open File…* and pick that file.
Tables: `users`, `reviews`, `review_aspects`, `training_runs`.
Every review you analyse in the app appears in `reviews` immediately (refresh the viewer).

---

## E. Tests (optional)
```bat
cd backend
.venv\Scripts\activate
pytest -q

cd ..\frontend
npm test
```

## F. Common problems
| Problem | Fix |
|---|---|
| `No module named ...` | You forgot `.venv\Scripts\activate` in Terminal 1 |
| Frontend says "server could not be reached" | Start the backend first (Terminal 1) |
| Voice tab says not installed | `pip install faster-whisper`, then restart the backend. First use downloads the Whisper model (internet needed) |
| Port 8000 busy | `uvicorn app.main:app --reload --port 8001`, and set `VITE_API_PROXY=http://127.0.0.1:8001` before `npm run dev` |
| Want to start over | Stop the backend, delete `backend\storage\voc_analytics.db`, start again |
