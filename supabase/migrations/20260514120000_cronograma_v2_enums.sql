-- UP: novos enums do Cronograma V2
-- DOWN: DROP TYPE em ordem reversa

-- Nível de conhecimento por disciplina (declarado pelo user)
DO $$ BEGIN
  CREATE TYPE nivel_conhecimento_enum AS ENUM (
    'iniciante', 'intermediario', 'avancado'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Frequência de simulados periódicos
DO $$ BEGIN
  CREATE TYPE simulados_freq_enum AS ENUM (
    'nenhum', 'mensal', 'quinzenal', 'semanal'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Tipo de material preferido pelo usuário
DO $$ BEGIN
  CREATE TYPE tipo_material_enum AS ENUM (
    'video', 'pdf', 'livro', 'questoes', 'misto'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Horário preferido de estudo
DO $$ BEGIN
  CREATE TYPE horario_preferido_enum AS ENUM (
    'manha', 'tarde', 'noite', 'madrugada', 'flexivel'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Visibility de templates (oficial / publico / privado)
DO $$ BEGIN
  CREATE TYPE plan_template_visibility AS ENUM (
    'publico', 'privado', 'oficial'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Adiciona valor 'rascunho' no enum existente plano_status
-- (DO BEGIN/EXCEPTION para idempotência; ADD VALUE não suporta IF NOT EXISTS antes do PG 14)
DO $$ BEGIN
  ALTER TYPE plano_status ADD VALUE IF NOT EXISTS 'rascunho' BEFORE 'ativo';
EXCEPTION WHEN duplicate_object THEN null; END $$;
