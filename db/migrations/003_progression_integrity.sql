-- NULAR — Progression Integrity, Distributed Session Hardening & Phone Identity
-- Migration: 003_progression_integrity.sql
-- Resolves: Disconnected progression storage, atomic rate limiting,
--           phone authentication persistence, and trigger search path hardening.

-- 1. PHONE IDENTITY SUPPORT ON public.users
-- Allow phone-based accounts without fabricating dummy emails.
-- Enforce that every user has either a valid email or a valid phone number.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT UNIQUE;
ALTER TABLE public.users ALTER COLUMN email DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_email_or_phone'
  ) THEN
    ALTER TABLE public.users ADD CONSTRAINT chk_users_email_or_phone
      CHECK (email IS NOT NULL OR phone IS NOT NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone) WHERE deleted_at IS NULL;

-- 2. HARDEN TRIGGER SEARCH PATH (CWE-426)
-- Explicitly pin search_path = public, pg_temp on profile integrity trigger function.
CREATE OR REPLACE FUNCTION public.protect_player_profile_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Prevent client-role updates from directly altering total_xp or current_level
  IF (NEW.total_xp IS DISTINCT FROM OLD.total_xp OR NEW.current_level IS DISTINCT FROM OLD.current_level) THEN
    IF (auth.role() = 'authenticated' AND auth.uid() = OLD.user_id) THEN
      RAISE EXCEPTION 'Client-side modification of total_xp or current_level is prohibited. XP must be earned via server-authoritative progress endpoints.';
    END IF;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_player_profile_xp ON public.player_profiles;
CREATE TRIGGER trg_protect_player_profile_xp
  BEFORE UPDATE ON public.player_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_player_profile_integrity();

-- 3. ATOMIC DISTRIBUTED RATE LIMITING (Prevent TOCTOU Race Condition)
-- Atomic function using FOR UPDATE locking to guarantee consistent attempt counting under concurrent attacks.
CREATE OR REPLACE FUNCTION public.record_login_attempt(
  p_key TEXT,
  p_max_attempts INT DEFAULT 5,
  p_window_seconds INT DEFAULT 900
)
RETURNS TABLE(locked BOOLEAN, attempts INT, retry_after INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_rec public.login_rate_limits%ROWTYPE;
  v_attempts INT := 1;
  v_locked_until TIMESTAMPTZ := NULL;
  v_retry_after INT := 0;
BEGIN
  SELECT * INTO v_rec FROM public.login_rate_limits WHERE key = p_key FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.login_rate_limits (key, attempts, first_attempt_at, updated_at)
    VALUES (p_key, 1, v_now, v_now);
    RETURN QUERY SELECT FALSE, 1, 0;
    RETURN;
  END IF;

  -- If already locked, calculate remaining seconds
  IF v_rec.locked_until IS NOT NULL AND v_rec.locked_until > v_now THEN
    v_retry_after := CEIL(EXTRACT(EPOCH FROM (v_rec.locked_until - v_now)))::INT;
    RETURN QUERY SELECT TRUE, v_rec.attempts, v_retry_after;
    RETURN;
  END IF;

  -- If time window has expired, reset counter to 1
  IF v_now - v_rec.first_attempt_at > (p_window_seconds || ' seconds')::INTERVAL THEN
    v_attempts := 1;
    v_locked_until := NULL;
    UPDATE public.login_rate_limits
    SET attempts = 1, first_attempt_at = v_now, locked_until = NULL, updated_at = v_now
    WHERE key = p_key;
  ELSE
    v_attempts := v_rec.attempts + 1;
    IF v_attempts >= p_max_attempts THEN
      v_locked_until := v_now + (p_window_seconds || ' seconds')::INTERVAL;
      v_retry_after := p_window_seconds;
    END IF;
    UPDATE public.login_rate_limits
    SET attempts = v_attempts, locked_until = v_locked_until, updated_at = v_now
    WHERE key = p_key;
  END IF;

  RETURN QUERY SELECT (v_locked_until IS NOT NULL), v_attempts, v_retry_after;
END;
$$;

-- Atomic reset of rate limits upon successful login
CREATE OR REPLACE FUNCTION public.reset_login_attempts(p_key TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.login_rate_limits WHERE key = p_key;
END;
$$;

-- 4. SERVER-AUTHORITATIVE XP & PROGRESSION TRANSACTION (Durable Progression)
-- Atomic procedure to log XP event, enforce idempotency, update profile XP/level, and update daily streaks.
CREATE OR REPLACE FUNCTION public.award_player_xp(
  p_user_id UUID,
  p_activity_type TEXT,
  p_event_key TEXT,
  p_item_id TEXT DEFAULT NULL,
  p_mission_id TEXT DEFAULT NULL,
  p_tz TEXT DEFAULT 'Asia/Jakarta'
)
RETURNS TABLE(
  duplicate BOOLEAN,
  xp_awarded INT,
  total_xp INT,
  current_level INT,
  streak_days INT,
  discoveries_count INT,
  missions_completed INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_xp_amount INT;
  v_profile public.player_profiles%ROWTYPE;
  v_new_xp INT;
  v_new_level INT := 1;
  v_rem_xp INT;
  v_req_xp INT;
  v_streak public.daily_streaks%ROWTYPE;
  v_today DATE;
  v_yesterday DATE;
  v_current_streak INT := 1;
  v_disc_inc INT := 0;
  v_miss_inc INT := 0;
BEGIN
  -- 1. Idempotency check: Has this event already been awarded?
  IF EXISTS (SELECT 1 FROM public.player_xp_events WHERE user_id = p_user_id AND event_key = p_event_key) THEN
    SELECT * INTO v_profile FROM public.player_profiles WHERE user_id = p_user_id;
    SELECT * INTO v_streak FROM public.daily_streaks WHERE user_id = p_user_id;
    RETURN QUERY SELECT
      TRUE,
      0,
      COALESCE(v_profile.total_xp, 0),
      COALESCE(v_profile.current_level, 1),
      COALESCE(v_streak.current_streak, 0),
      COALESCE(v_profile.discoveries_count, 0),
      COALESCE(v_profile.missions_completed, 0);
    RETURN;
  END IF;

  -- 2. Authoritative XP Table
  CASE p_activity_type
    WHEN 'discover_item' THEN v_xp_amount := 10; v_disc_inc := 1;
    WHEN 'read_article' THEN v_xp_amount := 15;
    WHEN 'complete_mission' THEN v_xp_amount := 30; v_miss_inc := 1;
    WHEN 'complete_collection' THEN v_xp_amount := 100;
    WHEN 'finish_quiz' THEN v_xp_amount := 20;
    WHEN 'inspect_detail' THEN v_xp_amount := 10;
    ELSE
      RAISE EXCEPTION 'Invalid activity type: %', p_activity_type;
  END CASE;

  -- 3. Insert audit log event
  INSERT INTO public.player_xp_events(user_id, event_key, activity_type, xp_awarded)
  VALUES (p_user_id, p_event_key, p_activity_type, v_xp_amount);

  -- 4. Record item discovery in player_collections if applicable
  IF p_item_id IS NOT NULL THEN
    INSERT INTO public.player_collections(user_id, item_id, discovered_at)
    VALUES (p_user_id, p_item_id, now())
    ON CONFLICT (user_id, item_id) DO NOTHING;
  END IF;

  -- 5. Record mission completion if applicable
  IF p_mission_id IS NOT NULL THEN
    INSERT INTO public.mission_progress(user_id, mission_id, status, progress_value, completed_at)
    VALUES (p_user_id, p_mission_id, 'completed', 100, now())
    ON CONFLICT (user_id, mission_id) DO UPDATE
    SET status = 'completed', progress_value = 100, completed_at = now();
  END IF;

  -- 6. Lock profile for update and compute new level
  SELECT * INTO v_profile FROM public.player_profiles WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.player_profiles (user_id, username, total_xp, current_level, discoveries_count, missions_completed)
    VALUES (p_user_id, 'Penjelajah Nusantara', v_xp_amount, 1, v_disc_inc, v_miss_inc)
    RETURNING * INTO v_profile;
    v_new_xp := v_xp_amount;
  ELSE
    v_new_xp := v_profile.total_xp + v_xp_amount;
  END IF;

  -- Calculate level using NULAR power curve: round(100 * level^1.5)
  v_new_level := 1;
  v_rem_xp := v_new_xp;
  v_req_xp := ROUND(100 * POWER(v_new_level, 1.5))::INT;
  WHILE v_rem_xp >= v_req_xp LOOP
    v_rem_xp := v_rem_xp - v_req_xp;
    v_new_level := v_new_level + 1;
    v_req_xp := ROUND(100 * POWER(v_new_level, 1.5))::INT;
  END LOOP;

  -- 7. Update profile
  UPDATE public.player_profiles
  SET total_xp = v_new_xp,
      current_level = v_new_level,
      discoveries_count = discoveries_count + v_disc_inc,
      missions_completed = missions_completed + v_miss_inc,
      updated_at = now()
  WHERE user_id = p_user_id;

  -- 8. Daily Streak calculation (timezone-aware)
  BEGIN
    v_today := (now() AT TIME ZONE COALESCE(p_tz, 'Asia/Jakarta'))::DATE;
  EXCEPTION WHEN OTHERS THEN
    v_today := (now() AT TIME ZONE 'Asia/Jakarta')::DATE;
  END;
  v_yesterday := v_today - 1;

  SELECT * INTO v_streak FROM public.daily_streaks WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.daily_streaks (user_id, current_streak, longest_streak, last_active_date, timezone)
    VALUES (p_user_id, 1, 1, v_today, p_tz);
    v_current_streak := 1;
  ELSE
    IF v_streak.last_active_date IS NULL OR v_streak.last_active_date < v_yesterday THEN
      v_current_streak := 1;
    ELSIF v_streak.last_active_date = v_yesterday THEN
      v_current_streak := v_streak.current_streak + 1;
    ELSE
      v_current_streak := v_streak.current_streak;
    END IF;

    UPDATE public.daily_streaks
    SET current_streak = v_current_streak,
        longest_streak = GREATEST(longest_streak, v_current_streak),
        last_active_date = v_today,
        timezone = p_tz
    WHERE user_id = p_user_id;
  END IF;

  RETURN QUERY SELECT
    FALSE,
    v_xp_amount,
    v_new_xp,
    v_new_level,
    v_current_streak,
    (v_profile.discoveries_count + v_disc_inc),
    (v_profile.missions_completed + v_miss_inc);
END;
$$;
