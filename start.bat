@echo off
echo Starting ELLIE...

start "elliebusiness" cmd /k "cd /d C:\Users\humes\Desktop\Projects\ellie\elliebusiness && C:\Python314\python.exe -m uvicorn main:app --reload --port 8001"
start "webapp-backend" cmd /k "cd /d C:\Users\humes\Desktop\Projects\ellie\webapp\backend && C:\Python314\python.exe -m uvicorn main:app --reload --port 8002"

echo Waiting 15 seconds for backends to come up...
timeout /t 15 /nobreak

start "webapp-frontend" cmd /k "cd /d C:\Users\humes\Desktop\Projects\ellie\webapp\frontend && npm run dev"

echo All 3 servers starting in separate windows.
