-- Grant specific accounts UNLIMITED credits (e.g. your own / admin accounts).
-- Run in the Supabase SQL Editor after credits.sql.

-- 1. Flag column.
alter table public.user_profiles
  add column if not exists unlimited boolean not null default false;

-- 2. consume_credit() skips decrement for unlimited accounts.
create or replace function public.consume_credit()
returns int language plpgsql security definer
set search_path = public as $$
declare
  new_balance int;
  is_unlimited boolean;
begin
  select unlimited, credits into is_unlimited, new_balance
    from public.user_profiles where id = auth.uid();

  if coalesce(is_unlimited, false) then
    return 999999;  -- effectively infinite; balance is never reduced
  end if;

  update public.user_profiles
    set credits = credits - 1
    where id = auth.uid() and credits > 0
    returning credits into new_balance;
  if not found then
    return -1;
  end if;
  return new_balance;
end;
$$;

-- 3. Users must NOT be able to flip this themselves from the browser.
revoke update (unlimited) on public.user_profiles from authenticated, anon;

-- 4. Make YOUR account unlimited. Use the email you actually sign in with.
update public.user_profiles
  set unlimited = true, credits = 999999
  where id in (select id from auth.users where email = 'qichengf@gmail.com');
