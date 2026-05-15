-- UP: tabelas auxiliares (cache GraphQL, analytics UX, rate limit, feature flags, IA feedback)
-- DOWN: DROP em ordem reversa

-- 1. graphql_cache (KV com TTL)
CREATE TABLE IF NOT EXISTS graphql_cache (
  cache_key TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_graphql_cache_expires ON graphql_cache(expires_at);

-- 2. analytics_events (funil UX)
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL,
  properties JSONB NOT NULL DEFAULT '{}'::JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_analytics_events_user_event
  ON analytics_events(user_id, event_name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS ix_analytics_events_event_time
  ON analytics_events(event_name, occurred_at DESC);

-- 3. rate_limit_buckets
CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, action, window_start)
);

-- 4. feature_flags
CREATE TABLE IF NOT EXISTS feature_flags (
  flag_name TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  rollout_pct INTEGER NOT NULL DEFAULT 0 CHECK (rollout_pct >= 0 AND rollout_pct <= 100),
  user_allowlist UUID[] NOT NULL DEFAULT '{}',
  user_blocklist UUID[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. ai_quality_feedback
CREATE TABLE IF NOT EXISTS ai_quality_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subtopico_id UUID,  -- FK preenchida quando subtopicos tiver schema completo; sem REFERENCES por enquanto
  rating SMALLINT NOT NULL CHECK (rating IN (-1, 1)),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_ai_feedback_subtopico
  ON ai_quality_feedback(subtopico_id);

-- Função pra checar feature flag por user (usada por handlers)
CREATE OR REPLACE FUNCTION is_feature_enabled(
  p_flag_name TEXT,
  p_user_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_flag feature_flags%ROWTYPE;
  v_user_hash INTEGER;
BEGIN
  SELECT * INTO v_flag FROM feature_flags WHERE flag_name = p_flag_name;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF NOT v_flag.enabled THEN RETURN FALSE; END IF;
  IF p_user_id = ANY(v_flag.user_blocklist) THEN RETURN FALSE; END IF;
  IF p_user_id = ANY(v_flag.user_allowlist) THEN RETURN TRUE; END IF;
  -- Hash determinístico do user pra rollout consistente
  v_user_hash := ABS(hashtext(p_user_id::TEXT)) % 100;
  RETURN v_user_hash < v_flag.rollout_pct;
END $$;

COMMENT ON FUNCTION is_feature_enabled IS 'Verifica se feature_flag está ativa para user específico (allowlist > blocklist > rollout_pct).';
