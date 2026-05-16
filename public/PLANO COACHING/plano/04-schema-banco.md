# 04 — Schema do Banco de Dados

> Schema completo do Postgres no Supabase. Todas as migrações devem ser criadas em `/supabase/migrations/` com timestamps incrementais.

## Princípios

1. **UUID em todos os IDs** (`gen_random_uuid()`)
2. **`criado_em` e `atualizado_em`** com `TIMESTAMPTZ DEFAULT NOW()` em toda tabela mutável
3. **Soft delete** quando perda é grave (alunos, conteúdos) — campo `deletado_em TIMESTAMPTZ NULL`
4. **RLS ativa** em toda tabela com dados de aluno
5. **JSONB** para dados semiestruturados (Tiptap, alternativas, configurações)
6. **Índices** em todas as colunas de hot path

## Migrações (ordem)

### Migration 001 — Setup inicial

```sql
-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Função de trigger para atualizado_em
CREATE OR REPLACE FUNCTION update_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Migration 002 — Concursos e edital

```sql
CREATE TABLE concursos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  banca TEXT NOT NULL,
  cargo TEXT NOT NULL,
  nivel TEXT, -- medio | superior
  data_prova DATE,
  edital_url TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho' 
    CHECK (status IN ('rascunho', 'revisao', 'publicado', 'arquivado')),
  publicado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_concursos_status ON concursos(status) WHERE status = 'publicado';

CREATE TRIGGER trg_concursos_atualizado
  BEFORE UPDATE ON concursos
  FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();

CREATE TABLE editais_raw (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concurso_id UUID NOT NULL REFERENCES concursos(id) ON DELETE CASCADE,
  texto_bruto TEXT NOT NULL,
  fonte TEXT CHECK (fonte IN ('pdf', 'colado', 'url')),
  url_original TEXT,
  versao INT NOT NULL DEFAULT 1,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_editais_concurso ON editais_raw(concurso_id, versao DESC);
```

### Migration 003 — Árvore de conteúdo

```sql
CREATE TABLE disciplinas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concurso_id UUID NOT NULL REFERENCES concursos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  horas_totais NUMERIC(5,1) NOT NULL,
  nivel TEXT CHECK (nivel IN ('basico', 'intermediario', 'avancado')),
  cor TEXT DEFAULT 'azul', -- chave para mapeamento no front
  ordem INT NOT NULL,
  observacoes_globais JSONB,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(concurso_id, ordem)
);

CREATE INDEX idx_disciplinas_concurso ON disciplinas(concurso_id, ordem);

CREATE TRIGGER trg_disciplinas_atualizado
  BEFORE UPDATE ON disciplinas
  FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();

CREATE TABLE blocos_tematicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  disciplina_id UUID NOT NULL REFERENCES disciplinas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  horas_bloco NUMERIC(5,1),
  ordem INT NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(disciplina_id, ordem)
);

CREATE INDEX idx_blocos_disciplina ON blocos_tematicos(disciplina_id, ordem);

CREATE TABLE topicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bloco_id UUID NOT NULL REFERENCES blocos_tematicos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  natureza TEXT NOT NULL CHECK (natureza IN (
    'doutrina', 'doutrina_pratica', 'pratica', 'pratica_intensiva',
    'lei_seca', 'lei_seca_mais_doutrina', 'jurisprudencia', 'misto'
  )),
  peso_incidencia INT NOT NULL CHECK (peso_incidencia BETWEEN 1 AND 5),
  horas_sugeridas NUMERIC(4,1) NOT NULL,
  tipo_revisao TEXT,
  observacao TEXT,
  pre_requisito_topico_id UUID REFERENCES topicos(id),
  ordem INT NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bloco_id, ordem)
);

CREATE INDEX idx_topicos_bloco ON topicos(bloco_id, ordem);
CREATE INDEX idx_topicos_peso ON topicos(peso_incidencia DESC);

CREATE TRIGGER trg_topicos_atualizado
  BEFORE UPDATE ON topicos
  FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();

CREATE TABLE subtopicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topico_id UUID NOT NULL REFERENCES topicos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  horas_sugeridas NUMERIC(4,1),
  ordem INT NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(topico_id, ordem)
);

CREATE INDEX idx_subtopicos_topico ON subtopicos(topico_id, ordem);
```

### Migration 004 — Conteúdos e questões

```sql
CREATE TABLE conteudos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topico_id UUID NOT NULL REFERENCES topicos(id) ON DELETE CASCADE,
  subtopico_id UUID REFERENCES subtopicos(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN (
    'teoria', 'lei_seca', 'resumo', 'mapa_mental', 'jurisprudencia'
  )),
  titulo TEXT NOT NULL,
  corpo_json JSONB NOT NULL, -- saída do Tiptap
  duracao_estimada_min INT NOT NULL DEFAULT 30,
  ordem INT NOT NULL DEFAULT 1,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conteudos_topico ON conteudos(topico_id, ativo) WHERE ativo = true;
CREATE INDEX idx_conteudos_subtopico ON conteudos(subtopico_id) WHERE subtopico_id IS NOT NULL;

CREATE TRIGGER trg_conteudos_atualizado
  BEFORE UPDATE ON conteudos
  FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();

CREATE TABLE questoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topico_id UUID NOT NULL REFERENCES topicos(id) ON DELETE CASCADE,
  subtopico_id UUID REFERENCES subtopicos(id) ON DELETE SET NULL,
  enunciado TEXT NOT NULL,
  alternativas JSONB, -- [{"letra":"A","texto":"..."}]
  gabarito TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('certo_errado', 'multipla_escolha')),
  banca TEXT,
  ano INT,
  comentario_json JSONB, -- saída do Tiptap com a análise do mentor
  dificuldade_estimada INT CHECK (dificuldade_estimada BETWEEN 1 AND 5),
  ativa BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_questoes_topico ON questoes(topico_id, ativa) WHERE ativa = true;
CREATE INDEX idx_questoes_subtopico ON questoes(subtopico_id) WHERE subtopico_id IS NOT NULL;
CREATE INDEX idx_questoes_banca_ano ON questoes(banca, ano);

CREATE TRIGGER trg_questoes_atualizado
  BEFORE UPDATE ON questoes
  FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();
```

### Migration 005 — Alunos

```sql
CREATE TABLE alunos (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  concurso_id UUID REFERENCES concursos(id),
  data_inicio DATE DEFAULT CURRENT_DATE,
  horas_por_dia JSONB NOT NULL DEFAULT 
    '{"seg":2,"ter":2,"qua":2,"qui":2,"sex":2,"sab":4,"dom":2}'::jsonb,
  horario_pico TEXT DEFAULT 'manha' CHECK (horario_pico IN ('manha', 'tarde', 'noite')),
  role TEXT NOT NULL DEFAULT 'aluno' CHECK (role IN ('aluno', 'admin')),
  onboarding_completo BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  deletado_em TIMESTAMPTZ
);

CREATE INDEX idx_alunos_concurso ON alunos(concurso_id) WHERE deletado_em IS NULL;
CREATE INDEX idx_alunos_role ON alunos(role);

CREATE TRIGGER trg_alunos_atualizado
  BEFORE UPDATE ON alunos
  FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();
```

### Migration 006 — Semanas e atividades

```sql
CREATE TABLE semanas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  numero INT NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'bloqueada' 
    CHECK (status IN ('bloqueada', 'atual', 'concluida')),
  qualidade_pct NUMERIC(5,2),
  horas_planejadas NUMERIC(5,1),
  horas_estudadas NUMERIC(5,1) DEFAULT 0,
  concluida_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(aluno_id, numero)
);

CREATE INDEX idx_semanas_aluno_status ON semanas(aluno_id, status);
CREATE INDEX idx_semanas_atual ON semanas(aluno_id) WHERE status = 'atual';

CREATE TABLE atividades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semana_id UUID NOT NULL REFERENCES semanas(id) ON DELETE CASCADE,
  aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  topico_id UUID REFERENCES topicos(id),
  subtopico_id UUID REFERENCES subtopicos(id),
  conteudo_id UUID REFERENCES conteudos(id),
  tipo TEXT NOT NULL CHECK (tipo IN (
    'teoria', 'questoes', 'lei_seca', 'resumo', 
    'mapa_mental', 'revisao_fsrs', 'simulado'
  )),
  titulo TEXT NOT NULL,
  duracao_estimada_min INT NOT NULL,
  duracao_real_min INT,
  status TEXT NOT NULL DEFAULT 'pendente' 
    CHECK (status IN ('pendente', 'em_andamento', 'concluida', 'pulada')),
  desempenho_pct NUMERIC(5,2),
  peso_incidencia INT,
  origem TEXT NOT NULL DEFAULT 'planejada' 
    CHECK (origem IN ('planejada', 'fsrs_due', 'reforco_manual')),
  ordem_sugerida INT,
  iniciada_em TIMESTAMPTZ,
  concluida_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_atividades_aluno_semana ON atividades(aluno_id, semana_id);
CREATE INDEX idx_atividades_pendentes ON atividades(aluno_id, status) WHERE status = 'pendente';
CREATE INDEX idx_atividades_fsrs_due ON atividades(aluno_id, origem) WHERE origem = 'fsrs_due';
CREATE INDEX idx_atividades_topico ON atividades(topico_id, status);
```

### Migration 007 — FSRS

```sql
CREATE TABLE fsrs_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  subtopico_id UUID NOT NULL REFERENCES subtopicos(id) ON DELETE CASCADE,
  difficulty NUMERIC(8,4) NOT NULL,
  stability NUMERIC(8,4) NOT NULL,
  retrievability NUMERIC(8,4),
  state TEXT NOT NULL CHECK (state IN ('new', 'learning', 'review', 'relearning')),
  due_date TIMESTAMPTZ NOT NULL,
  last_review TIMESTAMPTZ,
  review_count INT NOT NULL DEFAULT 0,
  lapse_count INT NOT NULL DEFAULT 0,
  scheduled_days INT NOT NULL DEFAULT 0,
  elapsed_days INT NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(aluno_id, subtopico_id)
);

CREATE INDEX idx_fsrs_due ON fsrs_cards(aluno_id, due_date);
CREATE INDEX idx_fsrs_state ON fsrs_cards(aluno_id, state);
CREATE INDEX idx_fsrs_retrievability ON fsrs_cards(aluno_id, retrievability) WHERE retrievability IS NOT NULL;

CREATE TRIGGER trg_fsrs_cards_atualizado
  BEFORE UPDATE ON fsrs_cards
  FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();

CREATE TABLE fsrs_reviews_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES fsrs_cards(id) ON DELETE CASCADE,
  aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 4),
  acertos INT NOT NULL,
  total_questoes INT NOT NULL,
  taxa_acerto NUMERIC(5,2) NOT NULL,
  duracao_segundos INT,
  difficulty_antes NUMERIC(8,4) NOT NULL,
  stability_antes NUMERIC(8,4) NOT NULL,
  difficulty_depois NUMERIC(8,4) NOT NULL,
  stability_depois NUMERIC(8,4) NOT NULL,
  due_anterior TIMESTAMPTZ,
  due_proxima TIMESTAMPTZ NOT NULL,
  revisado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reviews_card ON fsrs_reviews_log(card_id, revisado_em DESC);
CREATE INDEX idx_reviews_aluno ON fsrs_reviews_log(aluno_id, revisado_em DESC);
```

### Migration 008 — Tentativas de questões

```sql
CREATE TABLE tentativas_questoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  questao_id UUID NOT NULL REFERENCES questoes(id) ON DELETE CASCADE,
  atividade_id UUID REFERENCES atividades(id) ON DELETE SET NULL,
  resposta TEXT NOT NULL,
  acertou BOOLEAN NOT NULL,
  tempo_segundos INT NOT NULL,
  comentario_lido BOOLEAN DEFAULT false,
  respondida_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tentativas_aluno ON tentativas_questoes(aluno_id, respondida_em DESC);
CREATE INDEX idx_tentativas_questao ON tentativas_questoes(questao_id, aluno_id);
CREATE INDEX idx_tentativas_atividade ON tentativas_questoes(atividade_id) WHERE atividade_id IS NOT NULL;
```

### Migration 009 — Eventos e analytics

```sql
-- Para registrar eventos de produto (não dados sensíveis)
CREATE TABLE eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id UUID REFERENCES alunos(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL, -- onboarding_iniciado, atividade_concluida, etc
  payload JSONB,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_eventos_aluno_tipo ON eventos(aluno_id, tipo, criado_em DESC);
CREATE INDEX idx_eventos_tipo ON eventos(tipo, criado_em DESC);
```

### Migration 010 — Row Level Security

```sql
-- Helper para checar se é admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM alunos 
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE SQL SECURITY DEFINER;

-- ALUNOS
ALTER TABLE alunos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aluno_ve_proprio" ON alunos
  FOR SELECT USING (auth.uid() = id OR is_admin());

CREATE POLICY "aluno_edita_proprio" ON alunos
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "admin_edita_tudo" ON alunos
  FOR ALL USING (is_admin());

-- CONCURSOS, DISCIPLINAS, BLOCOS, TOPICOS, SUBTOPICOS — leitura pública para publicados
ALTER TABLE concursos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "concursos_publicados_visiveis" ON concursos
  FOR SELECT USING (status = 'publicado' OR is_admin());
CREATE POLICY "admin_gerencia_concursos" ON concursos
  FOR ALL USING (is_admin());

ALTER TABLE disciplinas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "disciplinas_visiveis" ON disciplinas
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM concursos WHERE id = concurso_id AND status = 'publicado')
    OR is_admin()
  );
CREATE POLICY "admin_gerencia_disciplinas" ON disciplinas
  FOR ALL USING (is_admin());

-- (repetir padrão para blocos_tematicos, topicos, subtopicos)

-- CONTEUDOS — só aluno do concurso vê
ALTER TABLE conteudos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conteudos_para_alunos_do_concurso" ON conteudos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM topicos t
      JOIN blocos_tematicos b ON b.id = t.bloco_id
      JOIN disciplinas d ON d.id = b.disciplina_id
      JOIN alunos a ON a.concurso_id = d.concurso_id
      WHERE t.id = conteudos.topico_id AND a.id = auth.uid()
    ) OR is_admin()
  );
CREATE POLICY "admin_gerencia_conteudos" ON conteudos
  FOR ALL USING (is_admin());

-- (mesmo padrão para questoes)

-- SEMANAS e ATIVIDADES — só do próprio aluno
ALTER TABLE semanas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aluno_ve_proprias_semanas" ON semanas
  FOR ALL USING (auth.uid() = aluno_id OR is_admin());

ALTER TABLE atividades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aluno_ve_proprias_atividades" ON atividades
  FOR ALL USING (auth.uid() = aluno_id OR is_admin());

-- FSRS — só do próprio aluno
ALTER TABLE fsrs_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aluno_ve_proprios_cards" ON fsrs_cards
  FOR ALL USING (auth.uid() = aluno_id OR is_admin());

ALTER TABLE fsrs_reviews_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aluno_ve_proprios_reviews" ON fsrs_reviews_log
  FOR ALL USING (auth.uid() = aluno_id OR is_admin());

ALTER TABLE tentativas_questoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aluno_ve_proprias_tentativas" ON tentativas_questoes
  FOR ALL USING (auth.uid() = aluno_id OR is_admin());

-- EVENTOS — admin vê tudo, aluno só os próprios
ALTER TABLE eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eventos_proprios_ou_admin" ON eventos
  FOR SELECT USING (auth.uid() = aluno_id OR is_admin());
CREATE POLICY "qualquer_um_insere_eventos" ON eventos
  FOR INSERT WITH CHECK (true);
```

### Migration 011 — Views úteis

```sql
-- View: progresso do aluno por disciplina
CREATE VIEW v_progresso_disciplinas AS
SELECT 
  a.id AS aluno_id,
  d.id AS disciplina_id,
  d.nome AS disciplina_nome,
  d.horas_totais,
  COUNT(DISTINCT t.id) AS total_topicos,
  COUNT(DISTINCT CASE WHEN at.status = 'concluida' AND at.tipo = 'teoria' THEN t.id END) AS topicos_com_teoria,
  COUNT(DISTINCT CASE WHEN fc.id IS NOT NULL THEN st.id END) AS subtopicos_em_fsrs,
  AVG(at.desempenho_pct) FILTER (WHERE at.tipo = 'questoes') AS desempenho_medio
FROM alunos a
JOIN concursos c ON c.id = a.concurso_id
JOIN disciplinas d ON d.concurso_id = c.id
JOIN blocos_tematicos b ON b.disciplina_id = d.id
JOIN topicos t ON t.bloco_id = b.id
LEFT JOIN subtopicos st ON st.topico_id = t.id
LEFT JOIN atividades at ON at.topico_id = t.id AND at.aluno_id = a.id
LEFT JOIN fsrs_cards fc ON fc.subtopico_id = st.id AND fc.aluno_id = a.id
GROUP BY a.id, d.id, d.nome, d.horas_totais;

-- View: cards FSRS em risco (R < 0.7)
CREATE VIEW v_memoria_em_risco AS
SELECT 
  fc.aluno_id,
  fc.subtopico_id,
  st.nome AS subtopico_nome,
  t.nome AS topico_nome,
  d.nome AS disciplina_nome,
  fc.retrievability,
  fc.due_date,
  fc.last_review,
  fc.lapse_count
FROM fsrs_cards fc
JOIN subtopicos st ON st.id = fc.subtopico_id
JOIN topicos t ON t.id = st.topico_id
JOIN blocos_tematicos b ON b.id = t.bloco_id
JOIN disciplinas d ON d.id = b.disciplina_id
WHERE fc.retrievability < 0.7 OR fc.due_date <= NOW()
ORDER BY fc.due_date ASC;
```

## Tipos TypeScript derivados

Após criar as migrações, gerar tipos:

```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/database.ts
```

E tipos de domínio em `types/domain.ts`:

```ts
import type { Database } from './database'

export type Atividade = Database['public']['Tables']['atividades']['Row']
export type AtividadeInsert = Database['public']['Tables']['atividades']['Insert']

export type TipoAtividade = 
  | 'teoria' | 'questoes' | 'lei_seca' | 'resumo' 
  | 'mapa_mental' | 'revisao_fsrs' | 'simulado'

export type StatusAtividade = 'pendente' | 'em_andamento' | 'concluida' | 'pulada'

export type Natureza = 
  | 'doutrina' | 'doutrina_pratica' | 'pratica' | 'pratica_intensiva'
  | 'lei_seca' | 'lei_seca_mais_doutrina' | 'jurisprudencia' | 'misto'

export type EstadoFSRS = 'new' | 'learning' | 'review' | 'relearning'

export interface TopicoComMetadata extends Database['public']['Tables']['topicos']['Row'] {
  bloco: Database['public']['Tables']['blocos_tematicos']['Row']
  subtopicos: Database['public']['Tables']['subtopicos']['Row'][]
}
```

## Decisões em aberto

1. **Auditoria completa:** colocar tabela `auditoria` que loga toda mudança? **Default: não no MVP, eventos já cobrem o essencial.**
2. **Particionamento:** `tentativas_questoes` e `fsrs_reviews_log` crescem rápido. **Default: sem particionamento até passar de 1M de registros.**
3. **Pesquisa full-text:** em questões e conteúdos. **Default: V2 — usar `pg_trgm` se precisar.**
