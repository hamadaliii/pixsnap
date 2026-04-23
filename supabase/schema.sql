-- PixSnap Database Schema
-- Run this entire file in your Supabase SQL Editor

-- ─────────────────────────────────────────
-- EVENTS TABLE
-- ─────────────────────────────────────────
create table if not exists events (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  date        date,
  slug        text unique not null,        -- used in QR code URL
  created_by  uuid references auth.users(id) on delete cascade,
  created_at  timestamptz default now()
);

-- ─────────────────────────────────────────
-- PHOTOS TABLE
-- ─────────────────────────────────────────
create table if not exists photos (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid references events(id) on delete cascade,
  storage_path  text not null,             -- path inside Supabase Storage bucket
  public_url    text not null,             -- full public URL for display
  embedding     vector(128),               -- face embedding (DeepFace Facenet)
  processed     boolean default false,     -- true after embedding is extracted
  created_at    timestamptz default now()
);

-- Index for fast vector similarity search
create index if not exists photos_event_idx on photos(event_id);

-- ─────────────────────────────────────────
-- ENABLE pgvector EXTENSION
-- (required for storing face embeddings)
-- ─────────────────────────────────────────
create extension if not exists vector;

-- ─────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS)
-- Protects data so users only access their own
-- ─────────────────────────────────────────
alter table events enable row level security;
alter table photos enable row level security;

-- Events: owners can do everything
create policy "Owners manage their events"
  on events for all
  using (auth.uid() = created_by);

-- Events: anyone can read (needed for public QR page)
create policy "Public can view events"
  on events for select
  using (true);

-- Photos: event owners can insert/update/delete
create policy "Owners manage event photos"
  on photos for all
  using (
    exists (
      select 1 from events
      where events.id = photos.event_id
      and events.created_by = auth.uid()
    )
  );

-- Photos: anyone can view (for results page)
create policy "Public can view photos"
  on photos for select
  using (true);

-- ─────────────────────────────────────────
-- STORAGE BUCKETS
-- Create these manually in Supabase Dashboard > Storage
-- Bucket names: event-photos, selfies
-- Both set to PUBLIC
-- ─────────────────────────────────────────
-- (Storage buckets are created via the Supabase dashboard, not SQL)
-- Reminder: event-photos → public bucket
--           selfies      → public bucket (or private, selfie URLs are short-lived)
