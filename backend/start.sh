#!/bin/bash
# Render may not expand $PORT in Start Command; this script ensures it's used
set -e
PORT="${PORT:-10000}"
exec gunicorn wsgi:app -b "0.0.0.0:${PORT}" -w 1 -t 120
