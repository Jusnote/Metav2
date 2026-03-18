-- ============================================================
-- UPGRADE: Role-based access + RPC atômico para Lei Seca
-- Execute no SQL Editor do Supabase Dashboard
-- ============================================================

-- 1. CRIAR TABELA PROFILES (com role)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Constraint para valores válidos
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('user', 'admin'));

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles são públicos para leitura" ON public.profiles;
CREATE POLICY "Profiles são públicos para leitura"
  ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Usuário edita próprio perfil" ON public.profiles;
CREATE POLICY "Usuário edita próprio perfil"
  ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuário cria próprio perfil" ON public.profiles;
CREATE POLICY "Usuário cria próprio perfil"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Trigger: atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: criar perfil automaticamente no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.email),
    'user'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Criar perfil para usuários existentes que ainda não têm
INSERT INTO public.profiles (user_id, display_name, role)
SELECT id, COALESCE(raw_user_meta_data ->> 'display_name', email), 'user'
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.profiles)
ON CONFLICT (user_id) DO NOTHING;

-- 2. RPC ATÔMICO: UPSERT LEI + REPLACE ARTIGOS EM TRANSAÇÃO
-- ============================================================
CREATE OR REPLACE FUNCTION upsert_lei_com_artigos(
  p_lei JSONB,
  p_artigos JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_lei_id TEXT;
  v_inserted INT := 0;
BEGIN
  v_lei_id := p_lei->>'id';

  IF v_lei_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'lei.id é obrigatório');
  END IF;

  -- Upsert da lei
  INSERT INTO leis (id, numero, nome, sigla, ementa, data_publicacao, hierarquia, total_artigos, updated_at)
  VALUES (
    v_lei_id,
    p_lei->>'numero',
    p_lei->>'nome',
    p_lei->>'sigla',
    p_lei->>'ementa',
    (p_lei->>'data_publicacao')::DATE,
    p_lei->'hierarquia',
    (p_lei->>'total_artigos')::INT,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    numero = EXCLUDED.numero,
    nome = EXCLUDED.nome,
    sigla = EXCLUDED.sigla,
    ementa = EXCLUDED.ementa,
    data_publicacao = EXCLUDED.data_publicacao,
    hierarquia = EXCLUDED.hierarquia,
    total_artigos = EXCLUDED.total_artigos,
    updated_at = NOW();

  -- Deletar artigos antigos (CASCADE-safe)
  DELETE FROM artigos WHERE lei_id = v_lei_id;

  -- Inserir novos artigos (DISTINCT ON evita duplicatas no lote; ON CONFLICT cobre re-uploads)
  INSERT INTO artigos (id, lei_id, numero, slug, epigrafe, plate_content, texto_plano, search_text, vigente, contexto, path, content_hash, revoked_versions, updated_at)
  SELECT DISTINCT ON (a->>'id')
    a->>'id',
    v_lei_id,
    a->>'numero',
    a->>'slug',
    COALESCE(a->>'epigrafe', ''),
    a->'plate_content',
    a->>'texto_plano',
    a->>'search_text',
    COALESCE((a->>'vigente')::BOOLEAN, true),
    a->>'contexto',
    a->'path',
    a->>'content_hash',
    COALESCE(a->'revoked_versions', '[]'::JSONB),
    NOW()
  FROM jsonb_array_elements(p_artigos) AS a
  -- Prioriza vigente=true quando há duplicatas no lote
  ORDER BY a->>'id', COALESCE((a->>'vigente')::BOOLEAN, true) DESC
  ON CONFLICT (id) DO UPDATE SET
    numero         = EXCLUDED.numero,
    slug           = EXCLUDED.slug,
    epigrafe       = EXCLUDED.epigrafe,
    plate_content  = EXCLUDED.plate_content,
    texto_plano    = EXCLUDED.texto_plano,
    search_text    = EXCLUDED.search_text,
    vigente        = EXCLUDED.vigente,
    contexto       = EXCLUDED.contexto,
    path           = EXCLUDED.path,
    content_hash   = EXCLUDED.content_hash,
    revoked_versions = EXCLUDED.revoked_versions,
    updated_at     = NOW();

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'lei_id', v_lei_id,
    'artigos_inseridos', v_inserted
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- 3. PROMOVER SEU USUÁRIO A ADMIN (substitua pelo seu email)
-- ============================================================
-- UPDATE public.profiles
-- SET role = 'admin'
-- WHERE user_id = (SELECT id FROM auth.users WHERE email = 'SEU_EMAIL@aqui.com');
