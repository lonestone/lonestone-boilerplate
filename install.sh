#!/usr/bin/env sh

main() {
  set -eu

  REPO_URL="${BOILERPLATE_REPO:-https://github.com/lonestone/lonestone-boilerplate}"
  CLI_PATH=".boilerstone/cli/boilerplate.ts"

  # die() writes to stderr, so colors require both streams to be terminals.
  if [ -t 1 ] && [ -t 2 ]; then
    C_CYAN='\033[36m'; C_GREEN='\033[32m'; C_RED='\033[31m'; C_RESET='\033[0m'
  else
    C_CYAN=''; C_GREEN=''; C_RED=''; C_RESET=''
  fi

  MODE="${1:-help}"
  [ "$#" -gt 0 ] && shift || true

  REF="latest"
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
  validate_release_ref

  case "$MODE" in
    init)
      [ "$POSITIONAL_COUNT" -le 1 ] || die "init accepts at most one directory argument"
      need git; need pnpm
      resolve_release_ref
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
      resolve_release_ref
      [ -f package.json ] || die "Run this at the root of an existing project (package.json not found)"
      fetch_subdirs ".boilerstone" ".claude/skills/boilerstone-upgrade" ".cursor/skills/boilerstone-upgrade"
      # The repo ships its own tracking state; drop it so init detects THIS project's version.
      rm -f .boilerstone/boilerplate.json
      run_tty env BOILERPLATE_INSTALLER_ONBOARD=1 pnpm dlx tsx "$CLI_PATH" bootstrap
      pnpm install
      offer_onboard_commit
      ok "Project onboarded"
      ;;

    upgrade)
      [ "$POSITIONAL_COUNT" -le 1 ] || die "upgrade accepts at most one version argument"
      need git; need pnpm
      [ -f "$CLI_PATH" ] || die "No $CLI_PATH found — run 'onboard' first"
      version="${POSITIONAL:-latest}"
      # prepare defaults handle the rest: auto-fetch and interactive selection.
      run_tty pnpm boilerplate upgrade --to "$version"
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

validate_release_ref() {
  [ "$REF" = "latest" ] && return 0
  printf '%s\n' "$REF" | grep -Eq '^v[0-9]+\.[0-9]+\.[0-9]+$' \
    || die "--ref accepts only 'latest' or a release tag (vX.Y.Z); branches such as main are not supported"
}

resolve_release_ref() {
  [ "$REF" = "latest" ] || return 0
  REF="$(
    git ls-remote --tags --refs --sort=-version:refname "$REPO_URL" 'v*' \
      | grep -E 'refs/tags/v[0-9]+\.[0-9]+\.[0-9]+$' \
      | sed -n '1{s#.*refs/tags/##;p;}'
  )"
  [ -n "$REF" ] || die "No published boilerplate release found at $REPO_URL"
  validate_release_ref
  info "Resolved latest release: $REF"
}

# Offer to commit the onboarding files. Defaults to yes — including when there
# is no terminal to ask on — so declining is the only path that leaves the
# worktree uncommitted for manual review.
offer_onboard_commit() {
  git rev-parse --git-dir >/dev/null 2>&1 || { info "Not a git repository — skipping commit"; return 0; }
  answer=""
  if can_read_tty; then
    printf '%b' "${C_CYAN}→${C_RESET} Commit the onboarding now? [Y/n] "
    read -r answer </dev/tty || answer=""
  fi
  case "$answer" in
    [nN]*)
      info "Skipped — review and commit .boilerstone/, the boilerstone-upgrade skills, package.json and .gitignore yourself"
      return 0
      ;;
  esac
  git add .boilerstone .claude/skills/boilerstone-upgrade .cursor/skills/boilerstone-upgrade \
    package.json .gitignore pnpm-lock.yaml 2>/dev/null || true
  if git diff --cached --quiet 2>/dev/null; then
    info "Nothing to commit"
    return 0
  fi
  if git commit --quiet -m "chore: onboard boilerstone upgrade tracking"; then
    ok "Committed the onboarding"
    return 0
  fi
  # Typically the project's own pre-commit hooks (lint on pre-existing code or on
  # the vendored CLI). Onboarding itself succeeded — offer the bypass, don't fail.
  info "Commit was rejected (pre-commit hooks?). The onboarding files are staged."
  answer=""
  if can_read_tty; then
    printf '%b' "${C_CYAN}→${C_RESET} Retry with --no-verify? [y/N] "
    read -r answer </dev/tty || answer=""
  fi
  case "$answer" in
    [yY]*)
      git commit --quiet --no-verify -m "chore: onboard boilerstone upgrade tracking" || die "git commit failed"
      ok "Committed the onboarding (hooks bypassed)"
      ;;
    *)
      info "Left staged — fix the hook failures or run: git commit --no-verify -m \"chore: onboard boilerstone upgrade tracking\""
      ;;
  esac
}

# True when /dev/tty can be opened for reading. Probe in a subshell so a failed
# open cannot abort the script under `set -e` (dash on Linux CI has no usable tty).
can_read_tty() {
  (exec </dev/tty) >/dev/null 2>&1
}

# Run an interactive command with stdin attached to the terminal when available,
# so prompts work even when this script itself is being piped from `curl | sh`.
run_tty() {
  if can_read_tty; then
    "$@" </dev/tty && return 0
  fi
  "$@"
}

usage() {
  cat <<'EOF'
Lonestone boilerplate installer

Usage:
  curl -fsSL https://raw.githubusercontent.com/lonestone/lonestone-boilerplate/main/install.sh | sh -s -- <command> [args]

Commands:
  init [dir]          Create a new project from the template (default dir: my-app)
  onboard             Add the upgrade system + agent skills to an existing project (run at its root)
  upgrade [version]   Prepare a boilerplate upgrade in an already-wired project (default: latest)

Options:
  --ref <latest|tag>  Published release to fetch (default: latest; tag format: vX.Y.Z)

Environment:
  BOILERPLATE_REPO    Override the repository URL (e.g. an SSH URL for a private fork)
EOF
}

# Fetch directories from the repo (snapshot, no history, one sparse clone) into ./<dir>.
fetch_subdirs() {
  for subdir in "$@"; do
    [ -e "$subdir" ] && die "$subdir already exists here — remove it first"
  done
  tmp="$(mktemp -d)"
  # shellcheck disable=SC2064
  trap "rm -rf '$tmp'" EXIT
  info "Fetching $* from $REPO_URL@$REF"
  git clone --quiet --depth 1 --filter=blob:none --sparse --branch "$REF" "$REPO_URL" "$tmp" \
    || die "git clone failed (ref: $REF)"
  git -C "$tmp" sparse-checkout set "$@" >/dev/null 2>&1 \
    || die "sparse-checkout failed (git >= 2.25 required)"
  for subdir in "$@"; do
    [ -d "$tmp/$subdir" ] || die "$subdir not found at ref $REF"
    case "$subdir" in
      */*) mkdir -p "$(dirname "$subdir")" ;;
    esac
    mv "$tmp/$subdir" "$subdir"
    ok "Fetched $subdir"
  done
  rm -rf "$tmp"
  trap - EXIT
}

main "$@"
