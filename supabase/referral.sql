-- Referral system: each NEW person who signs up via your referral link grants
-- you +10 credits. Unlimited referrals (each distinct referred user counts once).
-- Run in the Supabase SQL Editor after credits.sql.

create table if not exists public.referrals (
  referred_user_id uuid primary key references auth.users(id) on delete cascade,
  referrer_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

alter table public.referrals enable row level security;
-- No client policy: only the SECURITY DEFINER function below touches this table.

-- Called by the referred (new) user, passing the referrer's id (from the ?ref=
-- link). Grants the referrer +10 once per distinct referred user.
create or replace function public.claim_referral(referrer uuid)
returns boolean language plpgsql security definer
set search_path = public as $$
declare is_anon boolean;
begin
  if referrer is null or referrer = auth.uid() then
    return false;
  end if;

  -- Only count real (non-anonymous) signups, to limit trivial farming.
  is_anon := coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
  if is_anon then
    return false;
  end if;

  if not exists (select 1 from public.user_profiles where id = referrer) then
    return false;
  end if;

  insert into public.referrals (referred_user_id, referrer_id)
    values (auth.uid(), referrer)
    on conflict (referred_user_id) do nothing;

  if not found then
    return false;  -- this user was already referred before
  end if;

  update public.user_profiles set credits = credits + 10 where id = referrer;
  return true;
end;
$$;

grant execute on function public.claim_referral(uuid) to authenticated, anon;
