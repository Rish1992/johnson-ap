#!/bin/bash
cd "$(dirname "$0")"
source .venv/bin/activate 2>/dev/null || (python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt)
uvicorn main:app --port 8090 --host 0.0.0.0 --reload
