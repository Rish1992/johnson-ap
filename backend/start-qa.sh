#!/bin/bash
# Johnson AP QA Backend — isolated DB, port 8091
cd "$(dirname "$0")"
source .venv/bin/activate 2>/dev/null || (python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt)
set -a && source .env 2>/dev/null && set +a
export DATABASE_URL="sqlite:///johnson_ap_qa.db"
uvicorn main:app --port 8091 --host 0.0.0.0
