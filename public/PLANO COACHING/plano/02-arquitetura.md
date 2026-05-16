# 02 — Arquitetura Técnica

## Stack final

```
Frontend
├── Next.js 15 (App Router)
├── TypeScript 5.4+
├── Tailwind CSS v4
├── shadcn/ui (componentes base)
├── Tiptap v2 (editor rich-text)
├── @dnd-kit/core (drag-and-drop)
├── TanStack Table v8 (tabelas)
├── React Hook Form + Zod (forms)
├── Recharts (gráficos)
├── Zustand (client state quando necessário)
└── Lucide React (ícones)

Backend (Supabase)
├── Postgres 15
├── Row Level Security (RLS)
├── Auth (email/password + magic link)
├── Storage (PDFs de edital, imagens de conteúdo)
└── Edge Functions (cron de FSRS, parsing pesado)

Serviços externos
├── Anthropic API (claude-sonnet-4-5 para parsing)
├── ts-fsrs (biblioteca local de FSRS)
└── API de Questões do cliente (Coolify/VPS)
    └── 3,4M questões com disciplina + assunto
    └── Fonte única da verdade — não duplicar no Supabase
    └── Ver detalhes em 11-orientacoes-api-externa.md

Infra
├── Vercel (Next.js hosting)
├── Supabase Cloud (Postgres + serviços)
└── Cron jobs via Vercel Cron + Supabase Edge Functions
```

## Estrutura de pastas

```
/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Rotas públicas
│   │   ├── login/
│   │   ├── signup/
│   │   └── layout.tsx
│   ├── (admin)/                  # Rotas do admin (protegidas por role)
│   │   ├── admin/
│   │   │   ├── dashboard/
│   │   │   ├── concursos/
│   │   │   │   ├── novo/
│   │   │   │   └── [id]/
│   │   │   │       ├── revisar/   # Tela de revisão da árvore
│   │   │   │       ├── conteudos/
│   │   │   │       └── questoes/
│   │   │   ├── alunos/
│   │   │   └── feedback/
│   │   └── layout.tsx
│   ├── (app)/                    # Rotas do aluno (protegidas)
│   │   ├── app/
│   │   │   ├── semana/           # Tela principal
│   │   │   ├── atividade/[id]/   # Execução de atividade
│   │   │   ├── disciplinas/      # Visão macro
│   │   │   ├── memoria/          # Mapa FSRS
│   │   │   └── perfil/
│   │   └── layout.tsx
│   ├── api/                      # Route handlers
│   │   ├── admin/
│   │   │   └── edital/
│   │   │       └── parse/
│   │   ├── atividade/
│   │   │   └── [id]/
│   │   │       └── concluir/
│   │   ├── sugestao-proxima/
│   │   ├── fsrs/
│   │   │   └── revisar/
│   │   └── cron/
│   │       ├── calcular-due-hoje/
│   │       └── gerar-semanas/
│   └── layout.tsx
│
├── components/
│   ├── ui/                       # shadcn/ui (gerado)
│   ├── admin/                    # Componentes específicos do admin
│   │   ├── ArvoreEditor/
│   │   ├── EditorTiptap/
│   │   └── FormQuestao/
│   ├── aluno/                    # Componentes específicos do aluno
│   │   ├── HeaderSemana/
│   │   ├── KPIsSemana/
│   │   ├── SugestaoInteligente/
│   │   ├── AtividadeRow/
│   │   ├── BlocoTematico/
│   │   ├── BarrinhaRelevancia/
│   │   └── QuestaoExecutor/
│   └── shared/                   # Componentes compartilhados
│       ├── BadgeTipo/
│       ├── BadgePeso/
│       └── EstadoFSRS/
│
├── lib/
│   ├── supabase/
│   │   ├── server.ts             # Client servidor
│   │   ├── client.ts             # Client browser
│   │   └── middleware.ts         # Refresh de sessão
│   ├── anthropic/
│   │   ├── client.ts
│   │   ├── prompts/              # Prompts isolados em arquivos
│   │   │   ├── dividir-disciplinas.ts
│   │   │   └── estruturar-disciplina.ts
│   │   └── parse-edital.ts       # Orquestrador
│   ├── fsrs/
│   │   ├── scheduler.ts          # Wrapper do ts-fsrs
│   │   ├── inicializar.ts
│   │   ├── revisar.ts
│   │   └── parametros.ts         # D/S/R defaults e thresholds
│   ├── questoes-api/             # Cliente da API externa do cliente
│   │   ├── client.ts             # Wrapper HTTP com retry, cache, auth
│   │   ├── types.ts              # Tipos derivados da API (a descobrir)
│   │   ├── matching.ts           # Matching assunto-API ↔ tópico-sistema
│   │   ├── estatisticas.ts       # Cálculo de peso empírico
│   │   └── sync.ts               # Sincronização periódica de assuntos
│   ├── algoritmos/
│   │   ├── gerar-semana.ts
│   │   ├── sugerir-proxima.ts
│   │   └── compor-mix.ts
│   ├── utils/
│   │   ├── cn.ts                 # Tailwind merge
│   │   ├── formatters.ts         # Tempo, percentual, etc
│   │   └── validators.ts         # Zod schemas
│   └── constants/
│       ├── tipos-atividade.ts
│       ├── naturezas.ts
│       └── design-tokens.ts
│
├── types/
│   ├── database.ts               # Tipos gerados do Supabase
│   ├── domain.ts                 # Tipos de domínio (Atividade, Tópico, etc)
│   └── api.ts                    # Request/Response shapes
│
├── supabase/
│   ├── migrations/               # Migrações SQL versionadas
│   └── functions/                # Edge Functions (cron)
│
├── docs/
│   └── plano/                    # Este diretório
│
├── public/
├── styles/
│   └── globals.css
├── .env.local
├── .env.example
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## Padrões de código não-negociáveis

### 1. Server Components por padrão

Toda página é Server Component. Só vira `'use client'` quando precisa de:
- `useState` / `useEffect` / `useRef`
- Event handlers (`onClick`, `onChange`)
- Browser-only APIs

```tsx
// app/(app)/app/semana/page.tsx — Server Component
export default async function SemanaPage() {
  const supabase = createServerClient()
  const { data: semana } = await supabase.from('semanas')...
  return <SemanaView semana={semana} />
}

// components/aluno/SemanaView.tsx — Client se precisar de interação
'use client'
export function SemanaView({ semana }: Props) {
  const [filtro, setFiltro] = useState(...)
  // ...
}
```

### 2. Server Actions para mutations

Mutations vão via Server Actions, não API routes (salvo casos específicos como cron e webhooks).

```ts
// app/(app)/app/semana/actions.ts
'use server'

export async function concluirAtividade(atividadeId: string) {
  const supabase = createServerClient()
  // ... lógica
  revalidatePath('/app/semana')
}
```

### 3. Tipos derivados do banco

Gerar tipos do Supabase automaticamente:
```bash
npx supabase gen types typescript --project-id <id> > types/database.ts
```

Tipos de domínio em `types/domain.ts` usam composição com os do banco.

### 4. Validação com Zod sempre

Toda entrada externa (form, API, query param) passa por schema Zod antes de chegar à lógica de negócio.

```ts
const concluirAtividadeSchema = z.object({
  atividadeId: z.string().uuid(),
  duracaoRealMin: z.number().int().positive().optional(),
})
```

### 5. Erros tipados

Não retornar `{ error: string }` ad-hoc. Use Result pattern ou throw com classes tipadas:

```ts
export class ParsingFalhouError extends Error {
  constructor(public disciplina: string, public detalhe: string) {
    super(`Parsing falhou: ${disciplina}`)
  }
}
```

### 6. Convenções de naming

| Tipo | Convenção | Exemplo |
|------|-----------|---------|
| Componentes | PascalCase | `AtividadeRow.tsx` |
| Funções/variáveis | camelCase | `gerarProximaSemana()` |
| Constantes | SCREAMING_SNAKE | `MAX_HORAS_POR_DIA` |
| Tipos/interfaces | PascalCase | `Atividade`, `EstadoFSRS` |
| Arquivos de prompt | kebab-case | `dividir-disciplinas.ts` |
| Tabelas/colunas DB | snake_case | `atividades`, `peso_incidencia` |

### 7. Comentários em português

Sistema é PT-BR. Comentários, variáveis de negócio e mensagens de erro em português. Mantém-se em inglês apenas: keywords da linguagem, libs, e termos técnicos consagrados (FSRS, retrievability, etc).

## Segurança

### Row Level Security (RLS)

Toda tabela com dados de aluno tem RLS ativa. Policies estão no documento `04-schema-banco.md`.

### Roles

```sql
-- Adicionar à tabela alunos
ALTER TABLE alunos ADD COLUMN role TEXT DEFAULT 'aluno' CHECK (role IN ('aluno', 'admin'));
```

Middleware checa role para rotas `/admin/*`. Funções RLS usam `(auth.jwt() ->> 'role')` para liberar admin.

### Variáveis de ambiente

```bash
# Públicas (browser)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Privadas (servidor)
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
CRON_SECRET=  # Para autenticar requests do Vercel Cron

# API externa de questões (Coolify)
QUESTOES_API_URL=          # URL base da API do cliente
QUESTOES_API_KEY=          # Auth key da API (formato a descobrir)
QUESTOES_API_TIMEOUT_MS=10000  # Timeout padrão
```

## Integração com API externa de questões

O sistema **não duplica** o banco de 3,4M questões. Consome via API hospedada no Coolify do cliente. Camada de integração em `/lib/questoes-api/`. Diretrizes completas em `11-orientacoes-api-externa.md`.

**Princípios da integração:**

1. **API externa é fonte da verdade** das questões. Sistema só guarda referência (`questao_id_externa`) em `tentativas_questoes`.
2. **Mapeamento bidirecional** entre `assunto_id` da API e `topico_id`/`subtopico_id` do sistema fica em tabela `mapeamento_assuntos` no Supabase.
3. **Cache agressivo** das chamadas read-only (listagem de assuntos, contagem por banca) via Next.js cache + revalidate.
4. **Sincronização periódica** de metadados (estatísticas, contagens) em job diário/semanal — não em tempo real.
5. **Fallback gracioso** se API estiver fora: sistema continua funcionando, só não permite sessão de questões nova.

## Performance

### Estratégias críticas

1. **Server Components + streaming** para reduzir time-to-first-byte
2. **Suspense boundaries** em volta de fetches lentos (FSRS due, lista de atividades)
3. **Prefetch** de rotas adjacentes (Link com prefetch)
4. **Imagens otimizadas** via `next/image` para conteúdos com imagem
5. **Caching agressivo** para concursos publicados (revalidate: 3600)
6. **DB indexes** em todas as queries de hot path (definidos em `04-`)

### Limites a respeitar

- Bundle inicial < 200KB gzipped
- LCP < 2.5s em conexão 3G
- API routes respondem em < 500ms p95
- Parsing de edital completo < 3min p95

## Decisões em aberto

1. **Edge runtime vs Node runtime para API routes:** começar com Node por compatibilidade ampla, migrar para Edge quando viável
2. **i18n:** sistema é PT-BR only no MVP. Estrutura está pronta para i18n futuro.
3. **Monitoramento:** Sentry no MVP? Posthog? **Default assumido: Sentry para erros + Posthog para produto, ambos opcionais inicialmente.**
