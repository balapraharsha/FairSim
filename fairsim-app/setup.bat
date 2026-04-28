@echo off
echo ============================================
echo   FairSim Setup — Windows
echo ============================================

echo.
echo [1/4] Setting up Python backend...
cd backend
python -m venv venv
call venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
echo      Done. Edit backend\.env and add your GEMINI_API_KEY
cd ..

echo.
echo [2/4] Setting up React frontend...
cd frontend
npm install
cd ..

echo.
echo ============================================
echo   Setup complete!
echo ============================================
echo.
echo   To run the app:
echo   - Terminal 1: cd backend ^&^& venv\Scripts\activate ^&^& uvicorn main:app --reload
echo   - Terminal 2: cd frontend ^&^& npm run dev
echo   - Open: http://localhost:5173
echo.
pause
