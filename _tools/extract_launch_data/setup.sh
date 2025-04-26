#!/usr/bin/env bash
#
# _tools/extract_launch_data/setup_env.sh
# --------------------------------------
# One‑time virtual‑env bootstrap.
set -euo pipefail
cd "$(dirname "$0")"   # this script's directory

python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

echo "📦  Virtual env ready in $(pwd)/venv"
echo "👉  To activate later:  source _tools/extract_launch_data/venv/bin/activate"
