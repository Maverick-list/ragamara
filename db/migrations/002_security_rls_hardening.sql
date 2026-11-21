-- NULAR — Security & Row-Level Security (RLS) Hardening Migration
-- Migration: 002_security_rls_hardening.sql
-- Resolves: Critical backend integrity, RLS omissions, XP tamper protection,
--           durable token revocation, rate limiting, and verification token storage.

-- 1. HARDEN public.users
-- Enable Row Level Security on the identity table.
-- Prevent anonymous and authenticated client connections from reading password hashes or user data directly.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny direct public access to users" ON public.users;
CREATE POLICY "Deny direct public access to users"
  ON public.users
  FOR ALL
  TO public, anon, authenticated
  USING (false)
  WITH CHECK (false);

-- 2. OWNER POLICIES FOR UNCONFIGURED TABLES
-- In 001_nular_cultural_world.sql, RLS was enabled on these tables without policies,
-- which effectively blocked non-superuser access or left undefined behavior.

-- 2.1 Mission Progress
DROP POLICY IF EXISTS "Owner reads own mission progress" ON public.mission_progress;
CREATE POLICY "Owner reads own mission progress"
  ON public.mission_progress
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owner writes own mission progress" ON public.mission_progress;
CREATE POLICY "Owner writes own mission progress"
  ON public.mission_progress
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2.2 Player Achievements
DROP POLICY IF EXISTS "Owner reads own achievements" ON public.player_achievements;
CREATE POLICY "Owner reads own achievements"
  ON public.player_achievements
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owner unlocks own achievements" ON public.player_achievements;
CREATE POLICY "Owner unlocks own achievements"
  ON public.player_achievements
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 2.3 Player Collections (Collection Book)
DROP POLICY IF EXISTS "Owner reads own collections" ON public.player_collections;
CREATE POLICY "Owner reads own collections"
  ON public.player_collections
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owner writes own collections" ON public.player_collections;
CREATE POLICY "Owner writes own collections"
  ON public.player_collections
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2.4 Daily Streaks
DROP POLICY IF EXISTS "Owner reads own streaks" ON public.daily_streaks;
CREATE POLICY "Owner reads own streaks"
  ON public.daily_streaks
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owner updates own streaks" ON public.daily_streaks;
CREATE POLICY "Owner updates own streaks"
  ON public.daily_streaks
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2.5 Language Preferences
DROP POLICY IF EXISTS "Owner reads own language preferences" ON public.language_preferences;
CREATE POLICY "Owner reads own language preferences"
  ON public.language_preferences
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owner updates own language preferences" ON public.language_preferences;
CREATE POLICY "Owner updates own language preferences"
  ON public.language_preferences
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. PLAYER PROFILE XP & LEVEL TAMPER PROTECTION TRIGGER
-- Ensure authenticated clients cannot arbitrarily execute UPDATE player_profiles SET total_xp = ... or current_level = ...
-- All XP increments must originate from server-authoritative progress events via service_role.
CREATE OR REPLACE FUNCTION public.protect_player_profile_integrity()
RETURNS TRIGGER AS $$
BEGIN
  -- If invoked by an authenticated client directly, prevent manual modification of total_xp and current_level
  IF (NEW.total_xp IS DISTINCT FROM OLD.total_xp OR NEW.current_level IS DISTINCT FROM OLD.current_level) THEN
    IF (auth.role() = 'authenticated' AND auth.uid() = OLD.user_id) THEN
      RAISE EXCEPTION 'Client-side modification of total_xp or current_level is prohibited. XP must be earned via server-authoritative progress endpoints.';
    END IF;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_player_profile_xp ON public.player_profiles;
CREATE TRIGGER trg_protect_player_profile_xp
  BEFORE UPDATE ON public.player_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_player_profile_integrity();

-- 4. DURABLE SESSION TOKEN REVOCATION TABLE
CREATE TABLE IF NOT EXISTS public.revoked_tokens (
  jti TEXT PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires ON public.revoked_tokens(expires_at);

ALTER TABLE public.revoked_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny direct public access to revoked_tokens" ON public.revoked_tokens;
CREATE POLICY "Deny direct public access to revoked_tokens"
  ON public.revoked_tokens
  FOR ALL
  TO public, anon, authenticated
  USING (false)
  WITH CHECK (false);

-- 5. DURABLE LOGIN BRUTE-FORCE RATE LIMIT TABLE
CREATE TABLE IF NOT EXISTS public.login_rate_limits (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 1,
  first_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_login_rate_limits_locked ON public.login_rate_limits(locked_until);

ALTER TABLE public.login_rate_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny direct public access to login_rate_limits" ON public.login_rate_limits;
CREATE POLICY "Deny direct public access to login_rate_limits"
  ON public.login_rate_limits
  FOR ALL
  TO public, anon, authenticated
  USING (false)
  WITH CHECK (false);

-- 6. CRYPTOGRAPHIC VERIFICATION TOKENS TABLE (Email Verification & Password Reset)
CREATE TABLE IF NOT EXISTS public.auth_verification_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_type TEXT NOT NULL CHECK (token_type IN ('email_verify', 'password_reset')),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auth_verification_tokens_user ON public.auth_verification_tokens(user_id, token_type);

ALTER TABLE public.auth_verification_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny direct public access to auth_verification_tokens" ON public.auth_verification_tokens;
CREATE POLICY "Deny direct public access to auth_verification_tokens"
  ON public.auth_verification_tokens
  FOR ALL
  TO public, anon, authenticated
  USING (false)
  WITH CHECK (false);
