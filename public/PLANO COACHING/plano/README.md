# Sistema de Mentoria para Concursos — Plano Mestre

> Mentor pessoal para concurseiros: parsing de edital com IA → árvore estruturada → cronograma semanal em modo livre → repetição espaçada via FSRS.

## Como usar este plano

Este diretório contém **11 documentos** que juntos formam o blueprint completo do sistema. Cada documento tem um propósito específico e Claude Code deve lê-los nesta ordem:

| # | Arquivo | Propósito |
|---|---------|-----------|
| 1 | `01-visao-produto.md` | Filosofia, princípios, decisões de produto não-negociáveis |
| 2 | `02-arquitetura.md` | Stack, estrutura de pastas, padrões de código |
| 3 | `03-design-system.md` | Tokens visuais, cores, tipografia, componentes base |
| 4 | `04-schema-banco.md` | Schema completo do Postgres com migrações |
| 5 | `05-prompts-ia.md` | Todos os prompts da Anthropic API prontos pra uso |
| 6 | `06-motor-fsrs.md` | Implementação do FSRS, mapeamentos, parâmetros |
| 7 | `07-algoritmos.md` | Geração de semana, sugestão inteligente, composição |
| 8 | `08-telas-admin.md` | Specs visuais de cada tela administrativa |
| 9 | `09-telas-aluno.md` | Specs visuais de cada tela do aluno |
| 10 | `10-fases-execucao.md` | Sprints, ordem de implementação, critérios de aceite |
| 11 | `11-orientacoes-api-externa.md` | Integração com API de questões do cliente (Coolify) |

## Filosofia de execução

**Para Claude Code:**

1. **Leia TODOS os documentos antes de escrever a primeira linha de código.** Eles se referenciam mutuamente.
2. **Cada tela tem spec visual em `08-` ou `09-`.** Implemente fielmente — não invente layouts.
3. **Cada prompt da IA está em `05-`.** Use literalmente, não reescreva.
4. **O design system em `03-` é lei.** Nenhum hardcode de cor ou tamanho fora dos tokens.
5. **Valide cada fase antes de prosseguir.** O documento `10-` define os checkpoints.

**Quando houver ambiguidade,** pergunte ao admin antes de assumir. As decisões pendentes estão listadas em cada documento na seção "Decisões em aberto".

## Stack confirmada

- **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind v4, shadcn/ui
- **Backend:** Supabase (Postgres + Auth + Storage + Edge Functions)
- **IA:** Anthropic API — `claude-sonnet-4-5` para parsing
- **FSRS:** biblioteca `ts-fsrs`
- **Editor:** Tiptap v2 (já em uso pelo cliente)
- **Estado:** Zustand para client state, Server Components quando possível
- **Drag-and-drop:** `@dnd-kit/core` (revisão de árvore do edital)
- **Tabelas:** TanStack Table v8
- **Forms:** React Hook Form + Zod
- **Charts:** Recharts

## Prompt inicial para Claude Code

```
Vamos implementar o Sistema de Mentoria. Leia primeiro TODOS os documentos
em /docs/plano/ na ordem listada no README.md. Não comece a codar antes
de terminar de ler todos.

Quando terminar a leitura, me diga:
1. Resumo de 3 linhas do que entendeu
2. Qualquer dúvida ou inconsistência detectada
3. Confirmação de que vai começar pela Fase 0

Aguarde minha autorização antes de começar a Fase 0.
```

## Princípio de qualidade

> "Sistema impecável > Sistema feito rápido."

Se uma fase exige mais tempo pra ficar correta, ela exige mais tempo. Sem atalhos no design system, no prompt da IA, ou no algoritmo FSRS. Esses três são o coração e devem ser feitos com perfeição na primeira tentativa.
