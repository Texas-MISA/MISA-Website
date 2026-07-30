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
set -euo pipefail

SEED="${1:-supabase/seed.sql}"
[ -f "$SEED" ] || { echo "no such file: $SEED" >&2; exit 1; }

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

awk -v dir="$TMP" '
  /^-- @chunk/ { n++; file=sprintf("%s/%02d-%s.sql", dir, n, $3); printf "" > file; next }
  n > 0 { print >> file }
' "$SEED"

shopt -s nullglob
for f in "$TMP"/*.sql; do
  name=$(basename "$f" .sql)
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
