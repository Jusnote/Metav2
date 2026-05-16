# 12 — Escopo V3 Final (adições + ajustes)

> Overlay em cima dos docs 01-11. Lista o que muda/adiciona após a fase de brainstorm com Aldemir em 2026-05-16. Mantém docs 01-11 como base; este doc tem precedência onde houver conflito.

## Princípio de execução

- **Branch dedicado**: `v3-mentoria` (criado a partir de `cargo-transition-v2`)
- **Sub-plans 1-5.6 (V2)**: ficam congelados no histórico. Código antigo NÃO é deletado nesta fase — fica como referência. Será removido na fase 11 (cleanup) após V3 estar estável em produção
- **Supabase**: mesmo projeto, **schema dedicado `coaching`** (criado em 2026-05-16 por colisão de nomes `disciplinas`/`topicos`/`subtopicos` com V2). Todas as tabelas V3 ficam em `coaching.*`. Tabelas V2 (`public.planos_estudo`, `public.disciplinas` etc.) permanecem intocadas como legado em `public`. Cliente Supabase V3 inicializa com `db: { schema: 'coaching' }`. Dashboard Supabase precisa adicionar `coaching` em Settings → API → Exposed schemas.
- **Rotas**: V3 ocupa `/app/*` (root da app). V2 fica acessível em `/legacy/cronograma` enquanto não for deletado
- **Filosofia**: "Sistema impecável > Sistema feito rápido" (princípio do README do plano)

## WOWs aprovados — entram no V3 base

Adicionar aos entregáveis das fases correspondentes (ver doc 10):

### #9 — Botão único "Estudar agora" (Fase 5 / aluno-semana)
- Home do aluno tem 1 botão dominante: "Estudar agora"
- Clica → IA decide qual atividade da semana priorizar (algoritmo de sugestão do doc 07)
- Aluno não vê lista até clicar em "Ver semana inteira"
- Se não gostar da sugestão: link "Outras 3 opções" mostra alternativas com justificativa
- **Custo**: integrado na Fase 5, +1 dia

### #11 — Quality Score (Fase 9 / KPIs)
- Métrica única ponderada: peso do tópico × retenção × dificuldade banca × recency
- Substitui "horas estudadas" como métrica de progresso
- Display: pill grande "67/100" na home + breakdown em /dashboard
- Tabela `aluno_quality_score_diario` (snapshot diário pra evolução temporal)
- **Custo**: +2 dias

### #13 — Onboarding emocional (Fase 4 / onboarding)
- Step extra no onboarding: 3 perguntas pessoais
  - "Por que esse concurso?"
  - "O que vai mudar na sua vida se aprovar?"
  - "Qual seu maior medo nesse caminho?"
- Respostas salvas em `alunos.motivador_pessoal JSONB`
- Trazidas de volta pela coach IA (Fase V4) em momentos de baixa
- **Custo**: +0.5 dia

### #14 — Streak resiliente (Fase 5 / aluno-semana)
- Streak conta dias com pelo menos 5min de atividade concluída
- Não pune dia ruim, recompensa consistência
- Display: chama discreta no header, animação leve ao bater marcos (7, 30, 100)
- **Custo**: +0.5 dia

### #21 — Visão Macro do Ciclo (modo dual)
**Modo aluno** (Fase 5 / aluno-semana, sub-rota `/app/semana/macro`)
- Grid: linhas = disciplinas, colunas = semanas (1-12+)
- Pills coloridas: teoria/questões/lei seca/revisão/FSRS
- Zoom in numa semana → mostra detalhe + razão algorítmica
- Tooltip por pill: "Por que aqui? — gap de 7 dias da teoria garante consolidação"

**Modo admin** (Fase 2 / curadoria-edital, sub-rota `/admin/concursos/:id/macro`)
- Mesma grid com edição habilitada
- Drag-and-drop de pills entre semanas (`@dnd-kit/core`)
- Overrides persistem em `atividades.posicao_manual_admin = true`
- Validação ao vivo: banner vermelho se quebra regra (questões antes da teoria, etc.)
- Bulk operations (selecionar múltiplas pills → mover juntas)
- Preview "como o aluno vê" sem sair da página
- Reset pra distribuição algorítmica

**Schema add**:
```sql
ALTER TABLE atividades
  ADD COLUMN posicao_manual_admin BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN posicao_anterior_algoritmo SMALLINT;
```

**Custo**: +5 dias (3 aluno + 2 admin)

### #22 — Guardrail pedagógico aluno (Fase 8 / questões-execução)
- Aluno tenta marcar "fazer agora" questões com teoria <7 dias
- Modal amber: "Você concluiu a teoria há X dias. Pesquisas mostram que questões rendem mais após 7+ dias — o esforço de recuperar o que está meio esquecido é o que fixa. Fazer mesmo assim?"
- 2 botões: "Fazer mesmo assim" / "OK, aguardar"
- **Custo**: +0.5 dia

### #23 — Guardrail pedagógico admin (Fase 2 / curadoria)
- Componente integrado ao macro editor (#21)
- Move pill de questões pra semana anterior à teoria → banner vermelho
- Gap < 7 dias → banner amber + sugestão
- Admin pode forçar com confirm explícito
- **Custo**: +0.5 dia (já dentro do #21)

## Ajuste algorítmico — bounds dinâmicos por capacidade

Substitui número fixo de atividades por week.

### Aplicar em `gerar-semana.ts` (doc 07 — Algoritmo 1)

```ts
function calcularLimitesSemana(horasCapacidade: number, disciplinasSelecionadas: number) {
  // Cada atividade dura 30-60min, média 45min
  const sessoesMedias = (horasCapacidade * 60) / 45

  return {
    minDisciplinas: Math.min(3, disciplinasSelecionadas),
    maxDisciplinas: Math.min(7, disciplinasSelecionadas),
    minAtividades: Math.max(5, Math.floor(sessoesMedias * 0.85)),
    maxAtividades: Math.min(40, Math.ceil(sessoesMedias * 1.15)),
    duracaoAlvoPorAtividade: 45,
    // Se passar de 25 atividades, UI agrupa em 2 "sessões" por dia visualmente
    agruparEmDuasSessoesPorDia: sessoesMedias > 25,
  }
}
```

### Exemplos calibrados

| Capacidade | Atividades-target | Disciplinas | Notas |
|---|---|---|---|
| 5h/sem | 5-8 | 3 | Aluno part-time, sessões 30-40min |
| 15h/sem | 17-23 | 3-5 | Caso médio (seu sweet spot 20-25) |
| 25h/sem | 28-38 | 4-6 | Dedicado, separar em manhã/tarde |
| 40h/sem | 45-60 (cap 40 + agrupamento) | 5-7 | Full-time, 2 sessões/dia |

### Hard cap superior 40

Acima de 40 atividades visualmente vira lista hostil. UI agrupa em "Hoje · Manhã (5)" / "Hoje · Tarde (5)" — duas sessões/dia. Backend continua com count real, frontend rende agrupado.

### Composição semanal (do doc 07) — mantida e reforçada

Gap mínimo 7 dias entre etapas do mesmo tópico:
- Teoria sem 1 → Questões só elegíveis a partir da sem 2
- Questões sem 2 → Lei seca só elegível a partir da sem 4
- FSRS automático D+1, D+3, D+7, D+15, D+30 over top

## Empurrados pra V4 (precisam de dados reais)

Não entram no V3. Construídos após 60-90 dias de uso real:

- **#1** — Análise semântica de erro (IA classifica tipo de erro por questão)
- **#2** — Detecção de pico/fadiga do aluno
- **#4** — Mapa mental interativo do edital (visualização tipo grafo D3/Cytoscape)
- **#7** — Coach IA contextual (mensagens diárias baseadas em comportamento)
- **#12** — Termômetro de aprovação + Simulador "E se?"
- **#19** — Análise por banca (CESPE/FGV/FCC patterns)

## V5+ (luxo)

- **#6** — Heatmaps comparativos com aprovados anteriores
- **#17** — Integração Screen Time / Digital Wellbeing
- **#20** — Grupos de afinidade anônimos (5-10 alunos do mesmo cargo)
- **#16** — Áudio TTS de resumos
- **Modo TDAH** — single-focus + Pomodoro embutido

## Cronograma realista

Total V3 estimado: **36-53 dias** (~6-8 semanas com Claude Code pair-programming)

- Base do plano (docs 01-11, fases 0-10): 30-45 dias
- WOWs adicionais (#9, #11, #13, #14, #21, #22, #23): 6-8 dias
- Ajuste bounds dinâmicos: 0 (substitui implementação fixa)

## Próximo passo imediato — Fase 0

Conforme doc 10:

1. Criar branch `v3-mentoria` a partir de `cargo-transition-v2`
2. Setup folder structure em `src/v3/` (ver doc 02-arquitetura.md)
3. Configurar Anthropic SDK direto (não Vercel AI SDK) — `@anthropic-ai/sdk`
4. Instalar dependências novas: `@dnd-kit/core`, `recharts`, `@tanstack/react-table`, `react-hook-form`, `zod`, `zustand`
5. **Plate** já está integrado e mantido — Tiptap NÃO entra no escopo
6. Config Tailwind com tokens do doc 03-design-system.md
7. Validar: pnpm dev roda sem erro, página inicial renderiza com background `--bg-canvas`

**Critério de aceite**: rodar checklist da Fase 0 no doc 10.

---

## Decisões finais antes de executar (recap)

1. ✅ Catálogo de concursos próprio (admin gerencia, abandona dependência do GraphQL externo pro core)
2. ✅ Reescrita total (Sub-plans 1-5.6 viram legado, V3 começa limpo)
3. ❌ Tiptap **revertido em 2026-05-16** — V3 mantém **Plate** (já integrado: editor-kit, floating-toolbar-kit, slash-kit, ai-kit). Plate é Slate-based, performance suficiente pra docs pequenos (1-3K palavras por subtópico). Economiza 30-50h de re-integração. Tiptap volta a ser considerado se collaborative editing real-time virar requisito (V5+).
4. ⚠️ API questões externa: contrato ainda precisa ser descoberto na Fase 2.5 — bloqueia FSRS de cronograma (Fase 6) até resolver
5. ✅ Tabela `alunos` separada de `auth.users` (role + horas_por_dia + horario_pico)
6. ✅ Coexistência V2 (legado, congelado) + V3 (novo, ativo) durante desenvolvimento

## Risk register

| Risco | Mitigação |
|---|---|
| API questões não responder no tempo | Construir mocks na Fase 2.5; postergar Fase 6 se necessário |
| Plate→Tiptap migração quebrar lei-seca/flashcards existentes | V2 fica intocado, V3 inicia Tiptap zero-state |
| Schema migration conflicts | Tabelas V2 e V3 coexistem; nomes não colidem |
| Time estimate slip | Buffer 20% já incluído nos 36-53 dias |
| Aldemir não disponível pra revisar/validar fases | Plan tem critérios de aceite verificáveis; Claude Code segue se passar |
