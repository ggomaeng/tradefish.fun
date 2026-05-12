#!/usr/bin/env bash
# Hermes Scholar cron wrapper — sources .env and fires the agent.
# PATH must include the homebrew node location since cron has a minimal env.
set -e
export PATH="/opt/homebrew/bin:$PATH"
cd ~/agents/hermes-scholar
export $(grep -v '^#' .env | xargs)
npx tsx index.ts >> log.txt 2>&1
