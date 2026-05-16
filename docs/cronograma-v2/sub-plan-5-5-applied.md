# Sub-plan 5.5 Applied — Página dedicada de Curadoria de Editais

**Branch:** `cargo-transition-v2`
**Data:** 2026-05-15
**Rota:** `/moderacao/curadoria-editais`

---

## Commit chain

```
20a1bff feat(cronograma-v2): add origin field to SubtopicoDecomposed (ai|manual)
e2a4955 feat(cronograma-v2): useCuradoriaTree merging GraphQL + cache
d15931c feat(cronograma-v2): useCargosCurados aggregating cargos + cache status
659c196 feat(cronograma-v2): CuradoriaEditaisPage shell (sidebar + main)
ee7b858 feat(cronograma-v2): CargoListSidebar + Item (filter + search)
e2b2f7e feat(cronograma-v2): CuradoriaTreeMain with header + autosaved tree
edfe68b feat(cronograma-v2): tree sections with inline editing (disciplina/topico/subtopico)
0e32ece feat(cronograma-v2): top actions + origin badge + empty state
4bf9f85 feat(cronograma-v2): wire /moderacao/curadoria-editais route + nav link
```

---

## Arquivos criados

| Arquivo | Propósito |
|---------|-----------|
| `src/lib/cronograma-v2/schemas.ts` | Adicionado `origin: 'ai' \| 'manual'` ao `subtopicoDecomposedSchema` |
| `src/hooks/moderation/useCuradoriaTree.ts` | Mescla GraphQL + `edital_cache.decomposicao` em tree hierárquica |
| `src/hooks/moderation/useCargosCurados.ts` | Lista todos os cargos da API com status do cache |
| `src/hooks/useDebouncedCallback.ts` | Hook utilitário para debounce de callbacks |
| `src/views/CuradoriaEditaisPage.tsx` | Página raiz com layout 2 colunas |
| `src/components/moderation/curadoria/CargoListSidebar.tsx` | Sidebar com busca + filtro por status |
| `src/components/moderation/curadoria/CargoListItem.tsx` | Row individual da sidebar |
| `src/components/moderation/curadoria/CuradoriaTreeMain.tsx` | Painel principal com header + tree |
| `src/components/moderation/curadoria/DisciplinaSection.tsx` | Seção colapsável por disciplina |
| `src/components/moderation/curadoria/TopicoSection.tsx` | Seção de tópico com lista de subtópicos |
| `src/components/moderation/curadoria/SubtopicoRow.tsx` | Row editável inline com origin badge |
| `src/components/moderation/curadoria/CuradoriaActions.tsx` | Barra de ações (curar/publicar/arquivar) |
| `src/components/moderation/curadoria/OriginBadge.tsx` | Dot indicador IA (verde) vs manual (cinza) |
| `src/components/moderation/curadoria/CuradoriaEmptyState.tsx` | State vazio quando nenhum cargo selecionado |

## Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `src/App.tsx` | Import + rota `curadoria-editais` no bloco `/moderacao` |
| `src/components/moderation/layout/ModerationSidebar.tsx` | Nav item "Curadoria" com ícone `Sparkles` |

---

## Diff vs Sub-plan 5

Sub-plan 5 adicionou `EditalCuradoriaPanel` dentro do fluxo de CRUD de editais (`/moderacao/editais`). Sub-plan 5.5 cria uma **rota dedicada** com:

- **Sidebar de cargos**: filtrável por status (sem cache / curadoria / publicado / arquivado), busca por nome
- **Tree completa**: disciplina → tópico → subtópico, editável inline com autosave 800ms debounced
- **Origin tracking**: cada subtópico tem `origin: 'ai' | 'manual'`, visível como dot colorido
- **Ações por status**: "Curar com IA" / "Re-curar com IA" (com confirm dialog), "Publicar", "Arquivar"

O painel inline `EditalCuradoriaPanel` em `/moderacao/editais` permanece intocado como fallback.

---

## Padrões/desvios

- `useDebouncedCallback` foi criado em `src/hooks/` (não `src/hooks/moderation/`) por ser utilitário genérico
- Nav item adicionado em `ModerationSidebar.tsx` (não `ModerationShell.tsx`) pois o shell só wrapa `ModerationSidebar` — é onde os `navItems` vivem
- `useDebouncedCallback` foi criado antes de `CuradoriaTreeMain` (Task 6) para resolver a dependência de import — ambos estão no commit correto da Task 7

---

## Próximos passos sugeridos

- Endpoint GraphQL `topicos_by_cargo(cargoId)` para eliminar N+1 queries na `useCuradoriaTree`
- Diff visual antes/após re-curar (via snapshot do decomposicao antes de sobrescrever)
- Virtualização da tree para cargos com 200+ subtópicos
- Bulk select para publicar múltiplos cargos de uma vez
