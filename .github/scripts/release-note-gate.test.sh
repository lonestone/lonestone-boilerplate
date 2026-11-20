#!/usr/bin/env bash
# Replays the cases of release-note-gate.sh with a fake `gh`, in a throwaway directory.
# Run from the repository root: bash .github/scripts/release-note-gate.test.sh
set -euo pipefail

GATE="$(cd "$(dirname "$0")" && pwd)/release-note-gate.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# The fake gh answers the two calls the gate makes, and fails on any other call.
#   gh pr list ... : prints FAKE_PENDING, the number of merged Release PRs labelled "autorelease: pending".
#   gh release view: succeeds only when FAKE_RELEASED is "yes".
mkdir -p "$WORK/bin"
cat > "$WORK/bin/gh" <<'SH'
#!/usr/bin/env bash
case "$*" in
  "pr list --state merged --base main --label autorelease: pending --json number --jq length")
    echo "${FAKE_PENDING:-0}" ;;
  "release view v2.12.0")
    [[ "${FAKE_RELEASED:-no}" == "yes" ]] ;;
  *)
    echo "unexpected gh call: $*" >&2
    exit 2 ;;
esac
SH
chmod +x "$WORK/bin/gh"

failures=0

# run_case <name> <pending count> <released: yes|no> <note present: yes|no> <REQUIRE_RELEASE_NOTE>
#          <expected exit> <expected output line>
run_case() {
  local name="$1" pending="$2" released="$3" note="$4" require="$5" want_exit="$6" want_line="$7"
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
    PATH="$WORK/bin:$PATH" FAKE_PENDING="$pending" FAKE_RELEASED="$released" REQUIRE_RELEASE_NOTE="$require" \
      GITHUB_OUTPUT="$repo/output" bash "$GATE"
  ) > "$repo/log" 2>&1 || got_exit=$?

  # A held release must not tell the workflow to copy a note.
  local stray_mirror=no
  if [[ "$want_exit" != "0" ]] && [[ -s "$repo/output" ]]; then
    stray_mirror=yes
  fi

  if [[ "$got_exit" != "$want_exit" ]] || [[ "$stray_mirror" == "yes" ]] \
    || ! grep -qF -- "$want_line" "$repo/output" "$repo/log"; then
    echo "FAIL ${name}: exit ${got_exit} (want ${want_exit}), want a line with '${want_line}', stray output: ${stray_mirror}"
    sed 's/^/  | /' "$repo/log"
    failures=$((failures + 1))
  else
    echo "ok   ${name}"
  fi
}

run_case nothing-pending 0 no no true 0 "mirror=false"
run_case note-present 1 no yes true 0 "mirror=true"
run_case note-present-optional 1 no yes "" 0 "mirror=true"
# A Release PR merged without its note while notes are required: the release is held.
run_case note-missing-required 1 no no true 1 "Release v2.12.0 is held"
run_case note-missing-optional 1 no no "" 0 "mirror=false"
# A stale "autorelease: pending" label on a release that already exists does not hold main.
run_case already-released 1 yes no true 0 "already exists"

if [[ "$failures" -gt 0 ]]; then
  echo "${failures} case(s) failed"
  exit 1
fi
echo "All release note gate cases pass"
