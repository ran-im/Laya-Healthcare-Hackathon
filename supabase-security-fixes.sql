-- Supabase security hardening for linter findings
-- Run in Supabase SQL Editor against the target project.

begin;

-- 1) Lock function search_path for SECURITY DEFINER / helper functions
alter function public.handle_updated_at() set search_path = public, pg_temp;
alter function public.log_claim_status_change() set search_path = public, pg_temp;
alter function public.current_user_role() set search_path = public, pg_temp;

-- 2) Replace permissive notifications insert policy with scoped access
-- Existing live policy flagged by linter: notif_insert_all
drop policy if exists notif_insert_all on public.notifications;
drop policy if exists "staff can insert notifications" on public.notifications;
drop policy if exists "users can insert own notifications" on public.notifications;

-- Staff can create notifications for any user
create policy "staff can insert notifications"
on public.notifications
for insert
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('assessor', 'admin', 'fraud')
  )
);

-- Members can create notifications only for themselves.
-- This preserves current frontend behavior on claim submit.
create policy "users can insert own notifications"
on public.notifications
for insert
with check (auth.uid() = user_id);

commit;

begin;

-- 3) Ensure claim_status_history has policies in the live database
drop policy if exists "members can read own claim status history" on public.claim_status_history;
drop policy if exists "staff can read all claim status history" on public.claim_status_history;
drop policy if exists "staff can insert claim status history" on public.claim_status_history;

create policy "members can read own claim status history"
on public.claim_status_history
for select
using (
  exists (
    select 1
    from public.claims c
    where c.id = claim_status_history.claim_id
      and c.member_id = auth.uid()
  )
);

create policy "staff can read all claim status history"
on public.claim_status_history
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('assessor', 'admin', 'fraud')
  )
);

create policy "staff can insert claim status history"
on public.claim_status_history
for insert
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('assessor', 'admin', 'fraud')
  )
);

-- 4) Ensure claim_rule_results has policies in the live database
drop policy if exists "members can read own claim rule results" on public.claim_rule_results;
drop policy if exists "staff can read all claim rule results" on public.claim_rule_results;

create policy "members can read own claim rule results"
on public.claim_rule_results
for select
using (
  exists (
    select 1
    from public.claims c
    where c.id = claim_rule_results.claim_id
      and c.member_id = auth.uid()
  )
);

create policy "staff can read all claim rule results"
on public.claim_rule_results
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('assessor', 'admin', 'fraud')
  )
);

commit;
