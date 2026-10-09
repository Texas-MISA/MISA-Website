#!/usr/bin/env bash
# Back up the linked project, which is PRODUCTION, into a folder OUTSIDE this
# repository.
#
#   bash scripts/backup-remote.sh [output-dir]
#
# output-dir defaults to $MISA_BACKUP_DIR, then ~/misa-backups. Each run adds
# one folder, misa-<UTC time>/, and never overwrites an earlier one.
#
# 🔴 THIS IS THE ONLY BACKUP THERE IS. The project is on Supabase's Free plan,
# which keeps none: `supabase backups list` returned an empty list and
# `pitr_enabled: false` on 2026-10-09. Run this before anything that writes to
# production in bulk (a migration push, a roster import, a merge, a dues
# import), and weekly during the semester. A backup you did not take is the
# one you need.
#
# --- What a backup holds ---------------------------------------------------
#
# roles.sql       custom database roles (Supabase's restore guide takes all three)
# schema.sql      every table, view, function, policy and grant the remote has
# data.sql        every row in public, auth and storage, as COPY blocks
# counts.txt      exact row counts read just before the dump, which the script
#                 checks data.sql against, and a restore can be checked against
# migrations.txt  the remote's migration history: which repo commit's
#                 supabase/migrations/ matches schema.sql
#
# LEFT OUT of data.sql: auth's live sessions, refresh tokens and one-time
# tokens (password-reset and invite links), with the MFA challenge and flow
# state tied to them, and auth's sign-in log, which holds IP addresses. A
# stolen backup therefore holds no credential that is live today. The cost is
# that after a restore every officer signs in again; nothing else is lost.
# Officer accounts themselves (auth.users, auth.identities) ARE kept, password
# hashes included, because a restore without them locks every officer out.
#
# 🔓 Read-only. pg_dump never writes to the database it reads.
#
# 🔴 THE OUTPUT IS REAL CLUB DATA: every member's EID and email, every dues
# payment, and the officers' password hashes. THIS REPOSITORY IS PUBLIC, so
# the script refuses any output directory inside it. Keep backups somewhere
# private (not a shared or public cloud folder), and delete old ones you no
# longer need.
#
# Needs Docker Desktop running: the CLI runs pg_dump inside a container. Needs
# no database password: the CLI signs in with a temporary login role.
#
# --- Restoring -------------------------------------------------------------
#
# Into a NEW project (lost or deleted project, or a handoff), per Supabase's
# migration guide, with the new project's connection string in $DB_URL:
#
#   psql --single-transaction --variable ON_ERROR_STOP=1 \
#        --file roles.sql --file schema.sql \
#        --command 'SET session_replication_role = replica' \
#        --file data.sql --dbname "$DB_URL"
#
# Into the SAME project after rows were lost, do not run data.sql whole: it
# would collide with every row still there. Load it into the local stack first
# (`npx supabase db reset`, then the psql line above against
# postgresql://postgres:postgres@127.0.0.1:54322/postgres), find what is
# missing, and copy back only that. Do it before officers write more rows.
set -euo pipefail

REPO=$(cd "$(dirname "$0")/.." && pwd -P)
OUT_ROOT=${1:-${MISA_BACKUP_DIR:-$HOME/misa-backups}}

# Path checks go through Python because Git Bash hands Windows programs
# C:/... while it prints /c/..., so a string prefix test compares two
# spellings of one folder. realpath + normcase also catches a symlink, a ..,
# and a difference in case.
python - "$REPO" "$OUT_ROOT" <<'PY' || exit 1
import os, sys
repo, out = (os.path.normcase(os.path.realpath(p)) for p in sys.argv[1:3])
try:
    inside = os.path.commonpath([repo, out]) == repo
except ValueError:  # different drives
    inside = False
if inside:
    sys.exit(f"refusing to write a backup inside the repository ({out}).\n"
             "This repository is PUBLIC and a backup holds real EIDs and emails.\n"
             "Pass a folder outside it, or set MISA_BACKUP_DIR.")
PY

docker info >/dev/null 2>&1 || {
  echo "Docker Desktop is not running. The CLI runs pg_dump inside a container, so start it and run this again." >&2
  exit 1
}

REF=$(npx supabase projects list --output json 2>/dev/null \
      | python -c "import sys,json;print(next((p['id'] for p in json.load(sys.stdin) if p.get('linked')),''))" 2>/dev/null || true)
[ -n "$REF" ] || { echo "could not determine the linked project ref; run npx supabase link first" >&2; exit 1; }

# UTC on purpose: Git Bash has no zoneinfo here, so TZ=America/Chicago would
# print UTC anyway and label it Central (docs/operations.md). No colons, which
# Windows refuses in a file name.
STAMP=$(date -u +%Y-%m-%dT%H%MZ)
umask 077
mkdir -p "$OUT_ROOT"
OUT="$OUT_ROOT/misa-$STAMP"
mkdir "$OUT" || { echo "$OUT already exists; wait a minute and run again" >&2; exit 1; }

echo
echo "  Backing up project $REF"
echo "  into $OUT"
echo

# Every CLI step's output goes to backup.log, so a failure can say why.
LOG="$OUT/backup.log"

# A failed run leaves a folder that looks like a backup and is not one, so
# mark it rather than delete it: whatever did get written may still help.
trap 'touch "$OUT/INCOMPLETE"; echo "FAILED"; echo; tail -n 15 "$LOG" 2>/dev/null | sed "s/^/    /" >&2; echo; echo "  $OUT is incomplete and marked INCOMPLETE." >&2' ERR

step() { printf '  %-26s ' "$1"; }

# 🪤 `db query` reads only the FIRST LINE of its SQL, so this stays one line.
# It counts every base table in public by name rather than from a list, so a
# migration that adds a table is covered without anyone remembering this file.
COUNT_SQL="select table_schema || '.' || table_name as t, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text::bigint as n from information_schema.tables where table_type = 'BASE TABLE' and (table_schema = 'public' or (table_schema = 'auth' and table_name in ('users','identities'))) order by 1;"

step "row counts"
# 🪤 The CLI can exit 0 on a rejected query, so the JSON is checked too, as in
# the other two remote scripts.
raw=$(npx supabase db query --linked "$COUNT_SQL" </dev/null 2>&1) || true
printf '%s\n' "$raw" >>"$LOG"
python -c '
import sys, json
s = sys.stdin.read()
try:
    d = json.loads(s[s.index("{"):])
except ValueError:
    sys.exit("count query returned no JSON (is the project paused?)")
if d.get("_tag") == "Error" or "rows" not in d:
    sys.exit("count query failed: " + str(d.get("error", d))[:400])
for r in d["rows"]:
    print(r["t"] + "\t" + str(r["n"]))
' <<<"$raw" >"$OUT/counts.txt"
echo "ok"

step "migration history"
npx supabase migration list --linked </dev/null >"$OUT/migrations.txt" 2>>"$LOG"
echo "ok"

step "roles"
npx supabase db dump --linked --role-only -f "$OUT/roles.sql" </dev/null >>"$LOG" 2>&1
echo "ok"

step "schema"
npx supabase db dump --linked -f "$OUT/schema.sql" </dev/null >>"$LOG" 2>&1
echo "ok"

step "data"
npx supabase db dump --linked --data-only --use-copy -f "$OUT/data.sql" \
  -x auth.sessions,auth.refresh_tokens,auth.one_time_tokens,auth.mfa_amr_claims,auth.mfa_challenges,auth.flow_state,auth.audit_log_entries \
  </dev/null >>"$LOG" 2>&1
echo "ok"

# An exit code of 0 is not a backup. Count the rows data.sql actually carries
# for every table counts.txt names, and compare.
step "verify"
python - "$OUT/counts.txt" "$OUT/data.sql" "$OUT/schema.sql" <<'PY'
import re, sys
counts_path, data_path, schema_path = sys.argv[1:4]

expected = {}
for line in open(counts_path, encoding="utf-8"):
    t, n = line.rstrip("\n").split("\t")
    expected[t] = int(n)
if "public.members" not in expected:
    sys.exit("counts.txt has no public.members row")

found, table = {}, None
copy = re.compile(r'^COPY "([^"]+)"\."([^"]+)"')
insert = re.compile(r'^INSERT INTO "([^"]+)"\."([^"]+)"')
for line in open(data_path, encoding="utf-8"):
    if table is not None:
        if line.rstrip("\r\n") == "\\.":
            table = None
        else:
            found[table] = found.get(table, 0) + 1
        continue
    m = copy.match(line)
    if m:
        table = f"{m[1]}.{m[2]}"
        found.setdefault(table, 0)
        continue
    m = insert.match(line)
    if m:
        t = f"{m[1]}.{m[2]}"
        found[t] = found.get(t, 0) + 1

if "create table" not in open(schema_path, encoding="utf-8").read().lower():
    sys.exit("schema.sql holds no CREATE TABLE")

# A check-in landing between the count and the dump moves a number by a few,
# so a difference warns; an EMPTY table that should hold rows fails.
bad, drift = [], []
for t, n in expected.items():
    got = found.get(t, 0)
    if n > 0 and got == 0:
        bad.append(f"{t}: expected {n} rows, data.sql has none")
    elif got != n:
        drift.append(f"{t}: counted {n}, dumped {got}")
if bad:
    sys.exit("\n".join(bad))
print("ok")
for d in drift:
    print(f"    note: {d} (rows written during the backup)")
PY

trap - ERR

echo
echo "  Backed up:"
awk -F'\t' '$1 ~ /^public\.(members|events|attendance|point_adjustments|dues_payments|admin_audit)$/ || $1 == "auth.users" { printf "    %-26s %s\n", $1, $2 }' "$OUT/counts.txt"
echo
du -sh "$OUT" | awk '{ print "  " $1 " in " $2 }'
echo
