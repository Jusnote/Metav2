# Questões · Objetivo (Fase 1A) — Entregue

**Data:** 2026-04-21
**Branch:** `worktree-questoes-objetivo-fase1a`
**Spec:** `docs/superpowers/specs/2026-04-20-questoes-objetivo-design.md`
**Plano:** `docs/superpowers/plans/2026-04-20-questoes-objetivo-fase1.md`

## O que mudou na página de questões

### Header refinado
- Título `Banco de Questões.` em **Source Serif 4** 26px, weight 600, com ponto `.` em azul royal (`#2563eb`).
- Tabs de modo (`Filtros` · `Filtro semântico` · `Cadernos`) viraram **segmented control** em pílula arredondada, fundo cinza claro (`#f1f5f9`), ativo em branco com sombra sutil.
- Título e tabs ocupam a mesma linha horizontal, com divisor sutil cinza abaixo.
- Removido o gradiente azul do container `<section>` — agora fundo branco sólido.

### Nova seção OBJETIVO (somente na aba Filtros)
- **Header da seção:** label `OBJETIVO` uppercase com ícone de alvo concêntrico + botão "Limpar objetivo" (só aparece com foco ativo) + campo de busca `Filtrar carreiras` com ícone de lupa.
- **Tabs de área:** 9 áreas (`Policial`, `Fiscal`, `Jurídica`, `Tribunais`, `Saúde`, `Controle`, `Legislativo`, `Bancária`, `Militar`) com contagem por área, underline azul royal no ativo.
- **Carrossel horizontal** de cards 96×96px:
  - Primeiro card fixo `TODAS` (reset) com ícone checklist em cinza, vira azul quando ativo.
  - Demais cards = cargos com foto (ou fallback gradient + sigla extraída do nome).
  - Ativo: borda azul 2px + ring externo sutil + badge circular `✓` no canto superior direito.
  - Estado dimado (default + não-selecionados): `grayscale(0.35) brightness(0.97) opacity(0.78)`. Selecionado retorna a 100%.
  - Hover: lift 1px + sombra mais forte.
- **Seta `›`** como botão separado à direita do carrossel (fora dos cards, rola ~360px suavemente).
- **Busca** filtra o carrossel por substring case-insensitive dentro da área atual.

### Comportamento do foco
- Até **3 focos simultâneos**. 4º clique desativa o mais antigo (FIFO) e ativa o novo — sem modal.
- Tabs de área **não acionam foco** — só trocam o que o carrossel mostra.
- Focos atravessam áreas: ativar PF em Policial e AFRFB em Fiscal mantém ambos ativos ao navegar entre tabs.
- Estado é local (React state). Página abre sempre com TODAS selecionado.

### Limitação desta fase (por design)
- O foco ativo **não afeta** a lista de questões nem os pills de filtro — é puramente visual.
- Os dados das carreiras vêm de `src/data/carreiras-mock.ts` (19 cargos hardcoded).
- `SemanticScopeToggle` foi criado mas renderiza apenas com `visible={false}` (placeholder para Fase 2).

## Dados mockados

19 carreiras distribuídas em 7 áreas:

| Área | Cargos |
|------|--------|
| Policial | PF Agente/Escrivão/Delegado, PRF Policial, PC-SP Investigador, PC-RJ Inspetor, DEPEN Agente |
| Fiscal | RFB Auditor, TCU Auditor, ICMS-SP AFT |
| Jurídica | OAB Exame, MPF Procurador, Defensoria Defensor |
| Tribunais | TRT Técnico, TRE Analista |
| Saúde | Prefeitura Enfermeiro |
| Controle | CGU Analista |
| Bancária | BB Escriturário, Caixa Técnico |

Fotos reais foram anexadas a 7 cards da área Policial (PF Agente/Escrivão/Delegado, PRF, PC-SP, PC-RJ, DEPEN). Os demais usam o fallback gradient + sigla.

## Arquivos criados

```
src/types/carreira.ts
src/data/carreiras-mock.ts
src/hooks/useCarreiras.ts
src/hooks/useFocoObjetivo.ts
src/components/questoes/objetivo/
  ├─ ObjetivoSection.tsx
  ├─ ObjetivoHeader.tsx
  ├─ AreaTabs.tsx
  ├─ CarreiraCarousel.tsx
  ├─ CarreiraCard.tsx
  └─ SemanticScopeToggle.tsx
```

## Arquivos modificados

```
src/views/QuestoesPage.tsx    — header refinado + integração da ObjetivoSection na aba Filtros
```

## Pendências (próximas fases)

### Fase 1B — Backend + admin
- Migração SQL da tabela `carreiras` + bucket `carreira-images` + RLS
- Trocar `useCarreiras`/`useAreaCounts` pra ler do Supabase (mesma assinatura, só muda a implementação)
- Painel admin `/moderacao/objetivos`: CRUD + upload de foto com resize client-side
- Rota + entrada na sidebar de moderação
- Remover `src/data/carreiras-mock.ts`

### Fase 2 — Integração real com questões
- Coluna `cargos.carreira_id` (FK), picker "Cargos vinculados" no drawer admin
- Foco escopa universo de questões e opções dos pills (via `useQuestoesV2`)
- Toggle "Incluir fora do foco" funcional na aba Filtro semântico (contagens reais + ampliação de escopo)
- Persistência dos focos ativos (sessionStorage ou localStorage)
- Regras de matching e edge cases de nomenclatura de cargos

## Decisões visuais tomadas durante a QA

- **Cards 96×96px** (reduzido do 112px inicial — mais elegante no grid)
- **Dim suave nos não-selecionados**: `grayscale(0.35) brightness(0.97) opacity(0.78)` — dessaturação leve sem deixar apagado
- **Gradient overlay preto puro** sobre as fotos (tentativa com pill branco translúcido atrás do nome foi descartada)
- **OBJETIVO só aparece na aba Filtros** — Filtro semântico e Cadernos ficam limpos
- **`section` com fundo branco sólido** (retirado o gradiente azul)
