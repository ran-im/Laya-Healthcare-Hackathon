# RLS & Role Setup Guide

## Role Values (Standardized)

Your application uses these roles in `profiles.role`:

| Role | Access | Usage |
|------|--------|-------|
| `member` | Own claims only | Default for members |
| `assessor` | All claims + decision | Manual reviewers |
| `admin` | All claims + analytics | Administrators |
| `fraud` | All claims + full trace | Fraud investigators |

## Implementation Steps

### Step 1: Verify Profiles Schema
Ensure your `profiles` table has a `role` column:

```sql
-- Check existing column
select column_name, data_type 
from information_schema.columns 
where table_name = 'profiles' and column_name = 'role';

-- If missing, add it
alter table public.profiles 
add column role text default 'member' not null;
```

### Step 2: Set Default Role for New Users
Create a trigger in Supabase to auto-assign role on signup:

```sql
-- Create function to set default role
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', 'member');
  return new;
end;
$$;

-- Create trigger on auth.users
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

### Step 3: Apply RLS Policies
1. Copy the SQL from [rls-policies.sql](/rls-policies.sql)
2. Open Supabase Dashboard → SQL Editor
3. Paste and execute all statements
4. Verify no errors

### Step 4: Test Access Control
```sql
-- Test as member (member_id = their own ID)
select * from public.claims 
where member_id = auth.uid();

-- Test as assessor (requires role = 'assessor')
-- Should see all claims in their jurisdiction
```

### Step 5: Assign Staff Roles
Manually or via admin API, update user roles:

```sql
-- Make user an assessor
update public.profiles 
set role = 'assessor' 
where id = 'user-uuid-here';

-- Make user an admin
update public.profiles 
set role = 'admin' 
where id = 'user-uuid-here';

-- Make user a fraud investigator
update public.profiles 
set role = 'fraud' 
where id = 'user-uuid-here';
```

## Role-Based Access Matrix

| Table | Member | Assessor | Fraud | Admin |
|-------|--------|----------|-------|-------|
| `claims` | Select own | Select all, Update | Select all, Update | Select all, Update |
| `claim_documents` | Select own | Select all | Select all | Select all |
| `claim_status_history` | Select own | Select all, Insert | Select all, Insert | Select all, Insert |
| `claim_rule_results` | Select own | Select all | Select all | Select all |
| `notifications` | Select own | Insert | Insert | Insert |

## Code Compliance

✅ **Middleware** (`src/middleware.ts`) — Uses correct roles
✅ **Assessor Dashboard** (`assessor-dashboard.tsx:137`) — Checks `role === 'member'` to block them
✅ **Login Page** (`login/page.tsx:32-33`) — Routes by role correctly

## Testing Realtime + RLS Together

```typescript
// In your component:
const { data: { user } } = await supabase.auth.getUser()

// Following RLS policies, should only see:
// - If member: own claims
// - If staff: all claims
const { data: claims } = await supabase
  .from('claims')
  .select('*')
  .order('created_at', { ascending: false })
```

## Common Issues

**"Permission denied" error on claims table?**
- Ensure RLS is **enabled** on the table
- Check user's `profile.role` matches one of the allowed roles

**Service role (FastAPI) can't insert claim_rule_results?**
- Use Supabase service role key for backend operations
- Bypass RLS with: `supabase.admin.from('claim_rule_results').insert(...)`

**Member sees other members' claims?**
- Check `member_id` column exists and is populated
- Verify RLS policy uses `auth.uid() = member_id`

## Deployment Checklist

- [ ] Profiles table has `role` column
- [ ] RLS policies file executed (all 15+ policies)
- [ ] Test as member user
- [ ] Test as assessor user  
- [ ] Test as admin/fraud user
- [ ] Realtime still works after RLS enabled
- [ ] Notification trigger working
