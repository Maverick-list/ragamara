-- NULAR — Immersive Nusantara Cultural World
-- Database Schema & Row-Level Security Migration (PostgreSQL / Supabase)
-- Covers all 20 core tables with relational integrity, indexes, and server-authoritative XP/achievement rules.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Users & Identity (maps to auth.users in Supabase or standalone users table)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  password_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- 2. Player Profiles
CREATE TABLE IF NOT EXISTS public.player_profiles (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL CHECK (char_length(username) BETWEEN 2 AND 32),
  bio TEXT DEFAULT '',
  avatar_id TEXT NOT NULL DEFAULT 'batik-parang-solo',
  avatar_customization JSONB NOT NULL DEFAULT '{"hairstyle":"classic","accessory":"none","skinTone":"medium"}'::jsonb,
  total_xp INTEGER NOT NULL DEFAULT 0 CHECK (total_xp >= 0),
  current_level INTEGER NOT NULL DEFAULT 1 CHECK (current_level >= 1),
  missions_completed INTEGER NOT NULL DEFAULT 0 CHECK (missions_completed >= 0),
  discoveries_count INTEGER NOT NULL DEFAULT 0 CHECK (discoveries_count >= 0),
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Avatars Catalog
CREATE TABLE IF NOT EXISTS public.avatars (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  textile_classification TEXT NOT NULL,
  is_batik BOOLEAN NOT NULL DEFAULT FALSE,
  province_name TEXT NOT NULL,
  glb_url TEXT NOT NULL,
  license TEXT NOT NULL
);

-- 4. Cultural Regions (8 Archipelago Zones)
CREATE TABLE IF NOT EXISTS public.cultural_regions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subtitle TEXT,
  display_order INTEGER NOT NULL DEFAULT 0
);

-- 5. Provinces (38 Indonesian Provinces)
CREATE TABLE IF NOT EXISTS public.provinces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  region_id TEXT NOT NULL REFERENCES public.cultural_regions(id),
  geojson_code TEXT
);

-- 6. Cultural Items (Scalable Unified Cultural Content Architecture)
CREATE TABLE IF NOT EXISTS public.cultural_items (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('house','clothing','weapon','music','dance','craft','ceremony','food','language')),
  province_id TEXT REFERENCES public.provinces(id),
  region_id TEXT REFERENCES public.cultural_regions(id),
  cultural_association TEXT NOT NULL,
  description TEXT NOT NULL,
  historical_context TEXT,
  cultural_significance TEXT,
  materials JSONB NOT NULL DEFAULT '[]'::jsonb,
  components JSONB NOT NULL DEFAULT '[]'::jsonb,
  verification_status TEXT NOT NULL DEFAULT 'verified',
  available_languages JSONB NOT NULL DEFAULT '["id"]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cultural_items_category ON public.cultural_items(category);
CREATE INDEX IF NOT EXISTS idx_cultural_items_province ON public.cultural_items(province_id);

-- 7. Cultural Media
CREATE TABLE IF NOT EXISTS public.cultural_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id TEXT NOT NULL REFERENCES public.cultural_items(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('image','audio','video')),
  url TEXT NOT NULL,
  caption TEXT,
  creator TEXT,
  license TEXT NOT NULL
);

-- 8. Cultural Sources
CREATE TABLE IF NOT EXISTS public.cultural_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id TEXT NOT NULL REFERENCES public.cultural_items(id) ON DELETE CASCADE,
  source_name TEXT NOT NULL,
  source_url TEXT,
  official_registry_id TEXT
);

-- 9. 3D Assets
CREATE TABLE IF NOT EXISTS public.assets_3d (
  id TEXT PRIMARY KEY,
  item_id TEXT REFERENCES public.cultural_items(id) ON DELETE CASCADE,
  glb_url TEXT NOT NULL,
  provenance_type TEXT NOT NULL,
  triangle_count INTEGER,
  file_size_bytes INTEGER,
  license TEXT NOT NULL
);

-- 10. Missions
CREATE TABLE IF NOT EXISTS public.missions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('exploration','learning','collection','regional','daily','story')),
  region_id TEXT REFERENCES public.cultural_regions(id),
  xp_reward INTEGER NOT NULL CHECK (xp_reward > 0 AND xp_reward <= 500),
  difficulty TEXT NOT NULL DEFAULT 'standard',
  objective JSONB NOT NULL
);

-- 11. Mission Progress
CREATE TABLE IF NOT EXISTS public.mission_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mission_id TEXT NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('available','in_progress','completed','locked')),
  progress_value INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, mission_id)
);

-- 12. Player XP Events (Server-Authoritative Audit Trail + Idempotency Key)
CREATE TABLE IF NOT EXISTS public.player_xp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  xp_awarded INTEGER NOT NULL CHECK (xp_awarded > 0 AND xp_awarded <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, event_key)
);
CREATE INDEX IF NOT EXISTS idx_xp_events_user_created ON public.player_xp_events(user_id, created_at DESC);

-- 13. Player Levels Reference
CREATE TABLE IF NOT EXISTS public.player_levels (
  level INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  min_total_xp INTEGER NOT NULL
);

-- 14. Achievements Catalog
CREATE TABLE IF NOT EXISTS public.achievements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  badge_icon TEXT NOT NULL,
  rule_key TEXT NOT NULL
);

-- 15. Player Achievements
CREATE TABLE IF NOT EXISTS public.player_achievements (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_id)
);

-- 16. Player Collections (Collection Book)
CREATE TABLE IF NOT EXISTS public.player_collections (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES public.cultural_items(id) ON DELETE CASCADE,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);

-- 17. Daily Streaks (Timezone-aware date tracking)
CREATE TABLE IF NOT EXISTS public.daily_streaks (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_active_date DATE,
  timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta'
);

-- 18. Leaderboard Snapshots
CREATE TABLE IF NOT EXISTS public.leaderboard_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL CHECK (scope IN ('global','weekly','monthly','regional')),
  region_id TEXT,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  level INTEGER NOT NULL,
  xp INTEGER NOT NULL,
  discoveries_count INTEGER NOT NULL DEFAULT 0,
  missions_completed INTEGER NOT NULL DEFAULT 0,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 19. Language Preferences
CREATE TABLE IF NOT EXISTS public.language_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  interface_lang TEXT NOT NULL DEFAULT 'id',
  regional_lang TEXT
);

-- 20. Player Settings (Camera, Graphics & Accessibility)
CREATE TABLE IF NOT EXISTS public.player_settings (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  camera_settings JSONB NOT NULL DEFAULT '{"mode":"third-person","sensitivity":1.0,"distance":4.6,"height":1.85,"invertY":false,"fov":52,"smoothing":0.16,"showHints":true,"showBodyFirstPerson":false}'::jsonb,
  graphics_settings JSONB NOT NULL DEFAULT '{"quality":"auto","shadows":true,"antialias":true,"reducedMotion":false,"showFps":false}'::jsonb,
  audio_settings JSONB NOT NULL DEFAULT '{"ambientEnabled":true,"sfxEnabled":true,"volume":0.55}'::jsonb
);

-- Row-Level Security (RLS)
ALTER TABLE public.player_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_xp_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.language_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_settings ENABLE ROW LEVEL SECURITY;

-- Public read only for public leaderboard fields; strict owner-only write
CREATE POLICY "Public profiles readable" ON public.player_profiles FOR SELECT USING (is_public = TRUE OR auth.uid() = user_id);
CREATE POLICY "Owner updates own profile" ON public.player_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Owner reads own XP events" ON public.player_xp_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Owner reads/writes own settings" ON public.player_settings FOR ALL USING (auth.uid() = user_id);
