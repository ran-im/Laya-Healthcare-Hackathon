-- ≡≡≡ RLS POLICIES FOR LAYA HEALTHCARE ≡≡≡
-- Apply these policies in Supabase SQL Editor
-- Enables: members see own claims, staff see all, proper isolation

-- ─────────────────────────────────────────
-- ADD MISSING COLUMNS TO PROFILES
-- ─────────────────────────────────────────
alter table public.profiles add column if not exists member_id text;
alter table public.profiles add column if not exists policy_id text;

-- Set demo member data
update public.profiles
set member_id = 'M-1001',
    policy_id = 'P-2001'
where email = 'member@laya-demo.com';

-- ─────────────────────────────────────────
-- ENABLE RLS on all tables
-- ─────────────────────────────────────────
alter table public.claims enable row level security;
alter table public.claim_documents enable row level security;
alter table public.notifications enable row level security;
alter table public.claim_status_history enable row level security;
alter table public.claim_rule_results enable row level security;

-- ─────────────────────────────────────────
-- CLAIMS TABLE POLICIES
-- ─────────────────────────────────────────

-- Members can read their own claims
create policy "members can read own claims"
on public.claims
for select
using (auth.uid() = member_id);

-- Staff (assessor, admin, fraud) can read all claims
create policy "staff can read all claims"
on public.claims
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('assessor', 'admin', 'fraud')
  )
);

-- Staff can update claims
create policy "staff can update claims"
on public.claims
for update
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('assessor', 'admin', 'fraud')
  )
);

-- Members can insert their own claims
create policy "members can insert claims"
on public.claims
for insert
with check (auth.uid() = member_id);

-- ─────────────────────────────────────────
-- CLAIM_DOCUMENTS TABLE POLICIES
-- ─────────────────────────────────────────

-- Members can read documents for their own claims
create policy "members can read own claim documents"
on public.claim_documents
for select
using (
  exists (
    select 1
    from public.claims c
    where c.id = claim_documents.claim_id
      and c.member_id = auth.uid()
  )
);

-- Staff can read all claim documents
create policy "staff can read all claim documents"
on public.claim_documents
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('assessor', 'admin', 'fraud')
  )
);

-- Members can insert documents for their own claims
create policy "members can insert claim documents"
on public.claim_documents
for insert
with check (
  exists (
    select 1
    from public.claims c
    where c.id = claim_documents.claim_id
      and c.member_id = auth.uid()
  )
);

-- ─────────────────────────────────────────
-- NOTIFICATIONS TABLE POLICIES
-- ─────────────────────────────────────────

-- Users can read their own notifications
create policy "users can read own notifications"
on public.notifications
for select
using (auth.uid() = user_id);

-- Staff can insert notifications
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

-- Users can insert notifications only for themselves
create policy "users can insert own notifications"
on public.notifications
for insert
with check (auth.uid() = user_id);

-- ─────────────────────────────────────────
-- CLAIM_STATUS_HISTORY TABLE POLICIES
-- ─────────────────────────────────────────

-- Members can read status history for their own claims
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

-- Staff can read all status history
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

-- Staff can insert status history
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

-- ─────────────────────────────────────────
-- CLAIM_RULE_RESULTS TABLE POLICIES
-- ─────────────────────────────────────────

-- Members can read rule results for their own claims (summary only)
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

-- Staff can read all rule results
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

-- FastAPI (service) can insert rule results (backend process)
-- For now, disable until you add service role key
-- create policy "service can insert rule results"
-- on public.claim_rule_results
-- for insert
-- using (auth.jwt() ->> 'role' = 'authenticated');
