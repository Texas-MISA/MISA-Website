#!/usr/bin/env bash
# Wipe the linked project's CLUB DATA, keeping officer access and the
# officer-turnover trail. This is the "we are done testing, real data starts
# now" button, and it is the opposite of scripts/seed-remote.sh: that one
# replaces the database with fabricated fixtures, this one empties it.
#
# --- What goes, what stays -------------------------------------------------
#
# DELETED   members, events, attendance, point_adjustments, dues_payments,
#           member_field_definitions, member_filter_presets, the admin_audit
#           rows about any of those, and the fabricated seed.officer account.
#
# KEPT      auth.users + admin_profiles for every real officer — sign-ins are
#           never touched, so nobody has to be re-invited;
#           officer_invites, whole;
#           the admin_audit rows whose entity_type is 'officer_invite' or
#           'officer' — the record of who was granted access and by whom. That
#           trail is append-only and is not test data, so wiping it would
#           destroy the only evidence of how the current officers got in.
#
# UNTOUCHED app_settings. current_term is CONFIGURATION, not data: a wipe that
#           silently unpinned a term an officer had deliberately set would be
#           the kind of drift this repo keeps getting bitten by. The value is
#           printed below instead, because it decides which term the public
#           leaderboard is about to be empty for.
#
#           checkin_throttle. IP-keyed rate-limit state on a ten-minute window,
#           same call seed.sql makes — it is not seed data and it expires on
#           its own.
#
# 📌 That accounts for all twelve tables in `public`. Keep it that way: per the
# rule seed.sql's wipe list carries, a table missing from this accounting is
# drift nobody can see. Any migration adding a table has to decide which of the
# four groups above it lands in.
#
# ⚠️ THE LINKED PROJECT IS PRODUCTION — the club's live site reads it. The
# public leaderboard goes empty the moment this finishes, and there is no undo.
#
# --- Why the SQL is shaped the way it is -----------------------------------
#
# `supabase db query` reads only the FIRST LINE of its argument, so every step
# below is one line no matter how many statements it holds. That is load-
# bearing for the audit step in particular: its three statements ship in one
# call so Postgres runs them in one implicit transaction, and a failed delete
# rolls the `disable trigger` back with it rather than leaving admin_audit
# permanently unguarded.
#
# Delete order is FK order, not preference. dues_payments.member_id is
# ON DELETE RESTRICT, so it must precede members or the members delete raises.
set -euo pipefail

SEED_OFFICER='00000000-0000-4000-8000-5eed00000001'

REF=$(npx supabase projects list --output json 2>/dev/null \
      | python -c "import sys,json;print(next((p['id'] for p in json.load(sys.stdin) if p.get('linked')),''))" 2>/dev/null || true)
[ -n "$REF" ] || { echo "could not determine the linked project ref; refusing to wipe" >&2; exit 1; }

echo
echo "  ⚠️  About to WIPE THE CLUB DATA on the linked project."
echo "      project ref : $REF"
echo "      currently holds:"
npx supabase db query --linked \
  "select (select count(*) from members) members, (select count(*) from events) events, (select count(*) from attendance) attendance, (select count(*) from point_adjustments) adjustments, (select count(*) from dues_payments) dues, (select count(*) from member_field_definitions) field_defs, (select count(*) from admin_audit) audit_rows, (select count(*) from admin_profiles) officers, (select coalesce(current_term, '(unpinned, derived: ' || current_term() || ')') from app_settings) current_term;" \
  </dev/null 2>/dev/null | sed -n -e '/"boundary"/d' -e '/"warning"/d' -e '/"rows"/d' -e 's/^ *"\([a-z_]*\)": *\(.*\)$/        \1 = \2/p' | sed 's/,$//' || true
echo
echo "      SURVIVES: officer sign-ins, officer_invites, and the admin_audit"
echo "                rows about invites and officer access."
echo "      GONE:     every member, event, attendance row, point adjustment,"
echo "                dues payment, custom field and saved view. No undo."
printf "      Type the project ref to continue: "
read -r CONFIRM
[ "$CONFIRM" = "$REF" ] || { echo "      mismatch — nothing was changed."; exit 1; }
echo

# label|sql — split on the first pipe. Read into an array before running
# anything, so the loop body's npx calls cannot eat the heredoc.
STEPS=()
while IFS= read -r line; do
  [ -z "$line" ] && continue
  case "$line" in \#*) continue ;; esac
  STEPS+=("$line")
done <<'PLAN'
point adjustments|delete from point_adjustments;
attendance|delete from attendance;
dues payments|delete from dues_payments;
events|delete from events;
saved filter presets|delete from member_filter_presets;
custom field definitions|delete from member_field_definitions;
members|delete from members;
audit rows about test data|alter table admin_audit disable trigger admin_audit_no_delete; delete from admin_audit where entity_type not in ('officer_invite','officer'); alter table admin_audit enable trigger admin_audit_no_delete;
fabricated seed officer|delete from auth.users where id = '00000000-0000-4000-8000-5eed00000001'::uuid;
verify|do $$ declare n int; begin select (select count(*) from members)+(select count(*) from events)+(select count(*) from attendance)+(select count(*) from point_adjustments)+(select count(*) from dues_payments)+(select count(*) from member_field_definitions)+(select count(*) from member_filter_presets) into n; if n <> 0 then raise exception 'wipe incomplete: % club rows remain', n; end if; if exists (select 1 from admin_audit where entity_type not in ('officer_invite','officer')) then raise exception 'admin_audit still holds test-data rows'; end if; if not exists (select 1 from admin_profiles) then raise exception 'no officer profile survives - refusing to report success'; end if; if exists (select 1 from auth.users where id = '00000000-0000-4000-8000-5eed00000001') then raise exception 'seed officer survived the wipe'; end if; if not exists (select 1 from pg_trigger where tgname = 'admin_audit_no_delete' and tgenabled <> 'D') then raise exception 'admin_audit_no_delete was left DISABLED'; end if; end $$;
PLAN

for step in "${STEPS[@]}"; do
  label="${step%%|*}"
  sql="${step#*|}"
  printf '  %-28s ' "$label"
  # 🪤 The CLI can exit 0 on a rejected query, so the JSON is checked too —
  # same reason scripts/seed-remote.sh does it.
  if out=$(npx supabase db query --linked "$sql" </dev/null 2>&1) && ! grep -q '"_tag":"Error"' <<<"$out"; then
    echo "ok"
  else
    echo "FAILED"
    python -c "import sys,json,re; s=sys.stdin.read(); m=re.search(r'\{',s); d=json.loads(s[m.start():]); print('  ' + d['error']['message'][:400])" <<<"$out" 2>/dev/null || echo "$out" | head -5
    exit 1
  fi
done

echo
echo "  wiped. what remains:"
npx supabase db query --linked \
  "select (select count(*) from members) members, (select count(*) from events) events, (select count(*) from attendance) attendance, (select count(*) from dues_payments) dues, (select count(*) from admin_audit) audit_rows, (select count(*) from officer_invites) invites, (select count(*) from admin_profiles) officers, (select coalesce(current_term, '(unpinned, derived: ' || current_term() || ')') from app_settings) current_term;" \
  </dev/null 2>/dev/null | sed -n -e '/"boundary"/d' -e '/"warning"/d' -e '/"rows"/d' -e 's/^ *"\([a-z_]*\)": *\(.*\)$/        \1 = \2/p' | sed 's/,$//' || true
echo
