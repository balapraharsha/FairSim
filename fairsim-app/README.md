# ⚔️ FairSim — Bias Penetration Testing Platform

> Attack your AI before the world does.
> Google Solution Challenge 2026 — Unbiased AI Decision theme.

---

## 🚀 Option A — Run locally (dev)

```bat
:: Terminal 1 — Backend
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
:: Edit .env → add GEMINI_API_KEY
uvicorn main:app --reload

:: Terminal 2 — Frontend
cd frontend
npm install
npm run dev

:: Open: http://localhost:5173
```

Or double-click `setup.bat` then `run.bat`.

---

## ☁️ Option B — Deploy to Google Cloud Run

### Prerequisites
1. [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) installed
2. A GCP project created at [console.cloud.google.com](https://console.cloud.google.com)
3. Billing enabled on the project
4. Gemini API key from [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)

### One-command deploy (Mac/Linux)
```bash
# 1. Edit deploy.sh — set PROJECT_ID, REGION, GEMINI_API_KEY
nano deploy.sh

# 2. Login to Google Cloud
gcloud auth login
gcloud auth configure-docker

# 3. Run
chmod +x deploy.sh
./deploy.sh
```

### One-command deploy (Windows)
```bat
:: 1. Edit deploy.bat — set PROJECT_ID, REGION, GEMINI_API_KEY
notepad deploy.bat

:: 2. Login
gcloud auth login
gcloud auth configure-docker

:: 3. Run
deploy.bat
```

### What deploy.sh does (step by step)
| Step | Action |
|------|--------|
| 1 | Sets your GCP project |
| 2 | Enables Cloud Run, Cloud Build, Container Registry, Secret Manager APIs |
| 3 | Stores your Gemini API key in Secret Manager (never in code) |
| 4 | Builds backend Docker image via Cloud Build |
| 5 | Deploys backend to Cloud Run (2GB RAM, 2 CPU) |
| 6 | Builds frontend with backend URL injected at build time |
| 7 | Deploys frontend to Cloud Run (nginx, port 8080) |

### Estimated cost
- Cloud Run: **free tier** covers ~2 million requests/month
- Cloud Build: 120 free build-minutes/day
- Container Registry: ~$0.10/GB storage
- **Total for demo/competition: ~$0**

### Region recommendation
Use `asia-south1` (Mumbai) — lowest latency from India.

---

## 📁 Project Structure

```
fairsim-app/
├── backend/
│   ├── Dockerfile              ← Cloud Run image
│   ├── main.py                 ← FastAPI app
│   ├── core/
│   │   ├── ml_engine.py        ← Train, FairScore, predict
│   │   ├── attack_engine.py    ← Counterfactual, Intersection, Adversarial
│   │   ├── shap_engine.py      ← SHAP % attribution
│   │   ├── fix_engine.py       ← 3 remediation strategies
│   │   └── eli5_engine.py      ← Gemini plain-English explanations
│   ├── api/routes/             ← All API endpoints
│   └── data/sample_hiring.csv  ← 800-row realistic dataset
│
├── frontend/
│   ├── Dockerfile              ← nginx Cloud Run image
│   ├── nginx.conf              ← SPA routing + port 8080
│   └── src/
│       ├── pages/              ← 9 pages (Dashboard → Report)
│       ├── components/         ← Layout + UI components
│       ├── store/index.js      ← Zustand global state
│       └── utils/api.js        ← API calls (auto-switches local↔cloud)
│
├── deploy.sh                   ← One-shot GCP deploy (Mac/Linux)
├── deploy.bat                  ← One-shot GCP deploy (Windows)
├── cloudbuild-backend.yaml     ← CI/CD: backend
├── cloudbuild-frontend.yaml    ← CI/CD: frontend
├── setup.bat                   ← Local setup (Windows)
└── run.bat                     ← Local run (Windows)
```

---

## 🎯 Demo flow (video)

1. **Upload** `data/sample_hiring.csv` → Auto-train
2. **Attack** → Adversarial Search → worst combo: `female+Tier-3+govt+low` → **16.7% approval**
3. **Heatmap** → red cells everywhere for rural women
4. **SHAP** → city_tier 35%, school_type 28%, gender 18%
5. **Fix** → Rebalancing → FairScore 66 → 81
6. **What-If** → same 4 yrs exp: rural woman **Rejected** / city man **Selected**
7. **Report** → compliance checklist ✓

---

## 🔒 Security

- Gemini API key stored in **Google Secret Manager** — never in code or env files
- No PII stored: uploads processed in-memory only
- CORS restricted to frontend URL only
- Cloud Run instances are ephemeral — no data persists between requests
