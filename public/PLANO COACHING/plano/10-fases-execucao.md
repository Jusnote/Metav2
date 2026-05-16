# 10 — Fases de Execução

> Roteiro de implementação em sprints. Cada fase tem entregáveis claros, critérios de aceite verificáveis e dependências explícitas. Claude Code deve completar uma fase, pedir validação, e só então avançar.

## Visão geral dos sprints

| Sprint | Semanas | Fases | Entregável |
|--------|---------|-------|------------|
| 1 | 1–2 | Fase 0, 1, 2 | Admin processa edital com IA |
| 2 | 3 | Fase 2.5, 3 | **Integração API de questões + matching de assuntos** + conteúdos/questões |
| 3 | 4–5 | Fase 4, 5 | Aluno entra e vê semana funcional |
| 4 | 6–7 | Fase 6, 8 | Questões consumindo API externa + FSRS operacional |
| 5 | 8 | Fase 7 | Geração automática de semanas |
| 6 | 9 | Fase 9, 10 | Telas auxiliares + admin completo |

**Total estimado:** 9 semanas para MVP completo, considerando pair-programming com Claude Code.

**Nota sobre a Fase 2.5 (Integração API externa):**
A integração com a API de questões do cliente (Coolify) é tratada como **fase paralela à Fase 3**. Ver `11-orientacoes-api-externa.md` para diretrizes detalhadas. Claude Code deve trabalhar com o admin no VS Code para descobrir o contrato da API, mapear assuntos, calcular peso empírico de tópicos. Esta fase **desbloqueia** as Fases 6 (FSRS começa a operar com questões reais) e 8 (execução de questões consome API).

## Fase 0 — Setup do projeto

**Objetivo:** ambiente funcional com todas as dependências.

### Entregáveis
1. Projeto Next.js 15 com TypeScript, Tailwind v4, App Router
2. shadcn/ui instalado e tema dark configurado
3. Supabase project criado, cliente configurado em `/lib/supabase`
4. Anthropic SDK instalado, cliente em `/lib/anthropic/client.ts`
5. Variáveis de ambiente em `.env.example` e `.env.local`
6. Estrutura completa de pastas conforme `02-arquitetura.md`
7. Tailwind config com tokens de `03-design-system.md`

### Comandos de verificação
```bash
pnpm dev                              # Roda em :3000 sem erro
pnpm typecheck                        # Zero erros TypeScript
curl http://localhost:3000            # Retorna HTML
```

### Critério de aceite
- [ ] Página inicial renderiza com background `--bg-canvas` e tipografia Inter
- [ ] Console do navegador sem erros
- [ ] Teste de conexão Supabase via Server Action retorna `OK`
- [ ] Teste de chamada Anthropic com prompt "Diga olá" retorna resposta

### Não fazer ainda
- Não criar rotas além de `/` placeholder
- Não implementar autenticação ainda
- Não criar componentes de UI ainda

---

## Fase 1 — Schema do banco

**Objetivo:** banco com todas as tabelas, RLS e índices.

### Entregáveis
1. Migrações 001–011 criadas em `/supabase/migrations/`
2. Tipos TypeScript gerados em `/types/database.ts`
3. Tipos de domínio em `/types/domain.ts`
4. Views `v_progresso_disciplinas` e `v_memoria_em_risco` criadas
5. Trigger `update_atualizado_em` aplicado em tabelas mutáveis
6. Função `is_admin()` testada

### Comandos de verificação
```bash
npx supabase db push                          # Aplica migrações
npx supabase gen types typescript > types/database.ts
```

### Critério de aceite
- [ ] Todas 16 tabelas visíveis no Supabase Studio
- [ ] RLS ativa em `alunos`, `atividades`, `fsrs_cards`, `tentativas_questoes`, `semanas`
- [ ] Teste de RLS: usuário A não consegue SELECT em dados do usuário B
- [ ] Índices criados (verificar via `\di` no psql)
- [ ] `types/database.ts` reflete o schema atual

### Decisões a confirmar antes
- Multi-tenancy: single-tenant confirmado
- Granularidade FSRS: card = subtópico confirmado

---

## Fase 2 — Pipeline de parsing do edital

**Objetivo:** admin cola edital → IA gera árvore → admin revisa e publica.

### Entregáveis

**2.1 Backend:**
1. `/lib/anthropic/prompts/dividir-disciplinas.ts` (prompt + builder)
2. `/lib/anthropic/prompts/estruturar-disciplina.ts` (prompt + builder)
3. `/lib/anthropic/prompts/estimar-horas.ts` (prompt + builder)
4. `/lib/anthropic/parse-edital.ts` (orquestrador com p-limit)
5. Schemas Zod de validação dos outputs
6. Server Action `processarEdital` em `/app/(admin)/admin/concursos/novo/actions.ts`

**2.2 Frontend admin:**
1. `/admin/concursos` — lista de concursos
2. `/admin/concursos/novo` — formulário Step 1 (identificação) + Step 2 (upload)
3. `/admin/concursos/[id]/revisar` — tela de revisão da árvore (a mais importante)
4. Componente `<ArvoreEditor />` com `@dnd-kit/core`
5. Modal de alertas da IA

### Critério de aceite
- [ ] Admin consegue colar edital de 5+ disciplinas e processar em < 3min
- [ ] Tela de revisão mostra árvore hierárquica completa
- [ ] Drag-and-drop reordena tópicos dentro do mesmo bloco
- [ ] Edição de peso, natureza, horas funciona e persiste
- [ ] Botão "Publicar" muda status do concurso para `publicado`
- [ ] Validação Zod rejeita output malformado da IA com erro útil
- [ ] Custo médio < R$ 3 por edital (logged em `eventos`)

### Teste manual obrigatório
Usar o edital de Contabilidade Geral (Agente PF / Cebraspe / 24h) que já validamos em conversa anterior. O output deve gerar 5 blocos temáticos e ~25 tópicos. Comparar com o JSON de referência que está em `05-prompts-ia.md`.

---

## Fase 3 — Conteúdos e questões

**Objetivo:** admin popula tópicos com material e questões.

### Entregáveis
1. `/admin/topicos/[id]/conteudos` — lista + drawer de edição
2. `/admin/topicos/[id]/questoes` — lista + drawer de edição
3. Componente `<EditorTiptap />` reutilizável com extensions configuradas:
   - StarterKit, Image (upload Supabase Storage), Table, CodeBlock, Highlight, Link, Subscript/Superscript
4. Upload de imagens para bucket `conteudos` no Supabase Storage
5. Bulk import de questões via JSON (botão "Importar lote")

### Critério de aceite
- [ ] Admin cria conteúdo do tipo `teoria` com texto formatado + imagem + tabela
- [ ] Conteúdo salva em `conteudos.corpo_json` como JSON do Tiptap
- [ ] Admin cadastra 10 questões num tópico via UI
- [ ] Admin importa 50 questões via JSON
- [ ] Comentário pedagógico (Tiptap) salva em `questoes.comentario_json`

---

## Fase 4 — Onboarding e autenticação do aluno

**Objetivo:** aluno se cadastra, faz onboarding e tem Semana 1 gerada.

### Entregáveis
1. `/login` e `/signup` com Supabase Auth (email + magic link)
2. Middleware de proteção de rotas `/app/*` e `/admin/*`
3. Trigger SQL que cria registro em `alunos` quando `auth.users` recebe novo usuário
4. Fluxo `/onboarding` com 5 telas (boas-vindas, concurso, disponibilidade, horário, resumo)
5. Server Action `concluirOnboarding` que dispara `gerarPrimeiraSemana(alunoId)`
6. Implementação de `gerarPrimeiraSemana()` em `/lib/algoritmos/gerar-semana.ts`

### Critério de aceite
- [ ] Novo usuário se cadastra, recebe magic link, faz login
- [ ] Onboarding leva < 3min para completar
- [ ] Após concluir, redirect para `/app/semana` com semana 1 já populada
- [ ] Semana 1 respeita composição 70% teoria / 20% questões / 10% lei seca
- [ ] Total de horas da semana = soma de `horas_por_dia` configurada
- [ ] RLS funciona: aluno só vê seus próprios dados

---

## Fase 5 — Tela principal do aluno (modo livre)

**Objetivo:** aluno vê e interage com a tela `/app/semana` completa.

### Entregáveis

**5.1 Componentes:**
1. `<HeaderSemana />` — info da semana + card próxima semana bloqueada
2. `<KPIsSemana />` — 4 cards (qualidade, horas, questões, ritmo)
3. `<SugestaoInteligente />` — banner roxo com sugestão + alternativas
4. `<TabsAtividadesReforcos />` — tabs com contadores
5. `<FiltrosAtividades />` — dropdowns + chip "só peso 5"
6. `<BlocoTematico />` — cabeçalho expansível + lista
7. `<AtividadeRow />` — linha grid 6 colunas
8. `<BarrinhaRelevancia />` — 5 barras coloridas conforme peso
9. `<BadgeTipo />` — badge colorido por tipo de atividade

**5.2 Backend:**
1. Server Action `concluirAtividade(atividadeId)` 
2. API `/api/sugestao-proxima` com algoritmo de scoring
3. Função `calcularKPIsSemana()` de `07-algoritmos.md`

### Critério de aceite visual
A tela deve ser visualmente idêntica ao mockup dark validado na conversa, com:
- [ ] Background `--bg-canvas`, cards `--bg-surface-2`
- [ ] Tipografia Inter, escalas conforme design system
- [ ] KPI "Qualidade" em verde com número grande
- [ ] Banner sugestão roxo com ícone Sparkles
- [ ] Atividades agrupadas por bloco temático
- [ ] Barrinhas de relevância coloridas por peso (vermelho=5, âmbar=4, etc)
- [ ] Filtros funcionais e preservados na URL

### Critério funcional
- [ ] Clicar checkbox marca atividade como concluída
- [ ] KPIs recalculam após conclusão (revalidatePath)
- [ ] Filtros reduzem lista corretamente
- [ ] Sugestão inteligente atualiza após concluir atividade
- [ ] Próxima semana bloqueada até concluir a atual

---

## Fase 6 — Motor FSRS

**Objetivo:** repetição espaçada operacional.

### Entregáveis
1. `/lib/fsrs/scheduler.ts` (wrapper do ts-fsrs com parâmetros)
2. `/lib/fsrs/inicializar.ts` (criação de cards)
3. `/lib/fsrs/revisar.ts` (processarRevisao com mapeamento taxa→Rating)
4. `/lib/fsrs/parametros.ts` (thresholds 50/70/90)
5. Edge Function `/supabase/functions/calcular-fsrs-due/` (cron diário)
6. Configuração do pg_cron para rodar 4h Brasília
7. Detecção de cluster de erro (V2 — opcional neste sprint)

### Critério de aceite
- [ ] Primeira sessão de questões cria card FSRS para cada subtópico tocado
- [ ] Card inicial tem state=`new`, difficulty/stability defaults
- [ ] Após sessão com 80% acerto, Rating=Good aplicado, due_date para ~7 dias
- [ ] Após sessão com 40% acerto, Rating=Again aplicado, due_date para ~1 dia
- [ ] Log em `fsrs_reviews_log` registra antes/depois corretamente
- [ ] Cron diário cria atividades `revisao_fsrs` para cards due
- [ ] Cards com R<0.7 viram atividades individuais de "revisão urgente"

### Teste de calibração
Simular 20 reviews de um card com performance crescente (50%→60%→70%→80%→90%) e verificar que `stability` cresce, `difficulty` diminui, e intervalos aumentam progressivamente.

---

## Fase 7 — Geração automática de semanas

**Objetivo:** sistema gera Semana N automaticamente quando aluno termina Semana N-1.

### Entregáveis
1. Implementação completa de `gerarSemana()` para semanas N+1
2. Função `calcularComposicaoSemana()` 
3. Função `selecionarProximosTopicos()` com pré-requisitos
4. Função `selecionarTopicosParaQuestoes()` (teoria há 7+ dias)
5. Função `selecionarTopicosParaLeiSeca()` (questões há 7+ dias)
6. Função `balancearDisciplinas()` (limite 40%)
7. Cron semanal aos domingos 23h59 (fecha semana mesmo incompleta)
8. Política de atividades não concluídas (arrasta teoria, vira reforço questões, FSRS recalcula revisão)

### Critério de aceite
- [ ] Concluir última atividade da semana dispara geração da próxima
- [ ] Próxima semana respeita composição 35/30/15/15/5%
- [ ] FSRS due dentro da janela da semana tem prioridade
- [ ] Pré-requisitos respeitados: tópico B não entra se A não foi feito
- [ ] Nenhuma disciplina ocupa > 40% do tempo
- [ ] Atividades de teoria pendentes da semana anterior são arrastadas
- [ ] Semana anterior muda status para `concluida`

### Edge cases a testar
- Aluno terminou todas atividades antes da semana fechar
- Aluno não terminou nenhuma atividade na semana
- Concurso tem disciplina dominante (60%+) — relaxar regra de 40%

---

## Fase 8 — Execução de atividade

**Objetivo:** telas de execução para todos os tipos de atividade.

### Entregáveis
1. `/app/atividade/[id]` com renderização condicional por tipo
2. Variação **Teoria/Lei seca/Resumo**: renderiza Tiptap em modo leitura + cronômetro + botão concluir
3. Variação **Questões/Revisão FSRS**: máquina de estados com 3 fases
4. Componente `<QuestaoExecutor />` com feedback imediato
5. Variação **Simulado**: cronômetro regressivo + sem feedback imediato
6. Dashboard pós-sessão com taxa por subtópico + próximas revisões FSRS
7. Integração com FSRS: ao concluir sessão de questões, chama `processarRevisao()`

### Critério de aceite
- [ ] Aluno executa atividade de teoria, marca como concluída, registra `duracao_real_min`
- [ ] Aluno executa sessão de 20 questões, vê feedback imediato em cada uma
- [ ] Tempo por questão registrado em `tentativas_questoes.tempo_segundos`
- [ ] Dashboard pós-sessão mostra "Homicídio: 80% → próxima revisão em 12 dias"
- [ ] Subtópico com taxa < 70% recebe destaque visual (chama)
- [ ] FSRS atualizado corretamente para todos subtópicos envolvidos

---

## Fase 9 — Telas auxiliares do aluno

**Objetivo:** visão macro do progresso.

### Entregáveis
1. `/app/disciplinas` — grid de cards de disciplinas com progresso
2. `/app/disciplinas/[id]` — detalhe com blocos e tópicos expandíveis
3. `/app/memoria` — Mapa da Memória FSRS (em risco / próximas / estáveis)
4. `/app/perfil` — configurações pessoais + estatísticas gerais
5. Edição de horas/dia e horário de pico no perfil

### Critério de aceite
- [ ] Disciplinas mostram % de tópicos com teoria concluída
- [ ] Estado dos blocos (concluído/em andamento/não iniciado) preciso
- [ ] Mapa da Memória lista cards em risco (R < 0.7) com destaque
- [ ] Aluno consegue ajustar horas disponíveis e isso afeta próxima geração de semana

---

## Fase 10 — Painel admin completo

**Objetivo:** ferramentas de suporte e acompanhamento.

### Entregáveis
1. `/admin/dashboard` com KPIs gerais + gráficos
2. `/admin/alunos` lista de alunos com filtros
3. `/admin/alunos/[id]` com 5 tabs (visão geral, cronograma, mapa memória, histórico, configurações)
4. `/admin/feedback` para receber dúvidas dos alunos
5. Logs de erro de parsing IA visíveis no admin

### Critério de aceite
- [ ] Dashboard carrega em < 2s
- [ ] Admin consegue ver progresso completo de qualquer aluno
- [ ] Admin pode resetar progresso de aluno (com confirmação)

---

## Checklist de qualidade pré-lançamento

Após Fase 10, antes de soltar para alunos reais:

### Performance
- [ ] Lighthouse > 90 em Performance, Accessibility, Best Practices
- [ ] `/app/semana` renderiza em < 1.5s em 3G simulado
- [ ] Bundle inicial < 200KB gzipped
- [ ] APIs respondem em < 500ms p95

### Segurança
- [ ] RLS testado para todas as tabelas sensíveis
- [ ] Service role key nunca exposta no client
- [ ] CRON_SECRET valida requests do Vercel Cron
- [ ] Validação Zod em toda entrada externa
- [ ] CORS configurado restritivamente

### UX
- [ ] Mobile funcional em 360px de largura
- [ ] Navegação por teclado completa
- [ ] Aria-labels em todos ícones-botão
- [ ] Estados de loading em todas operações > 200ms
- [ ] Mensagens de erro em PT-BR claras

### Dados
- [ ] Backup automático configurado no Supabase
- [ ] Migrações versionadas em git
- [ ] Seed data para desenvolvimento

### Monitoramento
- [ ] Sentry configurado (opcional V1)
- [ ] Logs de eventos críticos em `eventos`
- [ ] Alertas para falhas de parsing IA

---

## Como Claude Code deve operar

### No início de cada fase

```
1. Releia o documento específico da fase
2. Confirme o estado das dependências (fases anteriores concluídas)
3. Liste os arquivos que vai criar/modificar
4. Peça aprovação do admin antes de começar
```

### Durante a implementação

```
1. Crie um arquivo por vez, testando cada um
2. Use Server Components por padrão
3. Server Actions para mutations
4. Zod para toda validação
5. Comentários em português
6. Siga design tokens religiosamente
```

### Ao final de cada fase

```
1. Rode pnpm typecheck — zero erros
2. Rode pnpm lint — zero warnings
3. Execute manualmente os critérios de aceite
4. Documente decisões tomadas em CHANGELOG.md
5. Peça validação do admin antes de avançar
```

### Quando encontrar ambiguidade

```
PARE. Pergunte ao admin. Não invente.

Frases-gatilho para pergunta:
- "O documento diz X mas Y também faria sentido — qual prefere?"
- "Encontrei uma situação não coberta: [descrição]. Como tratar?"
- "Implementar A custa 2h, B custa 1 dia mas é mais robusto — qual?"
```

---

## Riscos e mitigações

| Risco | Probabilidade | Mitigação |
|-------|---------------|-----------|
| IA retorna JSON malformado | Média | Validação Zod + retry com prompt corretivo |
| FSRS gera intervalos estranhos | Baixa | Parâmetros calibrados, monitorar logs |
| RLS deixa passar dados | Baixa | Testes E2E com 2 usuários distintos |
| Custo de IA escala demais | Média | Cache de prompts + monitorar custo médio |
| Aluno trava em loop FSRS | Média | Limite de 5 cards "atrasados" simultâneos |

---

## Prompt final para colar no Claude Code

```
Estou implementando o Sistema de Mentoria para Concursos descrito em
/docs/plano/. Leia TODOS os 10 documentos antes de escrever qualquer linha
de código.

Depois da leitura, me responda:
1. Resumo de 3 linhas do que entendeu
2. Qualquer inconsistência ou ambiguidade detectada
3. Qual a primeira tarefa concreta da Fase 0

Aguarde minha autorização para começar a Fase 0.

Regras de execução:
- Server Components por padrão, Server Actions para mutations
- Validação Zod em toda entrada externa
- Comentários em PT-BR
- Design tokens conforme 03-design-system.md sem exceção
- Pare e pergunte quando houver ambiguidade
- Ao final de cada fase, valide critérios de aceite e me peça aprovação
```
