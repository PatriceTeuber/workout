-- workout — database schema
-- Run once in the Supabase SQL Editor. Safe to keep in the public repo:
-- access is guarded by row level security, not by secrecy.


-- ── exercises ────────────────────────────────────────────────────────────────
create table public.exercises (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  name        text not null check (char_length(trim(name)) between 1 and 60),
  note        text check (char_length(note) <= 200),
  type        text not null default 'strength' check (type in ('strength', 'time')),
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- No two active exercises with the same name — a typo'd duplicate would split
-- the history in half, which is exactly what the app exists to prevent.
-- Archiving releases the name again.
create unique index exercises_active_name_idx
  on public.exercises (user_id, lower(trim(name))) where not archived;


-- ── sets ─────────────────────────────────────────────────────────────────────
-- A "session" is simply every set sharing the same performed_on date.
create table public.sets (
  id            uuid primary key,
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  exercise_id   uuid not null references public.exercises on delete cascade,
  performed_on  date not null,
  set_no        smallint not null check (set_no > 0),
  reps          smallint check (reps > 0),
  weight        numeric(6, 2) check (weight >= 0),
  duration_s    integer check (duration_s > 0),
  created_at    timestamptz not null default now(),

  -- strength sets carry reps, time sets carry duration; weight is optional for
  -- both (bodyweight pull-ups, unweighted planks)
  constraint sets_has_a_measure check (reps is not null or duration_s is not null)
);

-- `id` is deliberately without a default: the client generates it before the
-- write goes into the offline queue, so replaying a queued set can never insert
-- it twice — the retry just collides with its own primary key.

create index sets_exercise_idx on public.sets (user_id, exercise_id, performed_on desc);
create index sets_date_idx     on public.sets (user_id, performed_on desc);


-- ── row level security ───────────────────────────────────────────────────────
alter table public.exercises enable row level security;
alter table public.sets      enable row level security;

create policy "own exercises" on public.exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own sets" on public.sets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
