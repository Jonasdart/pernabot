@echo off
cd /d "%~dp0"
title Pernabot & Dashboard Web

if exist .venv\Scripts\python.exe (
    .venv\Scripts\python.exe run.py
) else (
    python run.py
)
pause
