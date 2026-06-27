-- Credits, signup bonus, and survey reward system.
-- Run this in the Supabase SQL Editor AFTER schema.sql.
--
-- Model:
--   * Guest (anonymous) users start with 3 credits.
--   * Registered users (email / Google) get 30 credits (one-time signup bonus).
--   * Completing the feedback survey grants +10 credits (one time).
--   * Each full generation costs 1 credit. Refining keywords is free.
--
-- Security: credit columns can ONLY be changed through the SECURITY DEFINER
-- functions below. Direct UPDATEs to these columns by users are revoked, so a
-- user cannot give themselves credits from the browser.

-- 1. Columns -----------------------------------------------------------------
alter table public.user_profiles
  add column if not exists credits int not null default 3;
alter table public.user_profiles
  add column if not exists signup_bonus_granted boolean not null default false;
alter table public.user_profiles
  add column if not exists survey_completed boolean not null default false;

-- 2. New-user trigger: anonymous => 3 credits, registered => 30 ---------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.user_profiles (id, email, credits, signup_bonus_granted)
  values (
    new.id,
    new.email,
    case when coalesce(new.is_anonymous, false) then 3 else 30 end,
    case when coalesce(new.is_anonymous, false) then false else true end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 3. Survey responses table --------------------------------------------------
create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  answers jsonb not null default '{}',
  created_at timestamptz default now()
);

alter table public.survey_responses enable row level security;

drop policy if exists "own survey" on public.survey_responses;
create policy "own survey" on public.survey_responses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4. Credit functions (SECURITY DEFINER) -------------------------------------
-- Consume one credit atomically. Returns the new balance, or -1 if the user
-- had no credits left.
create or replace function public.consume_credit()
returns int language plpgsql security definer
set search_path = public as $$
declare new_balance int;
begin
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

-- Give back one credit (used if a generation fails after consuming).
create or replace function public.refund_credit()
returns int language plpgsql security definer
set search_path = public as $$
declare new_balance int;
begin
  update public.user_profiles
    set credits = credits + 1
    where id = auth.uid()
    returning credits into new_balance;
  return coalesce(new_balance, 0);
end;
$$;

-- Grant the 30-credit signup bonus once, only to non-anonymous users. Safe to
-- call on every load; it no-ops after the first grant or for guests.
create or replace function public.grant_signup_bonus()
returns int language plpgsql security definer
set search_path = public as $$
declare
  new_balance int;
  is_anon boolean;
begin
  is_anon := coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
  if is_anon then
    select credits into new_balance from public.user_profiles where id = auth.uid();
    return coalesce(new_balance, 0);
  end if;

  update public.user_profiles
    set credits = greatest(credits, 30), signup_bonus_granted = true
    where id = auth.uid() and signup_bonus_granted = false
    returning credits into new_balance;

  if not found then
    select credits into new_balance from public.user_profiles where id = auth.uid();
  end if;
  return coalesce(new_balance, 0);
end;
$$;

-- Grant the +10 survey reward once.
create or replace function public.grant_survey_bonus()
returns int language plpgsql security definer
set search_path = public as $$
declare new_balance int;
begin
  update public.user_profiles
    set credits = credits + 10, survey_completed = true
    where id = auth.uid() and survey_completed = false
    returning credits into new_balance;
  if not found then
    select credits into new_balance from public.user_profiles where id = auth.uid();
  end if;
  return coalesce(new_balance, 0);
end;
$$;

-- 5. Lock down direct credit edits ------------------------------------------
-- Users may still update their normal profile fields, but not credit columns.
revoke update (credits, signup_bonus_granted, survey_completed)
  on public.user_profiles from authenticated, anon;

-- Allow calling the functions.
grant execute on function public.consume_credit() to authenticated, anon;
grant execute on function public.refund_credit() to authenticated, anon;
grant execute on function public.grant_signup_bonus() to authenticated, anon;
grant execute on function public.grant_survey_bonus() to authenticated, anon;
