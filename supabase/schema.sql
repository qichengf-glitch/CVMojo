-- Run in Supabase SQL Editor (see README)

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  location text,
  resume_file_name text,
  resume_text text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.user_profiles add column if not exists resume_file_name text;
alter table public.user_profiles add column if not exists resume_text text;
alter table public.user_profiles add column if not exists onboarding_completed boolean default false;
alter table public.user_profiles add column if not exists onboarding_skipped boolean default false;

create table public.work_experience (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company text not null,
  title text not null,
  start_date text,
  end_date text,
  currently_working boolean default false,
  bullets text[] default '{}',
  sort_order int default 0,
  created_at timestamptz default now()
);

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  sort_order int default 0
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  bullets text[] default '{}',
  sort_order int default 0,
  created_at timestamptz default now()
);

create table public.education (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  school text not null,
  degree text,
  field text,
  graduation_date text,
  sort_order int default 0
);

create table public.generated_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company text,
  language text,
  doc_type text,
  content text,
  created_at timestamptz default now()
);

alter table public.user_profiles enable row level security;
alter table public.work_experience enable row level security;
alter table public.skills enable row level security;
alter table public.projects enable row level security;
alter table public.education enable row level security;
alter table public.generated_documents enable row level security;

create policy "own profile" on public.user_profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "own work" on public.work_experience
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own skills" on public.skills
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own projects" on public.projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own education" on public.education
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own docs" on public.generated_documents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.user_profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
