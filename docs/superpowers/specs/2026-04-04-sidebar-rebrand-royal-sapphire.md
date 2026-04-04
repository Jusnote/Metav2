# Sidebar Redesign + Rebranding: Royal Sapphire

**Data**: 2026-04-04
**Status**: Aprovado

## Resumo

Redesign completo da sidebar (escura → clara) com mudança de marca inteira: amber (#E8930C) → Royal Sapphire (#1E40AF → #3B82F6). Simplificação do layout de 3 containers aninhados para flat. Separador Soft Glow entre painéis.

## Decisões de Design

### 1. Estrutura

- **Icon rail**: mantém 56px de largura
- **Layout**: simplificar de 3 containers (outer → rounded box → rail + content) para **flat**: `Layout (flex, h-screen) > Icon Rail + [Flyout] + Content`
- **Flyout**: mantém comportamento atual (Conteúdos com DocumentsOrganizationSidebar, Cadernos com CadernosSidebar, Flashcards com sub-items simples). Animação Framer Motion preservada.

### 2. Superfície e Separador

- **Sidebar**: fundo branco `#ffffff`
- **Content area**: fundo off-white `#f8f9fb`
- **Separador Soft Glow** entre painéis:
  - Linha 1px com gradiente vertical azul: `linear-gradient(180deg, transparent 5%, #dbeafe 30%, #93c5fd 50%, #dbeafe 70%, transparent 95%)` com opacity 0.6
  - Glow suave de 9px: pseudo-element com `rgba(59,130,246,0.04)` → `rgba(59,130,246,0.06)` → `rgba(59,130,246,0.04)`
  - Aplicado entre: rail↔flyout e flyout↔content (quando flyout aberto), ou rail↔content (estado normal)
- **Sem floating glass** — painéis integrados, sem backdrop-filter/blur, sem sombras de card

### 3. Paleta Royal Sapphire

Substituição global de amber por azul. Mapeamento de cores:

#### Hex diretos (find & replace)

| Antes | Depois | Uso |
|-------|--------|-----|
| `#E8930C` | `#2563EB` | Brand primary (logo, active states, botões, checkboxes) |
| `#C47A0A` | `#1E40AF` | Brand dark (gradiente end, avatar) |
| `#D4860B` | `#1D4ED8` | Hover state (botão submit) |
| `#D97706` | `#2563EB` | Active text accent |
| `#b45309` / `#B45309` | `#1E40AF` | Art. prefix lei seca, hover states |
| `#F59E0B` | `#3B82F6` | Gradiente start |
| `rgba(232,147,12,*)` | `rgba(37,99,235,*)` | Sombras e rings (manter alpha) |

#### Tailwind utilities (class rename)

| Antes | Depois |
|-------|--------|
| `amber-50` | `blue-50` |
| `amber-100` | `blue-100` |
| `amber-200` | `blue-200` |
| `amber-300` | `blue-300` |
| `amber-400` | `blue-400` |
| `amber-500` | `blue-500` |
| `amber-600` | `blue-600` |
| `amber-700` | `blue-700` |
| `amber-800` | `blue-800` |
| `amber-900` | `blue-900` |
| `amber-950` | `blue-950` |

**Exceções que mantêm amber** (uso semântico, não brand):
- `src/components/moderation/shared/StatusDot.tsx` — dot de warning/pending (semântico)
- `src/components/moderation/overview/OverviewAnalytics.tsx` — cor de spam (semântico)
- `src/components/moderation/users/UsersPage.tsx` — status "Pendente" (semântico)
- `src/components/moderation/users/UserDrawer.tsx` — botão suspender (semântico warning)
- `src/components/QuestionCard.tsx` linha 166 — dificuldade "Medio" (semântico, escala verde/amber/vermelho)
- `src/components/BlockBasedFlashcardEditor.tsx` — word-hiding type indicator (tipo-específico, não brand)
- `src/components/UserAvatar.tsx` — rank "bronze" (semântico, cor do rank)
- `src/types/caderno.ts` — `#f59e0b` na paleta de cores de caderno (cor escolhida pelo usuário, não brand)
- `src/components/goals/TopicConflictResolver.tsx` — warning styling inteiro (semântico)
- `src/components/goals/TopicConflictAccordion.tsx` — warning styling inteiro (semântico)

**Dark mode**: classes existentes `dark:bg-amber-*`, `dark:text-amber-*` etc. também mudam para `dark:bg-blue-*`, `dark:text-blue-*` nos mesmos arquivos — exceto as exceções semânticas acima.

#### Variável CSS renomeada

No `src/index.css`, o token `amberStyle` em GrifoText será renomeado para `brandStyle`.

### 4. Tokens de Cor (referência)

```
--brand-900: #1E3A5F
--brand-800: #1E40AF    (primary dark, gradients, Art. prefix)
--brand-600: #2563EB    (primary, logo, active, buttons)
--brand-500: #3B82F6    (primary light, gradient end)
--brand-400: #60A5FA    (hover light)
--brand-300: #93C5FD    (glow line)
--brand-200: #BFDBFE    (tint)
--brand-100: #DBEAFE    (active bg, badges)
--brand-50:  #EFF6FF    (subtle bg)

--surface-sidebar:  #ffffff
--surface-content:  #f8f9fb
--surface-flyout:   #ffffff

--neutral-text:     #1a1a1a
--neutral-secondary:#475569
--neutral-muted:    #8b8fa3
--neutral-border:   #e5e7eb

--mod-violet:       #7C3AED  (mantém)
--mod-violet-light: #8B5CF6  (mantém)
--mod-violet-bg:    #EDE9FE  (mantém)
```

### 5. Active State da Sidebar

- **Background**: `#DBEAFE` (blue-100) com opacity 0.8
- **Ícone**: stroke `#1E40AF`
- **Indicador lateral**: 2.5px × 18px, `linear-gradient(180deg, #1E40AF, #3B82F6)`, border-radius `0 3px 3px 0`
- **Shadow sutil**: `0 1px 4px rgba(30,64,175,0.08)`

### 6. Inactive State da Sidebar

- **Ícone**: stroke `#8b8fa3`
- **Hover background**: `rgba(0,0,0,0.04)`
- **Hover ícone**: stroke `#64748b`

### 7. Logo

- **Gradiente**: `linear-gradient(135deg, #1E40AF, #3B82F6)`
- **Shadow**: `0 2px 8px rgba(30,64,175,0.3)`
- **Forma**: mantém rounded shape atual

### 8. Avatar

- **Gradiente**: `linear-gradient(135deg, #1E40AF, #3B82F6)`
- **Shadow**: `0 2px 6px rgba(30,64,175,0.25)`

### 9. Flyout Panel

- **Background**: `#ffffff`
- **Item ativo**: `background: #DBEAFE; color: #1E40AF; font-weight: 500`
- **Item hover**: `background: rgba(30,64,175,0.04); color: #475569`
- **Separado do rail e do content por Soft Glow**

### 10. Mobile

- **Header**: mantém estrutura, cores adaptadas (bg-gray-100 → bg-white ou #f8f9fb)
- **Overlay menu**: gradiente `from-white via-blue-50/20 to-zinc-100` (antes via-amber-50/20)
- **Items ativos**: `bg-blue-100 text-blue-700` (antes amber)

### 11. Lei Seca — Art. Prefix

- **Cor**: `#1E40AF` (antes `#b45309`)
- **Variável**: renomear `amberStyle` → `brandStyle` em GrifoText.tsx
- **Afeta**: fast path (sem grifos) e path com grifos em `renderSegmentContent`

### 12. Moderação

- **Mantém violet intacto**: `bg-violet-500/20 text-violet-300` (active), `violet-400` (indicator)
- Sem alteração

## Arquivos Afetados

### Sidebar core (prioridade 1)
- `src/components/AppSidebar.tsx` — layout, cores, logo, avatar, active states, mobile

### Lei Seca (prioridade 2)
- `src/components/lei-seca/GrifoText.tsx` — Art. prefix #b45309 → #1E40AF

### Questões (prioridade 3)
- `src/components/questoes/QuestoesSearchBar.tsx` — slash mode amber → blue
- `src/components/questoes/QuestoesSlashInlineDropdown.tsx` — borders, accents
- `src/components/questoes/QuestoesFilterSheet.tsx` — checkboxes, botões, gradients
- `src/components/questoes/QuestoesFilterPopover.tsx` — checkboxes, links
- `src/components/questoes/QuestoesFilterPill.tsx` — hover/active borders
- `src/components/questoes/FilterChipsBidirectional.tsx` — badge bg
- `src/components/questoes/QuestoesAdvancedPopover.tsx` — toggles, accents
- `src/components/questoes/VirtualizedQuestionList.tsx` — badge
- `src/components/QuestionCard.tsx` — submit btn, bookmark, badges, AI border

### Conteúdos & Organização (prioridade 4)
- `src/views/DocumentsOrganizationPage.tsx` — stepper, icons
- `src/components/DocumentsOrganizationSidebar.tsx` — hover states
- `src/components/TopicItem.tsx` — selection border
- `src/components/SubtopicItem.tsx` — checkbox, selection, stars

### Cadernos (prioridade 5)
- `src/views/CadernosPage.tsx` — tags, filters, notes
- `src/components/cadernos/CadernosSidebar.tsx` — active states

### Componentes compartilhados (prioridade 6)
- `src/components/DayWithProgress.tsx` — progress colors, selected day
- `src/components/lei-seca/lei-anotacao-tooltip.tsx` — tipo alteração
- `src/components/lei-seca/lei-seca-editor.tsx` — active tab, bookmark
- `src/components/lei-seca/dispositivos/DispositivoGutter.tsx` — note dot
- `src/components/lei-seca/dispositivos/DispositivoFooter.tsx` — note button
- `src/components/lei-seca/comments/DispositivoNote.tsx` — private note styling
- `src/components/questoes/comments/PrivateNote.tsx` — private note styling
- `src/components/questoes/comments/EndorsedBadge.tsx` — endorsed star
- `src/components/shared/comments/CommentItem.tsx` — avatar gradient
- `src/components/goals/TopicConflictResolver.tsx` — warning styling (MANTER amber, semântico)
- `src/components/goals/TopicConflictAccordion.tsx` — warning styling (MANTER amber, semântico)
- `src/components/AnimatedBackground.tsx` — star icon decorativa (MUDAR para blue)

### CSS / Config
- `src/index.css` — sidebar CSS variables (já existem mas não são usadas, atualizar valores)

## Fora de Escopo

- Dark mode (manter classes dark: existentes, adaptar cores correspondentes)
- Novos componentes ou features
- Mudança de ícones (Tabler icons permanecem)
- Animações do flyout (Framer Motion preservado)
- Responsividade mobile (estrutura mantida, só cores mudam)

## Mockups

Mockups visuais salvos em `.superpowers/brainstorm/12257-1775315267/content/`:
- `01-structural-direction.html` — 3 opções estruturais
- `02-elegance-variants.html` — 3 tratamentos de elegância
- `03-blue-palette.html` — 4 paletas azul
- `05-both-states.html` — floating glass, dois estados
- `06-separator-styles.html` — 3 estilos de separador (escolhido: Soft Glow)
