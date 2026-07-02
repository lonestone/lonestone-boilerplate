#!/usr/bin/env sh

main() {
  set -eu

  REPO_URL="${BOILERPLATE_REPO:-https://github.com/lonestone/lonestone-boilerplate}"
  CLI_PATH=".boilerstone/cli/boilerplate.ts"

  if [ -t 1 ]; then
    C_CYAN='\033[36m'; C_GREEN='\033[32m'; C_RED='\033[31m'; C_RESET='\033[0m'
  else
    C_CYAN=''; C_GREEN=''; C_RED=''; C_RESET=''
  fi

  MODE="${1:-help}"
  [ "$#" -gt 0 ] && shift || true

  REF="main"
  POSITIONAL=""
  POSITIONAL_COUNT=0
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --ref) REF="${2:-}"; [ -n "$REF" ] || die "--ref requires a value"; shift 2 ;;
      --ref=*) REF="${1#--ref=}"; shift ;;
      -h|--help) usage; exit 0 ;;
      --*) die "Unknown option: $1" ;;
      *) POSITIONAL="$1"; POSITIONAL_COUNT=$((POSITIONAL_COUNT + 1)); shift ;;
    esac
  done

  case "$MODE" in
    init)
      [ "$POSITIONAL_COUNT" -le 1 ] || die "init accepts at most one directory argument"
      need git; need pnpm
      dir="${POSITIONAL:-my-app}"
      [ -e "$dir" ] && die "Directory '$dir' already exists"
      info "Creating new project in $dir from $REPO_URL@$REF"
      git clone --quiet --depth 1 --branch "$REF" "$REPO_URL" "$dir" || die "git clone failed (ref: $REF)"

      source_commit="$(git -C "$dir" rev-parse HEAD 2>/dev/null || printf '')"
      source_version="$(git -C "$dir" describe --tags --exact-match --match 'v*' 2>/dev/null || git -C "$dir" describe --tags --abbrev=0 --match 'v*' 2>/dev/null || printf '')"
      source_version="${source_version#v}"

      rm -rf "$dir/.git"
      (
        cd "$dir"
        git init --quiet
        pnpm install
        export BOILERPLATE_SOURCE_COMMIT="$source_commit"
        export BOILERPLATE_SOURCE_VERSION="$source_version"
        run_tty pnpm rock
      )
      ok "Project ready in $dir"
      ;;

    onboard)
      [ "$POSITIONAL_COUNT" -eq 0 ] || die "onboard does not accept positional arguments"
      need git; need pnpm
      [ -f package.json ] || die "Run this at the root of an existing project (package.json not found)"
      fetch_subdir ".boilerstone"
      # The repo ships its own tracking state; drop it so init detects THIS project's version.
      rm -f .boilerstone/boilerplate.json
      run_tty env BOILERPLATE_INSTALLER_ONBOARD=1 pnpm dlx tsx "$CLI_PATH" bootstrap
      pnpm install
      ok "Project onboarded — review and commit .boilerstone/, package.json and .gitignore"
      ;;

    upgrade)
      [ "$POSITIONAL_COUNT" -le 1 ] || die "upgrade accepts at most one version argument"
      need git; need pnpm
      [ -f "$CLI_PATH" ] || die "No $CLI_PATH found — run 'onboard' first"
      version="${POSITIONAL:-latest}"
      # --fetch pulls the release tags first, so 'latest' can be resolved and
      # reference trees extracted.
      pnpm boilerplate upgrade prepare --to "$version" --fetch
      ok "Upgrade workspace prepared — follow .boilerstone/docs/upgrade-runbook.md"
      ;;

    help|-h|--help|"") usage ;;
    *) usage; die "Unknown command: $MODE" ;;
  esac
}

info() { printf '%b\n' "${C_CYAN}→${C_RESET} $*"; }
ok() { printf '%b\n' "${C_GREEN}✓${C_RESET} $*"; }
die() { printf '%b\n' "${C_RED}✗${C_RESET} $*" >&2; exit 1; }

need() { command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"; }

# Run an interactive command with stdin attached to the terminal when available,
# so prompts work even when this script itself is being piped from `curl | sh`.
run_tty() {
  if : </dev/tty 2>/dev/null; then
    "$@" </dev/tty
  else
    "$@"
  fi
}

usage() {
  cat <<'EOF'
Lonestone boilerplate installer

Usage:
  curl -fsSL https://raw.githubusercontent.com/lonestone/lonestone-boilerplate/main/install.sh | sh -s -- <command> [args]

Commands:
  init [dir]          Create a new project from the template (default dir: my-app)
  onboard             Add the upgrade system to an existing project (run at its root)
  upgrade [version]   Prepare a boilerplate upgrade in an already-wired project (default: latest)

Options:
  --ref <git-ref>     Branch or tag to fetch (default: main)

Environment:
  BOILERPLATE_REPO    Override the repository URL (e.g. an SSH URL for a private fork)
EOF
}

# Fetch a single top-level directory from the repo (snapshot, no history) into ./<dir>.
fetch_subdir() {
  subdir="$1"
  [ -e "$subdir" ] && die "$subdir already exists here — remove it first"
  tmp="$(mktemp -d)"
  # shellcheck disable=SC2064
  trap "rm -rf '$tmp'" EXIT
  info "Fetching $subdir from $REPO_URL@$REF"
  git clone --quiet --depth 1 --filter=blob:none --sparse --branch "$REF" "$REPO_URL" "$tmp" \
    || die "git clone failed (ref: $REF)"
  git -C "$tmp" sparse-checkout set "$subdir" >/dev/null 2>&1 \
    || die "sparse-checkout failed (git >= 2.25 required)"
  [ -d "$tmp/$subdir" ] || die "$subdir not found at ref $REF"
  mv "$tmp/$subdir" "$subdir"
  rm -rf "$tmp"
  trap - EXIT
  ok "Fetched $subdir"
}

main "$@"
