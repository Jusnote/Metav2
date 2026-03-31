# Mobile UX — Design Spec

**Data:** 2026-03-31
**Status:** Aprovado
**Escopo:** Mobile completo — QuestionCard footer, editor de comentários, Lei Seca, detalhes de toolbar/breakpoints/dismiss

---

## 1. Breakpoints e Detecção

### Hooks existentes

- `useIsSmall()` → `< 640px` (Tailwind `sm`)
- `useIsMobile()` → `< 768px` (Tailwind `md`)

### Comportamento por faixa

| Faixa | Largura | Dispositivo típico | Layout |
|-------|---------|-------------------|--------|
| Celular | < 768px | Phones 5.5"-6.7" | Sheets, overflow, toggle |
| Tablet retrato | 768-1024px | iPad, Galaxy Tab vertical | Sheets maiores, mais contexto |
| Tablet landscape / Desktop | > 1024px | iPad landscape, desktop | Layout inline atual |

**Decisão:** O corte principal é **768px** (`useIsMobile()`). Abaixo = mobile UX com sheets. Acima de 1024px = desktop inline.

**Tablet landscape:** Detectado pela largura (>1024px), usa layout desktop automaticamente. Sem lógica de orientação explícita.

---

## 2. QuestionCard Footer

### Problema atual

6+ botões (Gabarito, Estatísticas, Comunidade, Nota, Flag, Explicar IA) numa linha horizontal. No mobile: texto escondido via `hidden sm:inline`, ícones de 15px, touch targets insuficientes.

### Solução: primários + overflow "···"

**Botões visíveis (3 + overflow):**

```
[ 📋 Gabarito ] [ 📊 Stats ] [ 💬 3 ] | [ ··· ]
```

- 3 ações primárias com `flex: 1`, touch target mínimo 40px de altura
- Separador vertical `1px #e4e4e7` antes do overflow
- Botão "···" com `width: 40px`, background `#fafafa`, border-radius `8px`

**Bottom sheet de overflow (ao tocar "···"):**

Abre sheet com 4 ações secundárias, cada uma com ícone colorido (36x36px fundo pastel), label (13px bold) e descrição (11px cinza):

1. ✏️ **Anotação pessoal** — "Salvar nota privada sobre esta questão" (fundo `#faf8ff`)
2. 🚩 **Reportar erro** — "Gabarito, enunciado ou classificação errada" (fundo `#fef2f2`)
3. ✨ **Explicar com IA** — "Análise detalhada de cada alternativa" (fundo `#ede9fe`)
4. 🔖 **Salvar questão** — "Adicionar aos favoritos" (fundo `#f0fdf4`)

**Header do sheet:** "Questão #N · Matéria" para manter contexto na lista.

**Dismiss:** toca fora (overlay escuro `rgba(0,0,0,0.35)`) ou botão ✕ no header do sheet.

### Modo lista vs individual

Mesmo componente, ajuste de densidade:

| | Individual | Lista |
|---|---|---|
| Padding footer | 8px 10px | 6px 10px |
| Touch target botões | 40px | 34px |
| Touch target "···" | 40px | 34px |

Na lista, ao tocar "···" no card N: sheet abre sobre toda a lista com overlay escuro. Scroll da lista não se move (`overflow: hidden` no body). Ao fechar, posição de scroll preservada.

### Desktop (>1024px)

Sem mudança — footer atual com todos os botões visíveis.

---

## 3. Editor de Comentários

### Problema atual

Toolbar com 25+ botões numa linha horizontal. Inutilizável em mobile. Editor inline ocupa pouco espaço com teclado aberto.

### Solução: bottom sheet com botão toggle

**Leitura de comentários:** inline no card como hoje. Nenhuma mudança.

**Escrita de comentários:** ao tocar para escrever, abre bottom sheet.

### Sheet do editor — Celular (< 768px)

**Modo escrita (padrão ao abrir):**
- Sheet ocupa **82%** da tela
- Questão aparece como preview opaco no topo (18%), **não interativa**
- Header do sheet: botão `👁 Ver questão` (bg `#f4f4f5`, border `#e4e4e7`) + "Questão #N" + botão ✕ + botão "Publicar" (bg `#7c3aed`)
- Área de editor com scroll
- Toolbar fixa acima do teclado

**Modo leitura (ao tocar "👁 Ver questão"):**
- Sheet anima para **30%**
- Questão + alternativas + comentários ficam visíveis e **scrolláveis** (70%)
- Draft aparece como preview compacto no sheet minimizado
- Botão muda para `✏️ Voltar ao editor` (bg `#7c3aed`, texto branco)
- Ao tocar: sheet anima de volta para 82%, foco retorna ao editor
- **Draft nunca se perde** entre toggles

### Sheet do editor — Tablet retrato (768-1024px)

**Modo escrita:** Sheet **60%**, questão visível com **40%** (scrollável, não opaca)
**Modo leitura:** Sheet **25%**, questão com **75%**

Mesma mecânica de toggle, mais espaço em ambos os modos.

### Desktop (>1024px)

Editor inline como hoje. Sem sheet, sem toggle.

### Toolbar mobile

**Botões visíveis (com scroll horizontal):**

```
[ B ] [ I ] [ U̲ ] [ S̶ ] | [ ≡ ] [ •— ] | [ 📎 ] [ 🔗 ] | [ ··· ]
```

- 8 botões visíveis: Bold, Italic, Underline, Strikethrough, Lista ordenada, Lista bullet, Upload mídia, Link
- Separadores visuais entre grupos
- Botão "···" no final abre sheet com ferramentas avançadas
- Tamanho: **32px** no celular, **34px** no tablet
- Gap: 3px celular, 4px tablet
- Background: white, border `1px solid #e4e4e7`, border-radius `6px`

**Sheet de ferramentas avançadas (do "···"):**
- H3 (Heading)
- Blockquote
- Code block
- Cor do texto
- Cor de fundo
- Tabela
- Equação (math)
- Vídeo embed
- Undo / Redo

### Animações

- Sheet open: `transform: translateY(0)` com `transition: 300ms cubic-bezier(0.32, 0.72, 0, 1)`
- Sheet close: `transform: translateY(100%)` mesma curva
- Toggle entre modos: mesma transição de 300ms na height do sheet

---

## 4. Lei Seca

### Problema atual

Sidebar fixa de 360px (Study Companion) e 340px (Comentários) não escondem no mobile. Texto da lei fica esmagado.

### Solução: painéis viram bottom sheet

**Layout mobile (< 768px e tablet 768-1024px):**
- Texto da lei ocupa **tela cheia**
- Dois botões no header: `🤖` (Study Companion) e `💬` (Comentários/Notas)
- Ao tocar num botão: bottom sheet abre sobre o texto
- Texto da lei fica parcialmente visível no topo (dimmed)
- Mesma mecânica de toggle: botão no header do sheet para alternar lei/painel

**Proporções do sheet:**

| Dispositivo | Sheet aberto | Lei visível |
|---|---|---|
| Celular | 65% | 35% |
| Tablet | 50% | 50% |

**Header do sheet:** ícone + nome do painel ("Study Companion" ou "Comentários") + botão ✕

**Dismiss:** toca no ✕ ou no overlay. Botões no header da página voltam ao estado inativo.

### Desktop (>1024px)

Painéis laterais como hoje. Sem mudança.

---

## 5. Comentários Inline — Colapso em Mobile

### Problema

Thread com muitos comentários empurra a questão para longe no scroll mobile.

### Solução

- Mostrar **3 comentários top-level** colapsados por padrão
- Botão "Ver N comentários" (texto `#7c3aed`, 12px) para expandir todos
- **Replies** colapsadas por padrão — botão "N respostas" para expandir cada thread
- Ao colapsar: animação suave de height com `300ms ease`
- No desktop: sem mudança, tudo expandido

---

## 6. Modais de Report — Adaptação Mobile

### Problema

`QuestionReportModal` e `LeiReportModal` usam Dialog com `max-w-[440px]`. Em telas < 400px pode ficar apertado.

### Solução

No mobile (< 768px): modais de report viram **bottom sheet** em vez de Dialog centrado.

- Mesma estrutura interna (título, radio reasons, textarea, botões)
- Anima de baixo pra cima com border-radius `16px 16px 0 0`
- Max-height: `85vh`
- Safe area: `padding-bottom: max(12px, env(safe-area-inset-bottom, 12px))`
- Dismiss: toca fora ou botão Cancelar

No desktop/tablet: Dialog centrado como hoje.

---

## 7. Padrões Compartilhados

### Bottom Sheet reutilizável

Um único componente `MobileSheet` usado em 4 contextos:

1. **Footer overflow** — ações secundárias da questão
2. **Editor de comentários** — escrita com toggle
3. **Lei Seca painéis** — Companion e Comentários
4. **Report modals** — adaptação mobile dos dialogs

Props:
- `height`: porcentagem (`'25%' | '30%' | '60%' | '65%' | '70%' | '82%' | '85%'`)
- `onClose`: callback
- `header`: ReactNode
- `footer`: ReactNode (toolbar no caso do editor)
- `overlay`: boolean (default true)
- `animationDuration`: number (default 300)

### Toggle button

Componente `SheetToggle` reutilizado no editor e na Lei Seca:
- Estado A: label + ícone (ex: "👁 Ver questão")
- Estado B: label + ícone (ex: "✏️ Voltar ao editor")
- Background alterna entre `#f4f4f5` (inativo) e `#7c3aed` (ativo)
- Padding: `6px 12px`, border-radius `8px`, font-size `10px`, weight 600

### Safe area

Todos os sheets usam:
```css
padding-bottom: max(12px, env(safe-area-inset-bottom, 12px));
```

### Touch targets

Mínimo 34px em todos os contextos mobile. Recomendado 40px para ações primárias.

### Dismiss patterns

- **Toca fora** (overlay) → fecha sheet
- **Botão ✕** no header → fecha sheet
- **Botão Cancelar** (nos reports) → fecha sheet
- **Sem gestos de drag** — evita conflito com seleção de texto

---

## 8. Fases de Implementação

Cada fase mergeia independente — se parar na 1, já tem valor.

### Fase 1 — QuestionCard footer
- Componente `MobileSheet`
- Footer overflow com "···"
- Sheet de ações secundárias
- Ajuste de touch targets

### Fase 2 — Editor de comentários
- Sheet fullscreen para escrita
- Toggle "Ver questão" / "Voltar ao editor"
- Toolbar mobile com scroll + overflow "···"
- Proporções por breakpoint

### Fase 3 — Lei Seca
- Painéis laterais viram sheet
- Botões no header da página
- Toggle lei/painel
- Proporções por breakpoint

### Fase 4 — Detalhes
- Colapso de comentários longos
- Report modals como sheet no mobile
- Tablet landscape → desktop layout
- Testes em dispositivos reais

---

## 9. Decisões Técnicas

- **`react-modal-sheet`** (v5.4.0) já instalada mas não usada. Avaliar se serve ou manter implementação custom (como `QuestoesFilterSheet`).
- **`useIsMobile()`** (768px) como corte principal mobile/desktop.
- **Sem detecção de orientação** — breakpoints por largura. Tablet landscape (>1024px largura) usa layout desktop naturalmente.
- **CSS transitions** (não Framer Motion) para animações de sheet — menor bundle, mais performático.
- **`overflow: hidden` no body** quando sheet aberto — previne scroll da lista por baixo.
- **Draft no editor** persiste em state React (não localStorage) entre toggles — recria ao fechar/abrir o sheet.
