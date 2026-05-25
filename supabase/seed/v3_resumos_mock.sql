-- ============================================================
-- SEED MOCK: PC-BA · Informática · Aula 00
-- Cria 1 concurso + 1 disciplina + 1 bloco temático + 1 aula + 7 blocos
-- pra ver a UI de Resumos V3 funcionando antes de importar JSONs reais.
-- ============================================================
-- COMO RODAR: cole no SQL Editor do Supabase Studio e Run.
-- Idempotente: usa UUIDs fixos + ON CONFLICT DO NOTHING.
-- ============================================================

BEGIN;

-- 1) CONCURSO
INSERT INTO coaching.concursos (id, nome, banca, cargo, nivel, status)
VALUES (
  '11111111-0000-4000-8000-000000000001',
  'PC-BA · Investigador',
  'Cebraspe',
  'Investigador',
  'superior',
  'publicado'
)
ON CONFLICT (id) DO NOTHING;

-- 2) DISCIPLINA
INSERT INTO coaching.disciplinas (id, concurso_id, nome, horas_totais, nivel, cor, ordem)
VALUES (
  '11111111-0000-4000-8000-000000000010',
  '11111111-0000-4000-8000-000000000001',
  'Informática',
  42.0,
  'intermediario',
  'azul',
  1
)
ON CONFLICT (id) DO NOTHING;

-- 3) BLOCO TEMÁTICO (intermediário entre disciplina e tópico)
INSERT INTO coaching.blocos_tematicos (id, disciplina_id, nome, horas_bloco, ordem)
VALUES (
  '11111111-0000-4000-8000-000000000100',
  '11111111-0000-4000-8000-000000000010',
  'Conteúdo Programático',
  42.0,
  1
)
ON CONFLICT (id) DO NOTHING;

-- 4) TÓPICO = AULA 00
INSERT INTO coaching.topicos (
  id, bloco_id, nome, natureza, peso_incidencia, horas_sugeridas, ordem
)
VALUES (
  '11111111-0000-4000-8000-000000001000',
  '11111111-0000-4000-8000-000000000100',
  'Aula 00 — Noções de Internet (primeira parte)',
  'misto',
  3,
  3.25,
  1
)
ON CONFLICT (id) DO NOTHING;

-- 5) SUBTÓPICOS = blocos do cronograma (7 da Aula 00 validada)
INSERT INTO coaching.subtopicos (id, topico_id, nome, horas_sugeridas, ordem) VALUES
  ('11111111-0000-4000-8000-000000010001',
   '11111111-0000-4000-8000-000000001000',
   'Conceitos de Redes e Tipos de Transmissão',
   0.45, 1),
  ('11111111-0000-4000-8000-000000010002',
   '11111111-0000-4000-8000-000000001000',
   'Meios, Equipamentos e Padrões de Rede',
   0.4, 2),
  ('11111111-0000-4000-8000-000000010003',
   '11111111-0000-4000-8000-000000001000',
   'Internet — Origem e Funcionamento',
   0.4, 3),
  ('11111111-0000-4000-8000-000000010004',
   '11111111-0000-4000-8000-000000001000',
   'Web e suas Gerações',
   0.45, 4),
  ('11111111-0000-4000-8000-000000010005',
   '11111111-0000-4000-8000-000000001000',
   'Deep Web e Dark Web',
   0.45, 5),
  ('11111111-0000-4000-8000-000000010006',
   '11111111-0000-4000-8000-000000001000',
   'IoT e Acesso via Telefonia Fixa',
   0.55, 6),
  ('11111111-0000-4000-8000-000000010007',
   '11111111-0000-4000-8000-000000001000',
   'Acesso via Cabo, Rádio e Móvel',
   0.55, 7)
ON CONFLICT (id) DO NOTHING;

-- 6) RESUMOS — 3 já publicados, 1 rascunho (pro "Continue de onde parou"), 3 pendentes
-- Bloco 1: publicado
INSERT INTO coaching.resumos (
  id, subtopico_id, conteudo_plate, status, tldr, takeaways, publicado_em
) VALUES (
  '11111111-0000-4000-8000-000000100001',
  '11111111-0000-4000-8000-000000010001',
  '[{"type":"p","children":[{"text":"Resumo dos conceitos básicos de redes — exemplo seed."}]}]'::JSONB,
  'publicado',
  'Redes interligam computadores para troca de dados. Diferenciam-se por dimensão (PAN/LAN/MAN/WAN), arquitetura (P2P/Cliente-Servidor) e direção (Simplex/Half/Full-Duplex).',
  '["Cebraspe cobra distinção entre LAN, MAN e WAN", "Half-Duplex permite duas direções, mas não simultâneas", "Unicast = 1:1, Multicast = 1:N, Broadcast = 1:todos"]'::JSONB,
  NOW() - INTERVAL '5 days'
)
ON CONFLICT (subtopico_id) DO NOTHING;

-- Bloco 2: rascunho (último editado → vai pro "Continue de onde parou")
INSERT INTO coaching.resumos (
  id, subtopico_id, conteudo_plate, status, tldr, takeaways, atualizado_em
) VALUES (
  '11111111-0000-4000-8000-000000100002',
  '11111111-0000-4000-8000-000000010002',
  '[{"type":"p","children":[{"text":"Rascunho do bloco 2 — em escrita."}]}]'::JSONB,
  'rascunho',
  'Meios de transmissão (guiados/não-guiados), equipamentos (hub, switch, roteador) e padrões IEEE.',
  '[]'::JSONB,
  NOW() - INTERVAL '2 hours'
)
ON CONFLICT (subtopico_id) DO NOTHING;

-- Bloco 3: publicado
INSERT INTO coaching.resumos (
  id, subtopico_id, conteudo_plate, status, tldr, takeaways, publicado_em
) VALUES (
  '11111111-0000-4000-8000-000000100003',
  '11111111-0000-4000-8000-000000010003',
  '[{"type":"h2","children":[{"text":"Conceitos básicos"}]},{"type":"p","children":[{"text":"A "},{"text":"Internet","bold":true},{"text":" é uma rede mundial de computadores interconectados que utilizam o conjunto de protocolos TCP/IP."}]},{"type":"h2","children":[{"text":"História da Internet"}]},{"type":"p","children":[{"text":"Nasceu na Guerra Fria como rede militar descentralizada (ARPANET, 1969)."}]},{"type":"h2","children":[{"text":"Comutação por circuito × pacotes"}]},{"type":"p","children":[{"text":"A inovação técnica da ARPANET foi a comutação por pacotes, que substitui a comutação por circuito da telefonia tradicional."}]},{"type":"h2","children":[{"text":"Protocolos TCP/IP"}]},{"type":"p","children":[{"text":"TCP garante entrega confiável e ordenada; IP cuida do endereçamento e roteamento."}]},{"type":"h2","children":[{"text":"Principais serviços"}]},{"type":"p","children":[{"text":"WWW, e-mail (SMTP/POP3/IMAP), acesso remoto (Telnet/SSH), transferência de arquivos (FTP/SFTP)."}]}]'::JSONB,
  'publicado',
  'A Internet nasceu na Guerra Fria como rede militar descentralizada e cresceu sobre dois pilares: a comutação por pacotes e o conjunto de protocolos TCP/IP. Web é apenas um dos seus serviços, não sinônimo.',
  '["Internet ≠ Web — Internet é infraestrutura; Web é apenas um dos serviços que rodam por cima dela", "ARPANET (1969) usou comutação por pacotes pela primeira vez", "TCP garante confiabilidade; IP cuida de endereçamento e roteamento", "Cebraspe cobra a distinção infraestrutura vs serviço"]'::JSONB,
  NOW() - INTERVAL '3 days'
)
ON CONFLICT (subtopico_id) DO NOTHING;

-- Bloco 4: publicado
INSERT INTO coaching.resumos (
  id, subtopico_id, conteudo_plate, status, tldr, takeaways, publicado_em
) VALUES (
  '11111111-0000-4000-8000-000000100004',
  '11111111-0000-4000-8000-000000010004',
  '[{"type":"p","children":[{"text":"Resumo das gerações da Web (1.0, 2.0, 3.0)."}]}]'::JSONB,
  'publicado',
  'Web evoluiu da 1.0 (estática, leitura) → 2.0 (interativa, redes sociais) → 3.0 (semântica, IA).',
  '["Tim Berners-Lee criou a Web (HTTP+HTML)", "Web 2.0 = conteúdo gerado pelo usuário", "Web 3.0 = semântica e descentralização"]'::JSONB,
  NOW() - INTERVAL '1 day'
)
ON CONFLICT (subtopico_id) DO NOTHING;

-- Blocos 5, 6, 7: sem resumo (pendentes) — não insere nada em coaching.resumos

COMMIT;

-- Verificação rápida:
SELECT
  c.nome AS concurso,
  d.nome AS disciplina,
  t.nome AS aula,
  s.ordem AS bloco_ord,
  s.nome AS bloco,
  COALESCE(r.status, 'pendente') AS status_resumo
FROM coaching.concursos c
JOIN coaching.disciplinas d ON d.concurso_id = c.id
JOIN coaching.blocos_tematicos bt ON bt.disciplina_id = d.id
JOIN coaching.topicos t ON t.bloco_id = bt.id
JOIN coaching.subtopicos s ON s.topico_id = t.id
LEFT JOIN coaching.resumos r ON r.subtopico_id = s.id
WHERE c.id = '11111111-0000-4000-8000-000000000001'
ORDER BY s.ordem;
