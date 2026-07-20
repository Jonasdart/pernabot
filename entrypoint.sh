#!/bin/bash
set -e

# Ensure data directory exists for SQLite persistence
mkdir -p /app/data

# Start FastAPI API & Frontend Server in the background
echo "⚽ Iniciando Servidor Web (FastAPI + Frontend) na porta 8000..."
uvicorn src.api.main:app --host 0.0.0.0 --port 8000 &
UVICORN_PID=$!

# Start Telegram Bot process in the background
echo "🤖 Iniciando Pernabot Telegram Assistant..."
python src/main.py &
BOT_PID=$!

# Function to handle graceful shutdown
cleanup() {
    echo "Encerrando processos..."
    kill -TERM $UVICORN_PID 2>/dev/null || true
    kill -TERM $BOT_PID 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for any process to exit
wait -n $UVICORN_PID $BOT_PID
