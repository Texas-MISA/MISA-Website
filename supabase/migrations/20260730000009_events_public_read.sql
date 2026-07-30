-- Public read access to the schedule (§6): "anon role can select only from
-- leaderboard and published events." The leaderboard half is already covered
-- by the owner-run view; this is the events half, pulled forward from Stage 8
-- because the Stage 2 landing page is the first consumer.
--
-- Drafts and cancelled events stay invisible — the policy is the boundary,
-- not the page's where-clause. Events carry no member PII (§4.4's concern);
-- created_by is an auth.users uuid, which the anon key cannot resolve to
-- anything. Writes remain deny-all: this policy is `for select` only.

create policy events_public_read
  on public.events
  for select
  to anon, authenticated
  using (status = 'published');
