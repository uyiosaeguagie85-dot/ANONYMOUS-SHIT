-- Run this in Supabase Dashboard > SQL Editor.
-- Admin rights are granted by a database row, not by client-side email checks.

create extension if not exists pgcrypto;

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null default '',
  media_url text,
  media_type text check (media_type in ('image','video') or media_type is null),
  likes_count integer not null default 0 check (likes_count >= 0),
  comments_count integer not null default 0 check (comments_count >= 0),
  is_removed boolean not null default false,
  created_at timestamptz not null default now(),
  constraint post_has_content check (length(trim(body)) > 0 or media_url is not null),
  constraint post_body_length check (length(body) <= 2000)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 1000),
  is_removed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (length(trim(reason)) between 1 and 240),
  status text not null default 'open' check (status in ('open','resolved')),
  created_at timestamptz not null default now(),
  unique (post_id, reporter_id)
);

-- Only a project owner should add rows to this table using the SQL editor.
create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.app_admins a
    where a.user_id = (select auth.uid())
  );
$$;

alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.reports enable row level security;
alter table public.app_admins enable row level security;

drop policy if exists "public can read active posts" on public.posts;
create policy "public can read active posts" on public.posts
for select using (is_removed = false or public.is_admin() or user_id = (select auth.uid()));

drop policy if exists "authenticated users can create posts" on public.posts;
create policy "authenticated users can create posts" on public.posts
for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "owners and admins can update posts" on public.posts;
create policy "owners and admins can update posts" on public.posts
for update to authenticated using (user_id = (select auth.uid()) or public.is_admin())
with check (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists "read active comments" on public.comments;
create policy "read active comments" on public.comments
for select using (is_removed = false or public.is_admin() or user_id = (select auth.uid()));

drop policy if exists "create own comments" on public.comments;
create policy "create own comments" on public.comments
for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "owners and admins update comments" on public.comments;
create policy "owners and admins update comments" on public.comments
for update to authenticated using (user_id = (select auth.uid()) or public.is_admin())
with check (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists "users can submit reports" on public.reports;
create policy "users can submit reports" on public.reports
for insert to authenticated with check (reporter_id = (select auth.uid()));

drop policy if exists "admins can review reports" on public.reports;
create policy "admins can review reports" on public.reports
for select to authenticated using (public.is_admin());

drop policy if exists "admins can resolve reports" on public.reports;
create policy "admins can resolve reports" on public.reports
for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "users can only see their own admin status" on public.app_admins;
create policy "users can only see their own admin status" on public.app_admins
for select to authenticated using (user_id = (select auth.uid()));

-- Public media bucket for MVP. Add file size and MIME restrictions in Storage settings.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-media', 'post-media', true, 52428800, array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'])
on conflict (id) do nothing;

drop policy if exists "signed-in users upload media to own folder" on storage.objects;
create policy "signed-in users upload media to own folder" on storage.objects
for insert to authenticated with check (
  bucket_id = 'post-media' and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "public reads post media" on storage.objects;
create policy "public reads post media" on storage.objects
for select using (bucket_id = 'post-media');

-- Safe atomic like increment function; only the count is exposed.
create or replace function public.increment_post_likes(post_id uuid)
returns void language sql security invoker
set search_path = ''
as $$
  update public.posts set likes_count = likes_count + 1
  where id = post_id and is_removed = false;
$$;
grant execute on function public.increment_post_likes(uuid) to anon, authenticated;

-- Admin setup:
-- 1. Sign in to GhostPost using Google once, with the intended admin account.
-- 2. Find that user in Supabase Dashboard > Authentication > Users.
-- 3. Copy the UUID and run this query with that UUID:
-- insert into public.app_admins (user_id) values ('PASTE_AUTH_USER_UUID_HERE');
-- Never put a service-role key in the frontend or a public GitHub repository.
