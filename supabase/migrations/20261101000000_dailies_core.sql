-- Portal: dailies core (plan section 11, week 2).
-- Not applied automatically. Review, then apply to the chosen Supabase project.

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  username      text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name  text not null,
  avatar_pixel  text,
  created_at    timestamptz not null default now()
);

create table public.games (
  id           text primary key,                       -- slug, e.g. 'letterbox'
  name         text not null,
  kind         text not null check (kind in ('daily', 'party')),
  color_token  text not null,
  active       boolean not null default true
);

create table public.daily_puzzles (
  id           uuid primary key default gen_random_uuid(),
  game_id      text not null references public.games (id),
  puzzle_date  date not null,                          -- IST calendar day
  payload      jsonb not null default '{}'::jsonb,     -- public part of the puzzle
  answer       text not null,                          -- server-only
  unique (game_id, puzzle_date)
);

create table public.daily_attempts (
  user_id            uuid not null references public.profiles (id) on delete cascade,
  puzzle_id          uuid not null references public.daily_puzzles (id),
  step               smallint not null check (step between 1 and 6),
  client_action_id   text not null,
  input              text not null,
  feedback           jsonb not null,
  created_at         timestamptz not null default now(),
  primary key (user_id, puzzle_id, step),              -- one row per guess
  unique (user_id, puzzle_id, client_action_id)        -- retries never double-count
);

create table public.daily_results (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  puzzle_id    uuid not null references public.daily_puzzles (id),
  solved       boolean not null,
  attempts     smallint not null,
  time_ms      integer,
  score        smallint not null default 0,
  finished_at  timestamptz not null default now(),
  primary key (user_id, puzzle_id)                     -- one result per player and puzzle
);

create index daily_results_puzzle_user on public.daily_results (puzzle_id, user_id);

-- ---------- Row-level security ----------
alter table public.profiles       enable row level security;
alter table public.games          enable row level security;
alter table public.daily_puzzles  enable row level security;
alter table public.daily_attempts enable row level security;
alter table public.daily_results  enable row level security;

create policy "own profile read"   on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy "own profile update" on public.profiles for update to authenticated using (id = (select auth.uid()));

create policy "games are public" on public.games for select to anon, authenticated using (true);

-- daily_puzzles: deliberately NO policy for anon/authenticated, so the answer
-- column is unreachable from the client. Server code uses the service role.
-- Clients read today's puzzle through the answer-free view below.
create view public.daily_puzzles_public as
  select id, game_id, puzzle_date, payload
  from public.daily_puzzles
  where puzzle_date <= (now() at time zone 'Asia/Kolkata')::date;
grant select on public.daily_puzzles_public to anon, authenticated;

-- Players read their own attempts/results. Writes go through server code only
-- (service role), which is what checks guesses against the answer.
create policy "own attempts read" on public.daily_attempts for select to authenticated using (user_id = (select auth.uid()));
create policy "own results read"  on public.daily_results  for select to authenticated using (user_id = (select auth.uid()));
-- Circle-mates' results are added with the circles migration.

insert into public.games (id, name, kind, color_token) values
  ('letterbox',  'Letterbox',  'daily', 'terracotta'),
  ('bundle',     'Bundle',     'daily', 'mustard'),
  ('pixel-peek', 'Pixel Peek', 'daily', 'sage')
on conflict (id) do nothing;
