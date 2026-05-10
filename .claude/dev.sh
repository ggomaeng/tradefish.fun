#!/usr/bin/env bash
# Dev-server launcher for the Claude Code preview harness.
#
# Why a wrapper: npm bootstraps via `#!/usr/bin/env node`, which re-resolves
# `node` through PATH. The user's default shell has Node 15 ahead of v22 in
# PATH, so even calling /path/to/v22/bin/npm directly fails — npm's child
# `node` invocations land on v15. Prepending the v22 bin dir to PATH is the
# only fully-isolated fix and keeps preview_start independent of shell init.
set -euo pipefail

NODE_BIN="/Users/tomo/.nvm/versions/node/v22.20.0/bin"
if [[ ! -x "$NODE_BIN/node" ]]; then
  echo "dev.sh: expected node at $NODE_BIN/node — run 'nvm install 22.20.0'" >&2
  exit 127
fi

export PATH="$NODE_BIN:$PATH"

# Run from the repo root regardless of where preview_start invokes us.
cd "$(dirname "$0")/.."

exec npm run dev "$@"
