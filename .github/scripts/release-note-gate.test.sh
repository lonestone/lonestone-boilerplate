#!/usr/bin/env bash
# Replays the cases of release-note-gate.sh with a fake `gh`, in a throwaway directory.
# Run from the repository root: bash .github/scripts/release-note-gate.test.sh
set -euo pipefail

GATE="$(cd "$(dirname "$0")" && pwd)/release-note-gate.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# The fake gh prints the number of merged Release PRs still labelled "autorelease: pending".
mkdir -p "$WORK/bin"
cat > "$WORK/bin/gh" <<'SH'
#!/usr/bin/env bash
echo "${FAKE_PENDING:-0}"
SH
chmod +x "$WORK/bin/gh"

failures=0

# run_case <name> <pending count> <note present: yes|no> <REQUIRE_RELEASE_NOTE> <expected exit> <expected output line>
run_case() {
  local name="$1" pending="$2" note="$3" require="$4" want_exit="$5" want_line="$6"
  local repo="$WORK/$name"
  mkdir -p "$repo/apps/documentation/src/content/docs/releases"
  echo '{ ".": "2.12.0" }' > "$repo/.release-please-manifest.json"
  if [[ "$note" == "yes" ]]; then
    echo "# v2.12.0" > "$repo/apps/documentation/src/content/docs/releases/v2.12.0.mdx"
  fi
  : > "$repo/output"

  local got_exit=0
  (
    cd "$repo"
    PATH="$WORK/bin:$PATH" FAKE_PENDING="$pending" REQUIRE_RELEASE_NOTE="$require" \
      GITHUB_OUTPUT="$repo/output" bash "$GATE"
  ) > "$repo/log" 2>&1 || got_exit=$?

  if [[ "$got_exit" != "$want_exit" ]] || ! grep -qF -- "$want_line" "$repo/output" "$repo/log"; then
    echo "FAIL ${name}: exit ${got_exit} (want ${want_exit}), want a line with '${want_line}'"
    sed 's/^/  | /' "$repo/log"
    failures=$((failures + 1))
  else
    echo "ok   ${name}"
  fi
}

run_case nothing-pending 0 no true 0 "mirror=false"
run_case note-present 1 yes true 0 "mirror=true"
run_case note-present-optional 1 yes "" 0 "mirror=true"
# The music-downloader case: Release PR merged without its note, notes required.
run_case note-missing-required 1 no true 1 "Release v2.12.0 is held"
run_case note-missing-optional 1 no "" 0 "mirror=false"

if [[ "$failures" -gt 0 ]]; then
  echo "${failures} case(s) failed"
  exit 1
fi
echo "All release note gate cases pass"
