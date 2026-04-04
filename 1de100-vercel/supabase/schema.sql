-- ============================================
-- 1 DE 100 — Supabase Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── PROFILES ───
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text default 'Nuevo Atleta',
  avatar_url text,
  created_at timestamptz default now(),
  push_subscription jsonb,        -- Web Push subscription object
  notification_hour smallint default 20, -- hora preferida para recordatorio (0-23)
  streak int default 0,
  max_streak int default 0,
  total_sessions int default 0,
  days_at_100 int default 0
);

alter table public.profiles enable row level security;
create policy "Users can read own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);
-- Allow reading other profiles (for friends/challenges)
create policy "Users can read any profile" on public.profiles for select using (true);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', 'Nuevo Atleta'));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── DAILY ACTIVITIES (exercise logs) ───
create table public.activities (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  exercise_id text not null,           -- e.g. "sentadillas"
  reps int not null default 0,
  logged_at timestamptz default now(),
  day date default current_date        -- for easy daily grouping
);

create index idx_activities_user_day on public.activities(user_id, day);

alter table public.activities enable row level security;
create policy "Users can read own activities" on public.activities for select using (auth.uid() = user_id);
create policy "Users can insert own activities" on public.activities for insert with check (auth.uid() = user_id);
create policy "Users can delete own activities" on public.activities for delete using (auth.uid() = user_id);

-- ─── DAILY PHOTOS (for time-lapse) ───
create table public.daily_photos (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  photo_url text not null,
  day date default current_date,
  created_at timestamptz default now(),
  unique(user_id, day)  -- one photo per day
);

alter table public.daily_photos enable row level security;
create policy "Users can read own photos" on public.daily_photos for select using (auth.uid() = user_id);
create policy "Users can insert own photos" on public.daily_photos for insert with check (auth.uid() = user_id);

-- ─── FRIENDSHIPS ───
create table public.friendships (
  id uuid default uuid_generate_v4() primary key,
  requester_id uuid references public.profiles(id) on delete cascade not null,
  addressee_id uuid references public.profiles(id) on delete cascade not null,
  status text default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz default now(),
  unique(requester_id, addressee_id)
);

alter table public.friendships enable row level security;
create policy "Users can see their friendships" on public.friendships
  for select using (auth.uid() = requester_id or auth.uid() = addressee_id);
create policy "Users can send friend requests" on public.friendships
  for insert with check (auth.uid() = requester_id);
create policy "Users can update friendships addressed to them" on public.friendships
  for update using (auth.uid() = addressee_id);

-- ─── CHALLENGES (retos entre amigos) ───
create table public.challenges (
  id uuid default uuid_generate_v4() primary key,
  creator_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,                    -- "100 sentadillas en 3 días"
  description text,
  exercise_id text,                       -- null = any exercise counts
  target_reps int not null default 100,   -- objetivo total
  deadline timestamptz not null,
  stake text,                             -- "Una cena", "Un café", etc.
  status text default 'active' check (status in ('active', 'completed', 'expired')),
  created_at timestamptz default now()
);

alter table public.challenges enable row level security;

-- ─── CHALLENGE PARTICIPANTS ───
-- (created BEFORE challenge policies because policies reference this table)
create table public.challenge_participants (
  id uuid default uuid_generate_v4() primary key,
  challenge_id uuid references public.challenges(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  current_reps int default 0,
  status text default 'active' check (status in ('active', 'won', 'lost')),
  joined_at timestamptz default now(),
  unique(challenge_id, user_id)
);

alter table public.challenge_participants enable row level security;

-- Now create policies (both tables exist)
create policy "Challenge participants can read" on public.challenges
  for select using (
    auth.uid() = creator_id
    or auth.uid() in (select user_id from public.challenge_participants where challenge_id = id)
  );
create policy "Users can create challenges" on public.challenges
  for insert with check (auth.uid() = creator_id);
create policy "Creator can update challenge" on public.challenges
  for update using (auth.uid() = creator_id);

create policy "Participants can read" on public.challenge_participants
  for select using (
    auth.uid() = user_id
    or auth.uid() in (select creator_id from public.challenges where id = challenge_id)
  );
create policy "Users can join challenges" on public.challenge_participants
  for insert with check (auth.uid() = user_id);
create policy "Users can update own participation" on public.challenge_participants
  for update using (auth.uid() = user_id);

-- ─── PUSH NOTIFICATION LOG ───
create table public.notification_log (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null,  -- 'reminder', 'challenge_invite', 'challenge_update', 'friend_request'
  title text not null,
  body text,
  sent_at timestamptz default now(),
  read boolean default false
);

alter table public.notification_log enable row level security;
create policy "Users can read own notifications" on public.notification_log
  for select using (auth.uid() = user_id);
create policy "Users can update own notifications" on public.notification_log
  for update using (auth.uid() = user_id);

-- ─── HELPER VIEWS ───

-- View: today's total per user (for dashboard)
create or replace view public.today_totals as
select
  user_id,
  coalesce(sum(reps), 0) as total_reps,
  count(*) as total_entries
from public.activities
where day = current_date
group by user_id;

-- View: friend leaderboard
create or replace view public.friend_leaderboard as
select
  p.id as user_id,
  p.display_name,
  p.avatar_url,
  p.streak,
  coalesce(t.total_reps, 0) as today_reps
from public.profiles p
left join public.today_totals t on t.user_id = p.id;

-- ─── FUNCTION: Get friends of a user ───
create or replace function public.get_friends(uid uuid)
returns table (
  friend_id uuid,
  display_name text,
  avatar_url text,
  streak int,
  today_reps bigint
) as $$
  select
    fl.user_id as friend_id,
    fl.display_name,
    fl.avatar_url,
    fl.streak,
    fl.today_reps
  from public.friend_leaderboard fl
  where fl.user_id in (
    select addressee_id from public.friendships where requester_id = uid and status = 'accepted'
    union
    select requester_id from public.friendships where addressee_id = uid and status = 'accepted'
  );
$$ language sql security definer;
