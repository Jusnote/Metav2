# Question Comments — Plano 1: Database + API

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar toda a infraestrutura de banco de dados (Supabase) e API (Verus) para o sistema de comentários e anotações de questões — sem frontend.

**Architecture:** 6 tabelas no Supabase (comments, votes, reports, edits, notes, moderation) com RPCs atômicas, triggers de contagem, Edge Functions para webhook, e RLS policies. 2 colunas novas + 1 endpoint webhook na API Verus (FastAPI/PostgreSQL). Tudo testável via SQL e HTTP sem precisar de UI.

**Tech Stack:** Supabase (PostgreSQL 15), Supabase Edge Functions (Deno/TypeScript), API Verus (FastAPI + SQLAlchemy + Alembic), PostgreSQL triggers/functions.

**Spec:** `docs/superpowers/specs/2026-03-29-question-comments-system-design.md`

---

## File Structure

### Supabase (SQL migrations)

| File | Responsabilidade |
|------|-----------------|
| `supabase/migrations/001_question_comments.sql` | Tabela `question_comments` + índices |
| `supabase/migrations/002_question_comment_votes.sql` | Tabela `question_comment_votes` |
| `supabase/migrations/003_question_comment_reports.sql` | Tabela `question_comment_reports` |
| `supabase/migrations/004_question_comment_edits.sql` | Tabela `question_comment_edits` |
| `supabase/migrations/005_question_notes.sql` | Tabela `question_notes` + índices |
| `supabase/migrations/006_user_moderation.sql` | Tabela `user_moderation` |
| `supabase/migrations/007_rpc_toggle_upvote.sql` | RPC `toggle_upvote` (atomic) |
| `supabase/migrations/008_rpc_handle_soft_delete.sql` | RPC `handle_soft_delete` (LGPD) |
| `supabase/migrations/009_rpc_get_comments_with_votes.sql` | Function `get_comments_with_votes` (resolve N+1) |
| `supabase/migrations/010_triggers.sql` | Triggers: reply_count, shadowban sync |
| `supabase/migrations/011_rls_policies.sql` | Row Level Security policies |
| `supabase/functions/notify-api-stats/index.ts` | Edge Function: webhook → API Verus |
| `supabase/functions/validate-content/index.ts` | Edge Function: valida content_text |

### API Verus (FastAPI)

| File | Responsabilidade |
|------|-----------------|
| `alembic/versions/YYYYMMDD_add_community_stats.py` | Migration: `comments_count` + `has_teacher_resolution` |
| `app/models/questao.py` | Adicionar 2 colunas ao model |
| `app/schemas/questao.py` | Adicionar campos ao schema de response |
| `app/api/v1/routes/questoes.py` | Endpoint PATCH webhook |
| `app/core/dependencies.py` | Middleware de auth para webhook |

---

## Task 1: Tabela `question_comments`

**Files:**
- Create: `supabase/migrations/001_question_comments.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- 001_question_comments.sql
CREATE TABLE IF NOT EXISTS question_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id bigint NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  root_id uuid REFERENCES question_comments(id) ON DELETE CASCADE,
  reply_to_id uuid REFERENCES question_comments(id) ON DELETE SET NULL,
  content_json jsonb NOT NULL,
  content_text text NOT NULL,
  quoted_text text,
  is_pinned boolean NOT NULL DEFAULT false,
  is_endorsed boolean NOT NULL DEFAULT false,
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_by uuid REFERENCES auth.users(id),
  is_author_shadowbanned boolean NOT NULL DEFAULT false,
  upvote_count integer NOT NULL DEFAULT 0,
  reply_count integer NOT NULL DEFAULT 0,
  report_count integer NOT NULL DEFAULT 0,
  edit_count integer NOT NULL DEFAULT 0,
  last_edited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Composite index otimizado para ordenação (Pinned > Votos > Recentes)
CREATE INDEX idx_comments_sort ON question_comments
  (question_id, is_pinned DESC, upvote_count DESC, created_at DESC)
  WHERE is_deleted = false;

-- Flat thread loading
CREATE INDEX idx_comments_root ON question_comments (root_id, created_at ASC);

-- Meus comentários
CREATE INDEX idx_comments_user ON question_comments (user_id, created_at DESC);

-- Full-text search em português
CREATE INDEX idx_comments_text ON question_comments
  USING GIN (to_tsvector('portuguese', content_text));

-- Question lookup rápido
CREATE INDEX idx_comments_question_id ON question_comments (question_id);

COMMENT ON TABLE question_comments IS 'Comentários da comunidade em questões';
COMMENT ON COLUMN question_comments.root_id IS 'NULL = comentário raiz. Preenchido = resposta flat (1 nível)';
COMMENT ON COLUMN question_comments.reply_to_id IS 'Quem respondeu (para @mention e notificação). Pode ser NULL mesmo em respostas.';
COMMENT ON COLUMN question_comments.is_author_shadowbanned IS 'Denormalizado da user_moderation para evitar JOIN na leitura';
COMMENT ON COLUMN question_comments.reply_count IS 'Counter de filhos diretos. Usado na regra deleta-vs-colapsa.';
```

- [ ] **Step 2: Aplicar migration no Supabase**

Run: `supabase db push` ou aplicar via SQL Editor no dashboard Supabase.
Expected: tabela criada, índices criados, sem erros.

- [ ] **Step 3: Verificar**

Run: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'question_comments' ORDER BY ordinal_position;`
Expected: 20 colunas conforme spec.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/001_question_comments.sql
git commit -m "feat(comments): create question_comments table with optimized indexes"
```

---

## Task 2: Tabelas auxiliares (votes, reports, edits)

**Files:**
- Create: `supabase/migrations/002_question_comment_votes.sql`
- Create: `supabase/migrations/003_question_comment_reports.sql`
- Create: `supabase/migrations/004_question_comment_edits.sql`

- [ ] **Step 1: Votes**

```sql
-- 002_question_comment_votes.sql
CREATE TABLE IF NOT EXISTS question_comment_votes (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment_id uuid NOT NULL REFERENCES question_comments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, comment_id)
);

COMMENT ON TABLE question_comment_votes IS 'Upvotes — 1 por pessoa por comentário. PK composta impede duplicatas.';
```

- [ ] **Step 2: Reports**

```sql
-- 003_question_comment_reports.sql
CREATE TABLE IF NOT EXISTS question_comment_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES question_comments(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('spam', 'ofensivo', 'errado', 'outro')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved_kept', 'resolved_deleted')),
  resolved_by uuid REFERENCES auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reporter_id, comment_id)  -- 1 report por pessoa por comentário
);

CREATE INDEX idx_reports_pending ON question_comment_reports (status, created_at DESC)
  WHERE status = 'pending';
CREATE INDEX idx_reports_comment ON question_comment_reports (comment_id);

COMMENT ON TABLE question_comment_reports IS 'Denúncias de comentários. 3+ reports = fila de moderação.';
```

- [ ] **Step 3: Edits (histórico de versões)**

```sql
-- 004_question_comment_edits.sql
CREATE TABLE IF NOT EXISTS question_comment_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES question_comments(id) ON DELETE CASCADE,
  content_json jsonb NOT NULL,
  content_text text NOT NULL,
  edited_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_edits_comment ON question_comment_edits (comment_id, edited_at DESC);

COMMENT ON TABLE question_comment_edits IS 'Histórico de edições. Hard-deleted junto com soft-delete do comment (LGPD).';
```

- [ ] **Step 4: Aplicar e verificar**

Run: Aplicar as 3 migrations no Supabase.
Expected: 3 tabelas criadas sem erros.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/002_question_comment_votes.sql supabase/migrations/003_question_comment_reports.sql supabase/migrations/004_question_comment_edits.sql
git commit -m "feat(comments): create votes, reports, edits tables"
```

---

## Task 3: Tabela `question_notes` + `user_moderation`

**Files:**
- Create: `supabase/migrations/005_question_notes.sql`
- Create: `supabase/migrations/006_user_moderation.sql`

- [ ] **Step 1: Notes (PK composta, sem UUID)**

```sql
-- 005_question_notes.sql
CREATE TABLE IF NOT EXISTS question_notes (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id bigint NOT NULL,
  content_json jsonb NOT NULL,
  content_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, question_id)
);

-- Busca reversa: "quais questões eu tenho nota?"
CREATE INDEX idx_notes_user ON question_notes (user_id);

-- Full-text search
CREATE INDEX idx_notes_text ON question_notes
  USING GIN (to_tsvector('portuguese', content_text));

COMMENT ON TABLE question_notes IS 'Anotações privadas. PK (user_id, question_id) — 1 nota por questão por aluno.';
```

- [ ] **Step 2: User moderation**

```sql
-- 006_user_moderation.sql
CREATE TABLE IF NOT EXISTS user_moderation (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_shadowbanned boolean NOT NULL DEFAULT false,
  timeout_until timestamptz,
  timeout_reason text,
  banned_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE user_moderation IS 'Moderação de usuários: shadowban, timeout, ban.';
COMMENT ON COLUMN user_moderation.timeout_until IS 'NULL = sem timeout. Checado no frontend antes de permitir POST.';
COMMENT ON COLUMN user_moderation.is_shadowbanned IS 'Posts do user ficam visíveis só pra ele. Sincronizado via trigger em question_comments.is_author_shadowbanned.';
```

- [ ] **Step 3: Aplicar e verificar**

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/005_question_notes.sql supabase/migrations/006_user_moderation.sql
git commit -m "feat(comments): create question_notes and user_moderation tables"
```

---

## Task 4: RPC `toggle_upvote` (atomic)

**Files:**
- Create: `supabase/migrations/007_rpc_toggle_upvote.sql`

- [ ] **Step 1: Criar a RPC**

```sql
-- 007_rpc_toggle_upvote.sql
CREATE OR REPLACE FUNCTION toggle_upvote(p_comment_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existed boolean;
  v_new_count integer;
BEGIN
  -- Tenta deletar o voto existente
  DELETE FROM question_comment_votes
  WHERE comment_id = p_comment_id AND user_id = p_user_id
  RETURNING true INTO v_existed;

  IF v_existed THEN
    -- Voto removido → decrementa atomicamente
    UPDATE question_comments
    SET upvote_count = GREATEST(upvote_count - 1, 0),
        updated_at = now()
    WHERE id = p_comment_id
    RETURNING upvote_count INTO v_new_count;

    RETURN jsonb_build_object('action', 'removed', 'upvote_count', v_new_count);
  ELSE
    -- Voto novo → insere + incrementa atomicamente
    INSERT INTO question_comment_votes (user_id, comment_id)
    VALUES (p_user_id, p_comment_id);

    UPDATE question_comments
    SET upvote_count = upvote_count + 1,
        updated_at = now()
    WHERE id = p_comment_id
    RETURNING upvote_count INTO v_new_count;

    RETURN jsonb_build_object('action', 'added', 'upvote_count', v_new_count);
  END IF;
END;
$$;

COMMENT ON FUNCTION toggle_upvote IS 'Toggle atômico de upvote. Zero race condition. Retorna ação + novo count.';
```

- [ ] **Step 2: Testar**

```sql
-- Simular: criar um comentário de teste e votar
SELECT toggle_upvote('COMMENT_UUID', 'USER_UUID');  -- action: added
SELECT toggle_upvote('COMMENT_UUID', 'USER_UUID');  -- action: removed
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/007_rpc_toggle_upvote.sql
git commit -m "feat(comments): add toggle_upvote RPC — atomic increment/decrement"
```

---

## Task 5: RPC `handle_soft_delete` (LGPD)

**Files:**
- Create: `supabase/migrations/008_rpc_handle_soft_delete.sql`

- [ ] **Step 1: Criar a RPC**

```sql
-- 008_rpc_handle_soft_delete.sql
CREATE OR REPLACE FUNCTION handle_soft_delete(p_comment_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reply_count integer;
  v_root_id uuid;
  v_question_id bigint;
BEGIN
  -- Buscar dados do comentário
  SELECT reply_count, root_id, question_id
  INTO v_reply_count, v_root_id, v_question_id
  FROM question_comments
  WHERE id = p_comment_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'comment_not_found');
  END IF;

  IF v_reply_count = 0 THEN
    -- Sem respostas → hard delete total
    -- Deletar edits primeiro (FK)
    DELETE FROM question_comment_edits WHERE comment_id = p_comment_id;
    -- Deletar votes
    DELETE FROM question_comment_votes WHERE comment_id = p_comment_id;
    -- Deletar reports
    DELETE FROM question_comment_reports WHERE comment_id = p_comment_id;
    -- Deletar o comentário
    DELETE FROM question_comments WHERE id = p_comment_id;

    -- Decrementar reply_count do pai (se é resposta)
    IF v_root_id IS NOT NULL THEN
      UPDATE question_comments
      SET reply_count = GREATEST(reply_count - 1, 0),
          updated_at = now()
      WHERE id = v_root_id;
    END IF;

    RETURN jsonb_build_object('action', 'hard_deleted', 'question_id', v_question_id);
  ELSE
    -- Com respostas → soft delete (LGPD: limpa conteúdo + mata histórico)
    UPDATE question_comments
    SET is_deleted = true,
        deleted_by = p_user_id,
        content_json = '{"type":"doc","content":[{"type":"p","children":[{"text":"[Comentário removido]"}]}]}'::jsonb,
        content_text = '[Comentário removido]',
        quoted_text = NULL,
        updated_at = now()
    WHERE id = p_comment_id;

    -- LGPD: destruir histórico de edições
    DELETE FROM question_comment_edits WHERE comment_id = p_comment_id;

    RETURN jsonb_build_object('action', 'soft_deleted', 'question_id', v_question_id, 'reply_count', v_reply_count);
  END IF;
END;
$$;

COMMENT ON FUNCTION handle_soft_delete IS 'Deleta comentário: hard se sem filhos, soft+LGPD se com filhos. Limpa conteúdo e histórico.';
```

- [ ] **Step 2: Testar cenários**

```sql
-- Cenário 1: comentário sem respostas → deve sumir completamente
-- Cenário 2: comentário com respostas → deve virar "[Comentário removido]", edits deletados
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/008_rpc_handle_soft_delete.sql
git commit -m "feat(comments): add handle_soft_delete RPC — LGPD-safe with reply_count check"
```

---

## Task 6: Function `get_comments_with_votes` (resolve N+1)

**Files:**
- Create: `supabase/migrations/009_rpc_get_comments_with_votes.sql`

- [ ] **Step 1: Criar a function**

```sql
-- 009_rpc_get_comments_with_votes.sql
CREATE OR REPLACE FUNCTION get_comments_with_votes(
  p_question_id bigint,
  p_user_id uuid,
  p_sort text DEFAULT 'votes'  -- 'votes' | 'recent' | 'professor'
)
RETURNS TABLE (
  id uuid,
  question_id bigint,
  user_id uuid,
  root_id uuid,
  reply_to_id uuid,
  content_json jsonb,
  content_text text,
  quoted_text text,
  is_pinned boolean,
  is_endorsed boolean,
  is_deleted boolean,
  is_author_shadowbanned boolean,
  upvote_count integer,
  reply_count integer,
  report_count integer,
  edit_count integer,
  last_edited_at timestamptz,
  created_at timestamptz,
  has_upvoted boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.question_id,
    c.user_id,
    c.root_id,
    c.reply_to_id,
    c.content_json,
    c.content_text,
    c.quoted_text,
    c.is_pinned,
    c.is_endorsed,
    c.is_deleted,
    c.is_author_shadowbanned,
    c.upvote_count,
    c.reply_count,
    c.report_count,
    c.edit_count,
    c.last_edited_at,
    c.created_at,
    (v.user_id IS NOT NULL) AS has_upvoted
  FROM question_comments c
  LEFT JOIN question_comment_votes v
    ON v.comment_id = c.id AND v.user_id = p_user_id
  WHERE c.question_id = p_question_id
    AND c.root_id IS NULL  -- Apenas roots (filhos carregados separadamente)
    AND (c.is_author_shadowbanned = false OR c.user_id = p_user_id)  -- Shadowban: só o autor vê
  ORDER BY
    c.is_pinned DESC,
    CASE
      WHEN p_sort = 'votes' THEN c.upvote_count
      WHEN p_sort = 'professor' THEN CASE WHEN c.is_endorsed THEN 1 ELSE 0 END
      ELSE 0
    END DESC,
    CASE WHEN p_sort = 'recent' THEN c.created_at END DESC NULLS LAST,
    c.created_at DESC;
END;
$$;

-- Function para carregar respostas de um thread (flat)
CREATE OR REPLACE FUNCTION get_comment_replies(
  p_root_id uuid,
  p_user_id uuid
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  root_id uuid,
  reply_to_id uuid,
  content_json jsonb,
  content_text text,
  quoted_text text,
  is_deleted boolean,
  is_author_shadowbanned boolean,
  upvote_count integer,
  edit_count integer,
  last_edited_at timestamptz,
  created_at timestamptz,
  has_upvoted boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.user_id,
    c.root_id,
    c.reply_to_id,
    c.content_json,
    c.content_text,
    c.quoted_text,
    c.is_deleted,
    c.is_author_shadowbanned,
    c.upvote_count,
    c.edit_count,
    c.last_edited_at,
    c.created_at,
    (v.user_id IS NOT NULL) AS has_upvoted
  FROM question_comments c
  LEFT JOIN question_comment_votes v
    ON v.comment_id = c.id AND v.user_id = p_user_id
  WHERE c.root_id = p_root_id
    AND (c.is_author_shadowbanned = false OR c.user_id = p_user_id)
  ORDER BY c.created_at ASC;
END;
$$;

COMMENT ON FUNCTION get_comments_with_votes IS 'Busca root comments + has_upvoted em 1 query. Resolve N+1. Shadowban filtrado.';
COMMENT ON FUNCTION get_comment_replies IS 'Busca flat replies de um thread + has_upvoted. Ordem cronológica.';
```

- [ ] **Step 2: Testar**

```sql
SELECT * FROM get_comments_with_votes(12345, 'USER_UUID', 'votes');
SELECT * FROM get_comment_replies('ROOT_UUID', 'USER_UUID');
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/009_rpc_get_comments_with_votes.sql
git commit -m "feat(comments): add get_comments_with_votes + get_comment_replies functions"
```

---

## Task 7: Triggers (reply_count, shadowban sync)

**Files:**
- Create: `supabase/migrations/010_triggers.sql`

- [ ] **Step 1: Criar triggers**

```sql
-- 010_triggers.sql

-- ==========================================
-- Trigger: auto-increment reply_count no pai
-- ==========================================
CREATE OR REPLACE FUNCTION trg_comment_reply_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.root_id IS NOT NULL THEN
    UPDATE question_comments
    SET reply_count = reply_count + 1, updated_at = now()
    WHERE id = NEW.root_id;
  END IF;

  -- Hard delete (cascade ou direto)
  IF TG_OP = 'DELETE' AND OLD.root_id IS NOT NULL THEN
    UPDATE question_comments
    SET reply_count = GREATEST(reply_count - 1, 0), updated_at = now()
    WHERE id = OLD.root_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER on_comment_insert_reply_count
  AFTER INSERT ON question_comments
  FOR EACH ROW
  EXECUTE FUNCTION trg_comment_reply_count();

CREATE TRIGGER on_comment_delete_reply_count
  AFTER DELETE ON question_comments
  FOR EACH ROW
  EXECUTE FUNCTION trg_comment_reply_count();

-- ==========================================
-- Trigger: report_count auto-increment
-- ==========================================
CREATE OR REPLACE FUNCTION trg_report_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE question_comments
    SET report_count = report_count + 1, updated_at = now()
    WHERE id = NEW.comment_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_report_insert
  AFTER INSERT ON question_comment_reports
  FOR EACH ROW
  EXECUTE FUNCTION trg_report_count();

-- ==========================================
-- Trigger: shadowban sync → question_comments
-- ==========================================
CREATE OR REPLACE FUNCTION trg_shadowban_sync()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_shadowbanned IS DISTINCT FROM OLD.is_shadowbanned THEN
    UPDATE question_comments
    SET is_author_shadowbanned = NEW.is_shadowbanned
    WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_shadowban_change
  AFTER UPDATE ON user_moderation
  FOR EACH ROW
  EXECUTE FUNCTION trg_shadowban_sync();

-- ==========================================
-- Trigger: updated_at auto-update
-- ==========================================
CREATE OR REPLACE FUNCTION trg_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at_comments
  BEFORE UPDATE ON question_comments
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

CREATE TRIGGER set_updated_at_notes
  BEFORE UPDATE ON question_notes
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

CREATE TRIGGER set_updated_at_moderation
  BEFORE UPDATE ON user_moderation
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();
```

- [ ] **Step 2: Testar triggers**

```sql
-- Inserir comentário com root_id → verificar reply_count++ no pai
-- Inserir report → verificar report_count++ no comentário
-- Atualizar shadowban → verificar is_author_shadowbanned em comments do user
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/010_triggers.sql
git commit -m "feat(comments): add triggers — reply_count, report_count, shadowban sync, updated_at"
```

---

## Task 8: RLS Policies

**Files:**
- Create: `supabase/migrations/011_rls_policies.sql`

- [ ] **Step 1: Habilitar RLS e criar policies**

```sql
-- 011_rls_policies.sql

-- ====== question_comments ======
ALTER TABLE question_comments ENABLE ROW LEVEL SECURITY;

-- Leitura: todos autenticados (shadowban filtrado na function, não no RLS)
CREATE POLICY "comments_select" ON question_comments
  FOR SELECT TO authenticated
  USING (true);

-- Inserir: autenticado + não em timeout
CREATE POLICY "comments_insert" ON question_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1 FROM user_moderation
      WHERE user_moderation.user_id = auth.uid()
        AND user_moderation.timeout_until > now()
    )
  );

-- Update: autor ou admin (para edição do próprio + pin/endorse por moderadores)
CREATE POLICY "comments_update" ON question_comments
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR auth.uid() IN (
    SELECT user_id FROM user_moderation WHERE false  -- Placeholder: admin check via RPC
  ));

-- Delete: via RPC handle_soft_delete (não direto)
CREATE POLICY "comments_delete" ON question_comments
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ====== question_comment_votes ======
ALTER TABLE question_comment_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "votes_select" ON question_comment_votes
  FOR SELECT TO authenticated USING (true);

-- Insert/delete via RPC toggle_upvote (SECURITY DEFINER bypassa RLS)

-- ====== question_comment_reports ======
ALTER TABLE question_comment_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports_insert" ON question_comment_reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "reports_select" ON question_comment_reports
  FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id);  -- Aluno vê só os próprios. Admin via RPC.

-- ====== question_notes ======
ALTER TABLE question_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notes_all" ON question_notes
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ====== user_moderation ======
ALTER TABLE user_moderation ENABLE ROW LEVEL SECURITY;

-- Leitura: só o próprio user vê se está em timeout (para mostrar mensagem)
CREATE POLICY "moderation_select_self" ON user_moderation
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Insert/update: via RPCs admin-only (SECURITY DEFINER)
```

- [ ] **Step 2: Testar RLS**

```sql
-- Como aluno: INSERT comentário → sucesso
-- Como aluno em timeout: INSERT → falha
-- Como aluno: SELECT question_notes do outro user → 0 rows
-- Como aluno: SELECT question_notes próprio → retorna
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/011_rls_policies.sql
git commit -m "feat(comments): add RLS policies — notes private, comments public, timeout check"
```

---

## Task 9: Edge Function `notify-api-stats`

**Files:**
- Create: `supabase/functions/notify-api-stats/index.ts`

- [ ] **Step 1: Criar Edge Function**

```typescript
// supabase/functions/notify-api-stats/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const VERUS_API_URL = Deno.env.get('VERUS_API_URL') || 'https://api.projetopapiro.com.br'
const VERUS_API_KEY = Deno.env.get('VERUS_WEBHOOK_SECRET') || ''

Deno.serve(async (req) => {
  try {
    const { question_id } = await req.json()
    if (!question_id) {
      return new Response(JSON.stringify({ error: 'question_id required' }), { status: 400 })
    }

    // Connect to Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Count comments (non-deleted)
    const { count: comments_count } = await supabase
      .from('question_comments')
      .select('*', { count: 'exact', head: true })
      .eq('question_id', question_id)
      .eq('is_deleted', false)

    // Check if any pinned comment exists
    const { count: pinned_count } = await supabase
      .from('question_comments')
      .select('*', { count: 'exact', head: true })
      .eq('question_id', question_id)
      .eq('is_pinned', true)
      .eq('is_deleted', false)

    const has_teacher_resolution = (pinned_count ?? 0) > 0

    // Call API Verus webhook with retry
    let lastError: Error | null = null
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(
          `${VERUS_API_URL}/api/v1/questoes/${question_id}/community-stats`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-Secret': VERUS_API_KEY,
            },
            body: JSON.stringify({
              comments_count: comments_count ?? 0,
              has_teacher_resolution,
            }),
          }
        )
        if (res.ok) {
          return new Response(JSON.stringify({ success: true, comments_count, has_teacher_resolution }))
        }
        lastError = new Error(`API returned ${res.status}`)
      } catch (e) {
        lastError = e as Error
      }
      // Wait before retry: 1s, 2s, 4s
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)))
    }

    return new Response(JSON.stringify({ error: lastError?.message }), { status: 502 })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 })
  }
})
```

- [ ] **Step 2: Configurar secrets no Supabase**

```bash
supabase secrets set VERUS_API_URL=https://api.projetopapiro.com.br
supabase secrets set VERUS_WEBHOOK_SECRET=<secret>
```

- [ ] **Step 3: Deploy**

```bash
supabase functions deploy notify-api-stats
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/notify-api-stats/index.ts
git commit -m "feat(comments): add Edge Function notify-api-stats with retry"
```

---

## Task 10: API Verus — model + migration + webhook endpoint

**Files:**
- Modify: `app/models/questao.py` (verus_api)
- Create: `alembic/versions/YYYYMMDD_add_community_stats.py` (verus_api)
- Modify: `app/api/v1/routes/questoes.py` (verus_api)
- Modify: `app/schemas/questao.py` (verus_api)

- [ ] **Step 1: Adicionar colunas ao model**

Em `app/models/questao.py`, após `tem_comentario`:
```python
    comments_count = Column(Integer, default=0, server_default="0")
    has_teacher_resolution = Column(Boolean, default=False, server_default="false")
```

- [ ] **Step 2: Criar migration Alembic**

```bash
cd C:/Users/Home/Desktop/verus_api
alembic revision --autogenerate -m "add community stats columns"
```

- [ ] **Step 3: Aplicar migration**

```bash
alembic upgrade head
```

- [ ] **Step 4: Adicionar campos ao schema de response**

Em `app/schemas/questao.py`, no `QuestaoCaracteristicas` ou response model:
```python
comments_count: int = 0
has_teacher_resolution: bool = False
```

- [ ] **Step 5: Criar endpoint webhook**

Em `app/api/v1/routes/questoes.py`:
```python
from fastapi import Header

@router.patch("/{questao_id}/community-stats")
def update_community_stats(
    questao_id: int,
    body: dict,
    x_webhook_secret: str = Header(...),
    db: Session = Depends(get_db),
):
    """Webhook receptor do Supabase Edge Function"""
    expected_secret = os.environ.get("WEBHOOK_SECRET", "")
    if x_webhook_secret != expected_secret:
        raise HTTPException(status_code=403, detail="Invalid webhook secret")

    questao = db.query(Questao).filter(Questao.id == questao_id).first()
    if not questao:
        raise HTTPException(status_code=404, detail="Questão não encontrada")

    if "comments_count" in body:
        questao.comments_count = body["comments_count"]
    if "has_teacher_resolution" in body:
        questao.has_teacher_resolution = body["has_teacher_resolution"]

    db.commit()
    return {"ok": True}
```

- [ ] **Step 6: Adicionar filtro `has_teacher_resolution`**

No endpoint de listagem/busca existente, adicionar suporte ao parâmetro:
```python
has_teacher_resolution: Optional[bool] = Query(None)
```

E no service/query:
```python
if has_teacher_resolution is not None:
    query = query.filter(Questao.has_teacher_resolution == has_teacher_resolution)
```

- [ ] **Step 7: Testar endpoint**

```bash
curl -X PATCH http://localhost:8000/api/v1/questoes/12345/community-stats \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: <secret>" \
  -d '{"comments_count": 5, "has_teacher_resolution": true}'
```

Expected: `{"ok": true}`

- [ ] **Step 8: Commit**

```bash
cd C:/Users/Home/Desktop/verus_api
git add -A
git commit -m "feat(api): add community stats webhook + has_teacher_resolution filter"
```

---

## Task 11: Supabase Storage bucket

- [ ] **Step 1: Criar bucket via Supabase Dashboard**

Bucket: `comment-media`
- Public: true (URLs acessíveis sem auth para renderizar nas imagens)
- File size limit: 50MB
- Allowed MIME types: `image/jpeg, image/png, image/gif, image/webp, audio/webm, audio/ogg, video/mp4, video/webm`

- [ ] **Step 2: Criar policy de upload**

```sql
-- Apenas autenticados podem fazer upload
CREATE POLICY "authenticated_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'comment-media');

-- Todos podem ler (URLs públicas)
CREATE POLICY "public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'comment-media');

-- Autor pode deletar seus uploads
CREATE POLICY "owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'comment-media' AND auth.uid()::text = (storage.foldername(name))[1]);
```

Nota: estrutura de path recomendada: `comment-media/{user_id}/{timestamp}_{filename}`

- [ ] **Step 3: Commit documentação**

```bash
git add docs/
git commit -m "docs: document Supabase Storage bucket setup for comment media"
```

---

## Checklist de verificação final

Após todas as tasks, verificar:

- [ ] 6 tabelas criadas no Supabase (comments, votes, reports, edits, notes, moderation)
- [ ] 4 índices otimizados em question_comments
- [ ] 3 RPCs funcionando (toggle_upvote, handle_soft_delete, get_comments_with_votes)
- [ ] 5 triggers ativos (reply_count insert/delete, report_count, shadowban sync, updated_at)
- [ ] RLS habilitado em todas as tabelas
- [ ] Edge Function deployada e chamando API Verus
- [ ] API Verus: 2 colunas novas + webhook endpoint + filtro
- [ ] Storage bucket criado com policies
