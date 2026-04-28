#!/bin/bash
# =============================================================================
#  FairSim — Google Cloud Run Deployment Script
#  Run this once. It deploys backend + frontend to Cloud Run.
# =============================================================================
set -e

# ── CONFIG — CHANGE THESE ────────────────────────────────────────────────────
PROJECT_ID="your-gcp-project-id"          # e.g. fairsim-2026
REGION="us-central1"                       # closest to India: asia-south1
GEMINI_API_KEY="your-gemini-api-key-here"  # from aistudio.google.com/app/apikey
# ─────────────────────────────────────────────────────────────────────────────

BACKEND_IMAGE="gcr.io/$PROJECT_ID/fairsim-backend"
FRONTEND_IMAGE="gcr.io/$PROJECT_ID/fairsim-frontend"
BACKEND_SERVICE="fairsim-backend"
FRONTEND_SERVICE="fairsim-frontend"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   FairSim — Google Cloud Deployment      ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Project : $PROJECT_ID"
echo "Region  : $REGION"
echo ""

# Step 1 — Set project
echo "▶ [1/7] Setting GCP project..."
gcloud config set project $PROJECT_ID

# Step 2 — Enable APIs
echo "▶ [2/7] Enabling required APIs..."
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  containerregistry.googleapis.com \
  secretmanager.googleapis.com

# Step 3 — Store Gemini key in Secret Manager
echo "▶ [3/7] Storing Gemini API key in Secret Manager..."
echo -n "$GEMINI_API_KEY" | gcloud secrets create gemini-api-key \
  --data-file=- \
  --replication-policy="automatic" 2>/dev/null || \
echo -n "$GEMINI_API_KEY" | gcloud secrets versions add gemini-api-key --data-file=-

# Step 4 — Build & push backend
echo "▶ [4/7] Building backend Docker image..."
gcloud builds submit ./backend \
  --tag $BACKEND_IMAGE \
  --timeout=15m

# Step 5 — Deploy backend to Cloud Run
echo "▶ [5/7] Deploying backend to Cloud Run..."
gcloud run deploy $BACKEND_SERVICE \
  --image $BACKEND_IMAGE \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --concurrency 10 \
  --min-instances 0 \
  --max-instances 5 \
  --set-secrets "GEMINI_API_KEY=gemini-api-key:latest" \
  --set-env-vars "CORS_ORIGINS=https://$FRONTEND_SERVICE-$(gcloud config get-value project | tr -d '-' | head -c8)-uc.a.run.app"

# Get backend URL
BACKEND_URL=$(gcloud run services describe $BACKEND_SERVICE \
  --platform managed \
  --region $REGION \
  --format "value(status.url)")
echo "✓ Backend live: $BACKEND_URL"

# Step 6 — Build & push frontend (inject backend URL)
echo "▶ [6/7] Building frontend Docker image..."
gcloud builds submit ./frontend \
  --tag $FRONTEND_IMAGE \
  --timeout=15m \
  --build-arg VITE_API_URL=$BACKEND_URL

# Step 7 — Deploy frontend to Cloud Run
echo "▶ [7/7] Deploying frontend to Cloud Run..."
gcloud run deploy $FRONTEND_SERVICE \
  --image $FRONTEND_IMAGE \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --timeout 60 \
  --concurrency 100 \
  --min-instances 0 \
  --max-instances 10

FRONTEND_URL=$(gcloud run services describe $FRONTEND_SERVICE \
  --platform managed \
  --region $REGION \
  --format "value(status.url)")

# Update backend CORS with actual frontend URL
echo "▶ Updating backend CORS with frontend URL..."
gcloud run services update $BACKEND_SERVICE \
  --platform managed \
  --region $REGION \
  --update-env-vars "CORS_ORIGINS=$FRONTEND_URL"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║         Deployment Complete!             ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "  Frontend : $FRONTEND_URL"
echo "  Backend  : $BACKEND_URL"
echo "  API Docs : $BACKEND_URL/docs"
echo ""
echo "  Open your app: $FRONTEND_URL"
echo ""
