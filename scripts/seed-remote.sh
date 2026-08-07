#!/usr/bin/env bash
# Apply supabase/seed.sql to the linked remote project.
#
# `supabase db reset` runs seed.sql automatically but needs Docker. Until that
# is set up, this pushes the seed through `supabase db query --linked`, which
# imposes two awkward constraints:
#
#   1. It reads only the first line of the SQL argument, so each statement
#      group has to be flattened onto one line. Full-line `--` comments are
#      stripped first, otherwise flattening would comment out the statements
#      that follow. seed.sql therefore must not use trailing inline comments.
#   2. Windows caps a command line near 8k characters, so the file is split on
#      `-- @chunk` markers and sent piece by piece.
#
# Dev projects only. seed.sql is destructive and guards itself by refusing to
# run when auth.users holds accounts other than the seed officer.
#
# --- --force, and why it exists -------------------------------------------
#
# That guard has one false positive, and it is the ordinary case rather than a
# corner: ANY project somebody has signed into has a real officer in
# auth.users, so the guard refuses forever after the first login. Until now the
# only way past it was to hand-edit the guard out of a copy of seed.sql, which
# is both the exact shape of an accidental production wipe and something nobody
# should be practising.
#
# --force makes the override deliberate, visible, and reviewable instead:
#
#   * it must be typed, every time — there is no env var and no default;
#   * it names the project it is about to wipe and counts what is in there
#     first, so "which database am I pointed at" is answered before the delete
#     rather than after (the `--linked=false` trap in CLAUDE.md is precisely
#     this mistake);
#   * it requires the operator to type the project ref back.
#
# ⚠️ It skips ONLY the guard chunk. Everything the seed deletes, it still
# deletes. Use it on dev and staging projects. If you are about to type it
# against something with data anyone would miss, stop.
set -euo pipefail

FORCE=0
SEED=""
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    -*) echo "unknown option: $arg" >&2; exit 1 ;;
    *) SEED="$arg" ;;
  esac
done
SEED="${SEED:-supabase/seed.sql}"
[ -f "$SEED" ] || { echo "no such file: $SEED" >&2; exit 1; }

if [ "$FORCE" = 1 ]; then
  REF=$(npx supabase projects list --output json 2>/dev/null \
        | python -c "import sys,json;print(next((p['id'] for p in json.load(sys.stdin) if p.get('linked')),''))" 2>/dev/null || true)
  [ -n "$REF" ] || { echo "could not determine the linked project ref; refusing to --force" >&2; exit 1; }

  echo
  echo "  ⚠️  --force: about to WIPE and re-seed the linked project"
  echo "      project ref : $REF"
  echo "      seed file   : $SEED"
  echo "      currently holds:"
  npx supabase db query --linked \
    "select (select count(*) from members) members, (select count(*) from events) events, (select count(*) from attendance) attendance, (select count(*) from dues_payments) dues_payments, (select count(*) from admin_audit) audit_rows;" \
    2>/dev/null | sed -n 's/.*"\([a-z_]*\)": *\([0-9]*\).*/        \1 = \2/p' || true
  echo
  echo "      Officer logins in auth.users are NOT deleted, but every row above is."
  printf "      Type the project ref to continue: "
  read -r CONFIRM
  [ "$CONFIRM" = "$REF" ] || { echo "      mismatch — nothing was changed."; exit 1; }
  echo
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

awk -v dir="$TMP" '
  /^-- @chunk/ { n++; file=sprintf("%s/%02d-%s.sql", dir, n, $3); printf "" > file; next }
  n > 0 { print >> file }
' "$SEED"

shopt -s nullglob
for f in "$TMP"/*.sql; do
  name=$(basename "$f" .sql)
  # --force skips the guard chunk and nothing else. The wipe lives in the same
  # chunk, so it is re-issued below rather than lost.
  if [ "$FORCE" = 1 ] && [[ "$name" == *guard-and-wipe ]]; then
    sed -i -e '/^do \$\$/,/^end \$\$;/d' "$f"
    printf '%-26s %s\n' "$name" "guard skipped (--force) — wipe retained"
  fi
  # Drop full-line comments and blank lines, then collapse to a single line.
  sql=$(sed -e 's/^[[:space:]]*--.*$//' -e '/^[[:space:]]*$/d' "$f" | tr '\n' ' ')
  printf '%-26s %5d chars  ' "$name" "${#sql}"
  if [ "${#sql}" -gt 7500 ]; then
    echo "TOO LONG — split this chunk further"
    exit 1
  fi
  if out=$(npx supabase db query --linked "$sql" 2>&1) && ! grep -q '"_tag":"Error"' <<<"$out"; then
    echo "ok"
  else
    echo "FAILED"
    python -c "import sys,json,re; s=sys.stdin.read(); m=re.search(r'\{',s); d=json.loads(s[m.start():]); print('  ' + d['error']['message'][:300])" <<<"$out" 2>/dev/null || echo "$out" | head -3
    exit 1
  fi
done

echo "seed applied"
