@echo off
setlocal enabledelayedexpansion

REM =============================================================================
REM  FairSim — Google Cloud Run Deployment (Windows)
REM =============================================================================

REM ── CONFIG — CHANGE THESE ───────────────────────────────────────────────────
set PROJECT_ID=your-gcp-project-id
set REGION=asia-south1
set GEMINI_API_KEY=your-gemini-api-key-here
REM ─────────────────────────────────────────────────────────────────────────────

set BACKEND_IMAGE=gcr.io/%PROJECT_ID%/fairsim-backend
set FRONTEND_IMAGE=gcr.io/%PROJECT_ID%/fairsim-frontend
set BACKEND_SERVICE=fairsim-backend
set FRONTEND_SERVICE=fairsim-frontend

echo.
echo ==========================================
echo   FairSim — Google Cloud Deployment
echo ==========================================
echo   Project : %PROJECT_ID%
echo   Region  : %REGION%
echo.

echo [1/7] Setting GCP project...
gcloud config set project %PROJECT_ID%

echo [2/7] Enabling APIs...
gcloud services enable cloudbuild.googleapis.com run.googleapis.com containerregistry.googleapis.com secretmanager.googleapis.com

echo [3/7] Storing Gemini API key...
echo %GEMINI_API_KEY%| gcloud secrets create gemini-api-key --data-file=- --replication-policy=automatic 2>nul || echo %GEMINI_API_KEY%| gcloud secrets versions add gemini-api-key --data-file=-

echo [4/7] Building backend...
gcloud builds submit backend --tag %BACKEND_IMAGE% --timeout=15m

echo [5/7] Deploying backend...
gcloud run deploy %BACKEND_SERVICE% --image %BACKEND_IMAGE% --platform managed --region %REGION% --allow-unauthenticated --memory 2Gi --cpu 2 --timeout 300 --concurrency 10 --set-secrets GEMINI_API_KEY=gemini-api-key:latest

REM Get backend URL
for /f "tokens=*" %%i in ('gcloud run services describe %BACKEND_SERVICE% --platform managed --region %REGION% --format "value(status.url)"') do set BACKEND_URL=%%i
echo Backend URL: %BACKEND_URL%

echo [6/7] Building frontend...
gcloud builds submit frontend --tag %FRONTEND_IMAGE% --timeout=15m --build-arg VITE_API_URL=%BACKEND_URL%

echo [7/7] Deploying frontend...
gcloud run deploy %FRONTEND_SERVICE% --image %FRONTEND_IMAGE% --platform managed --region %REGION% --allow-unauthenticated --memory 512Mi --cpu 1 --timeout 60

for /f "tokens=*" %%i in ('gcloud run services describe %FRONTEND_SERVICE% --platform managed --region %REGION% --format "value(status.url)"') do set FRONTEND_URL=%%i

echo.
echo ==========================================
echo   Deployment Complete!
echo ==========================================
echo   Frontend : %FRONTEND_URL%
echo   Backend  : %BACKEND_URL%
echo   API Docs : %BACKEND_URL%/docs
echo.
start %FRONTEND_URL%
pause
