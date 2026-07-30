-- Per-IP rate limiting for the public check-in action (§6: "Honeypot field,
-- per-IP rate limit on the check-in action"). A table rather than in-memory
-- state (which dies per-instance on serverless) or an external KV (a new
-- service to hand over, against §2.3). IPs are stored as SHA-256 hashes, not
-- raw addresses; rows are pruned opportunistically by the action itself.
--
-- Deny-all RLS like every table: only the service-role client in the check-in
-- Server Action touches it. The threat model is casual abuse (§6) — the limit
-- is deliberately generous because an event venue's NAT can put a whole room
-- of legitimate members behind one IP.

create table public.checkin_throttle (
  id           bigint generated always as identity primary key,
  ip_hash      text not null,
  submitted_at timestamptz not null default now()
);

create index checkin_throttle_ip_idx
  on public.checkin_throttle (ip_hash, submitted_at);

alter table public.checkin_throttle enable row level security;
