#!/usr/bin/env sh
set -eu

if ! command -v pnpm >/dev/null 2>&1; then
  printf '%s\n' 'pnpm is required. Install it from https://pnpm.io/installation' >&2
  exit 1
fi

# From a boilerplate checkout, run the workspace CLI directly so ./install.sh
# works before @lonestone/cli is published. curl | sh has no local sources and
# delegates to the published package.
here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
bin_ts="$here/packages/cli/src/bin.ts"
if [ -f "$bin_ts" ]; then
  tsx_cli="$here/node_modules/tsx/dist/cli.mjs"
  if [ ! -f "$tsx_cli" ]; then
    tsx_cli="$here/packages/cli/node_modules/tsx/dist/cli.mjs"
  fi
  if [ -f "$tsx_cli" ]; then
    exec node "$tsx_cli" "$bin_ts" "$@"
  fi
  exec pnpm exec tsx "$bin_ts" "$@"
fi

exec pnpm dlx @lonestone/cli "$@"
