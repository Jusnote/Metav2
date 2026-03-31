-- Phase 2: Reports de questões + dispositivos legais

-- 1. Tabela de reports de questões
CREATE TABLE IF NOT EXISTS question_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id bigint NOT NULL,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('desatualizada', 'gabarito_errado', 'enunciado_incompleto', 'classificacao_errada', 'outro')),
  details text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  resolved_by uuid REFERENCES auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reporter_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_question_reports_pending ON question_reports (status, created_at DESC)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_question_reports_question ON question_reports (question_id);

ALTER TABLE question_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qr_insert" ON question_reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "qr_select_own" ON question_reports
  FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id);

-- 2. Tabela de reports de dispositivos legais
CREATE TABLE IF NOT EXISTS law_article_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispositivo_id text NOT NULL,
  lei_id text NOT NULL,
  dispositivo_tipo text,
  dispositivo_texto text,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('desatualizado', 'texto_errado', 'revogado', 'referencia_errada', 'outro')),
  details text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  resolved_by uuid REFERENCES auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reporter_id, dispositivo_id)
);

CREATE INDEX IF NOT EXISTS idx_law_reports_pending ON law_article_reports (status, created_at DESC)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_law_reports_lei ON law_article_reports (lei_id);
CREATE INDEX IF NOT EXISTS idx_law_reports_dispositivo ON law_article_reports (dispositivo_id);

ALTER TABLE law_article_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lr_insert" ON law_article_reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "lr_select_own" ON law_article_reports
  FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id);
