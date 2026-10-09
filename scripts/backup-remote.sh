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
# schema.sql      the project's own schemas: every table, view, function, policy
#                 and grant it defines. Supabase's managed schemas come with any
#                 new project. (To be confirmed on the first real run.)
# data.sql        every row in public, auth and storage, as COPY blocks
# counts.txt      exact row counts read just before the dump, which the script
#                 checks data.sql against, and a restore can be checked against
# migrations.txt  the remote's migration history: which repo commit's
#                 supabase/migrations/ matches schema.sql
# backup.log      the CLI's own output, for when a step fails. In a normal run
#                 it holds host and user names, never a password.
#
# A run that did not finish, for any reason, leaves an `INCOMPLETE` file in its
# folder. Never restore from a folder that has one.
#
# LEFT OUT of data.sql: auth's sessions, refresh tokens, one-time-token index,
# MFA challenges and AMR claims, PKCE flow state, and its sign-in log, which
# holds IP addresses. After a restore every officer signs in again; nothing
# else is lost. What a stolen backup DOES hold: every officer's password hash,
# any TOTP secret in auth.mfa_factors, and, in auth.users's own token columns,
# any password-reset, invite or confirmation link still unused when the backup
# ran, live until it expires (an hour by default).
#
# 🔓 Changes no club data: pg_dump only reads, and nothing here writes to a
# table. It is NOT strictly read-only on the server, though. With no database
# password in the environment, the CLI has Supabase (re)create a temporary
# login role, cli_login_postgres, whose password expires within minutes. The
# role stays listed in pg_roles afterwards, as it does after every `db push`;
# leave it, the next run recreates it. And if this machine is already banned
# from the connection pooler, the CLI lifts EVERY network ban on the project
# after its third failed attempt.
#
# 🔴 THE OUTPUT IS REAL CLUB DATA: every member's EID and email, every dues
# payment, and the officers' password hashes. THIS REPOSITORY IS PUBLIC, so
# the script refuses any output directory inside it, or (when git is
# installed) inside any other git working tree. Keep backups somewhere private (not a shared or public cloud
# folder), and delete old ones you no longer need.
#
# Needs Docker Desktop running: the CLI runs pg_dump inside a container. Needs
# no database password: the CLI has Supabase create a temporary login role
# (above).
#
# --- Restoring -------------------------------------------------------------
#
# ⚠️ UNTESTED. tasks.md §Backups step 3 replaces these commands with ones that
# worked. Until then, do not follow the second recipe in an emergency.
#
# Into a NEW project (lost or deleted project, or a handoff), per Supabase's
# migration guide, with the new project's connection string in $DB_URL:
#
#   psql --single-transaction --variable ON_ERROR_STOP=1 \
#        --file roles.sql --file schema.sql \
#        --command 'SET session_replication_role = replica' \
#        --file data.sql --dbname "$DB_URL"
#
# Then record the migration history, which data.sql does not carry:
# `npx supabase migration repair --status applied <version>` for every version
# in migrations.txt, against the NEW project, before any `db push`.
#
# Into the SAME project after rows were lost, do not run data.sql whole: it
# would collide with every row still there. Load it into the local stack first
# (`npx supabase db reset`, then the psql line above against
# postgresql://postgres:postgres@127.0.0.1:54322/postgres), find what is
# missing, and copy back only that. Do it before officers write more rows.
set -euo pipefail

# Debug output would carry connection details into backup.log.
[ -z "${SUPABASE_DEBUG:-}" ] || { echo "unset SUPABASE_DEBUG first: debug output would go into backup.log" >&2; exit 1; }

REPO=$(cd "$(dirname "$0")/.." && pwd -P)
OUT_ROOT=${1:-${MISA_BACKUP_DIR:-$HOME/misa-backups}}

# The auth tables left out of data.sql. ONE list, used by the dump's -x and by
# the verify step, so the two cannot drift.
EXCLUDED_TABLES="auth.sessions,auth.refresh_tokens,auth.one_time_tokens,auth.mfa_amr_claims,auth.mfa_challenges,auth.flow_state,auth.audit_log_entries"

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

# A second guard, on the folder as git sees it: this catches what the Python
# check above cannot, such as the repository reached through a UNC loopback
# share (//localhost/C$/...), and any other clone. Checked before INCOMPLETE is
# written, so the folder is still empty and rmdir succeeds.
# safe.directory='*' so a repository git calls "dubious ownership" (owned by
# another user) is refused too, rather than read as "not a work tree". With no
# git installed, the command fails and this check is skipped.
if git -c safe.directory='*' -C "$OUT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  rmdir "$OUT"
  echo "refusing: $OUT is inside a git working tree" >&2
  exit 1
fi

# The folder is marked INCOMPLETE from the start, and the marker comes off only
# after verify passes. So a run that stops for ANY reason (a failed step,
# Ctrl-C, a closed window) leaves it, not only one the ERR trap sees.
touch "$OUT/INCOMPLETE"

echo
echo "  Backing up project $REF"
echo "  into $OUT"
echo

# Every CLI step's output goes to backup.log, so a failure can say why.
LOG="$OUT/backup.log"

trap 'echo "FAILED"; echo; tail -n 15 "$LOG" 2>/dev/null | sed "s/^/    /" >&2; echo; echo "  $OUT is incomplete and marked INCOMPLETE." >&2' ERR

step() { printf '  %-26s ' "$1"; }

# Which CLI made this backup, for whoever restores it.
npx supabase --version >>"$LOG" 2>&1

# 🪤 `db query` reads only the FIRST LINE of its SQL, so this stays one line.
# It counts every base table in public by name rather than from a list, so a
# migration that adds a table is covered without anyone remembering this file.
COUNT_SQL="select table_schema || '.' || table_name as t, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text::bigint as n from information_schema.tables where table_type = 'BASE TABLE' and (table_schema = 'public' or (table_schema = 'auth' and table_name in ('users','identities'))) order by 1;"

step "row counts"
# 🪤 Ask for JSON, and say this is not an agent. The shape `db query` prints
# depends on whether the CLI thinks an AI agent is running it (CLI 2.120.0):
#   in a terminal       a box-drawn TABLE, unless --output-format json, which
#                       gives a bare array: [{"n": 4, "t": "auth.users"}, ...]
#   under an agent      {"boundary": ..., "rows": [...], "warning": ...},
#                       whatever the flag
#   a rejected query    exit 1, and {"_tag":"Error","error":{...}} with the
#                       flag (plain text without it, in a terminal)
# The first real run, 2026-10-09, got the table and stopped here. Both flags
# are passed so every run gets the bare array; the parser still takes the
# agent envelope. The exit code and the JSON are BOTH checked, and anything
# else fails closed. stdout only: the CLI's "Connecting..." goes to the log.
rc=0
raw=$(npx supabase db query --linked --agent=no --output-format json "$COUNT_SQL" </dev/null 2>>"$LOG") || rc=$?
printf '%s\n' "$raw" >>"$LOG"
python -c '
import sys, json
rc, s = int(sys.argv[1]), sys.stdin.read()
where = "exit code %d; see backup.log" % rc
starts = [i for i in (s.find("["), s.find("{")) if i >= 0]
if not starts:
    sys.exit("count query returned no JSON row set (" + where + ")")
try:
    # raw_decode stops at the end of the JSON value, so anything printed
    # after it does not break the parse.
    d, _ = json.JSONDecoder().raw_decode(s, min(starts))
except ValueError:
    sys.exit("count query returned no JSON row set (" + where + ")")
if isinstance(d, dict):
    if d.get("_tag") == "Error" or "error" in d:
        sys.exit("count query failed: " + str(d.get("error", d))[:400])
    d = d.get("rows")
if rc != 0:
    sys.exit("count query failed (" + where + ")")
if not isinstance(d, list) or not d:
    sys.exit("count query returned no JSON row set (" + where + ")")
for r in d:
    if not isinstance(r, dict) or "t" not in r or "n" not in r:
        sys.exit("count query returned an unexpected row: " + str(r)[:200])
    print(str(r["t"]) + "\t" + str(int(r["n"])))
' "$rc" <<<"$raw" >"$OUT/counts.txt"
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
  -x "$EXCLUDED_TABLES" \
  </dev/null >>"$LOG" 2>&1
echo "ok"

# An exit code of 0 is not a backup. Count the rows data.sql actually carries
# for every table counts.txt names, and compare.
step "verify"
python - "$OUT/counts.txt" "$OUT/data.sql" "$OUT/schema.sql" \
         "$OUT/migrations.txt" "$OUT/roles.sql" "$EXCLUDED_TABLES" <<'PY'
import os, re, sys
counts_path, data_path, schema_path, migrations_path, roles_path, excluded = sys.argv[1:7]
excluded = {t.strip() for t in excluded.split(",") if t.strip()}

expected = {}
for line in open(counts_path, encoding="utf-8"):
    t, n = line.rstrip("\n").split("\t")
    expected[t] = int(n)
if "public.members" not in expected:
    sys.exit("counts.txt has no public.members row")

if not re.search(r"\b\d{14}\b", open(migrations_path, encoding="utf-8").read()):
    sys.exit("migrations.txt names no migration version")
if os.path.getsize(roles_path) == 0:
    sys.exit("roles.sql is empty")

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

leaked = sorted(excluded & found.keys())
if leaked:
    sys.exit("data.sql holds tables that must be left out: " + ", ".join(leaked))

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

rm -f "$OUT/INCOMPLETE"
trap - ERR

echo
echo "  Row counts at the start of the backup:"
awk -F'\t' '$1 ~ /^public\.(members|events|attendance|point_adjustments|dues_payments|admin_audit)$/ || $1 == "auth.users" { printf "    %-26s %s\n", $1, $2 }' "$OUT/counts.txt"
echo
du -sh "$OUT" | awk '{ print "  " $1 " in " $2 }'
echo
