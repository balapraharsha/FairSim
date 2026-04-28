@echo off
echo Starting FairSim...
start "FairSim Backend" cmd /k "cd backend && venv\Scripts\activate && uvicorn main:app --reload --port 8000"
timeout /t 3 /nobreak >nul
start "FairSim Frontend" cmd /k "cd frontend && npm run dev"
timeout /t 4 /nobreak >nul
start http://localhost:5173
echo.
echo Both servers starting. Browser will open automatically.
