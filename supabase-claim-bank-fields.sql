-- Add bank reimbursement fields to claims so they persist across re-evaluation flows.
-- Run in Supabase SQL Editor before deploying the frontend changes that write these columns.

begin;

alter table public.claims add column if not exists account_holder_name text;
alter table public.claims add column if not exists iban text;
alter table public.claims add column if not exists bic text;

commit;
