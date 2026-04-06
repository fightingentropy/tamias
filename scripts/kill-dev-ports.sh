#!/usr/bin/env bash
# Free default Tamias dev ports (stale Vite / wrangler / worker).
set -euo pipefail

for port in 3001 3002 3003 8787; do
  pids="$(lsof -ti "tcp:${port}" 2>/dev/null || true)"
  if [[ -n "${pids}" ]]; then
    for pid in ${pids}; do
      echo "Stopping PID ${pid} on port ${port}"
      kill -9 "${pid}" 2>/dev/null || true
    done
  fi
done
