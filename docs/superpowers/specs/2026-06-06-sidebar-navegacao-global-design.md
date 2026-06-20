# Sidebar de navegação global recolhível — Design

**Data:** 2026-06-06
**Status:** Aprovado (aguardando revisão do spec)
**Arquivo principal afetado:** `src/components/AppTopNav.tsx`

## Problema

A navegação global hoje são duas barras horizontais empilhadas em `AppTopNav.tsx`:

1. **Top bar** (`#FBFAFD`, 82px) — logo, busca, seletor de cargo, cronograma, config, usuário.
2. **Navbar azul** (`<nav className="bg-[#0f1b3d]">`, 42px) — os botões de navegação: Início · Estudar · Flashcards · Questões · Lei Seca · Cadernos · Editais · Cronograma · Mais.

A navbar horizontal já está apertada (precisou de um dropdown "Mais" pra caber) e consome ~42px de altura vertical — espaço valioso nas telas de leitura (Lei Seca, Papiro/Estudar). Ela não escala bem conforme novas seções são adicionadas.

## Objetivo

Transformar **somente a segunda barra** (a navbar azul horizontal) numa **sidebar vertical recolhível à esquerda**. A top bar permanece intacta. O comportamento mobile permanece intacto.

## Não-objetivos (YAGNI)

- Não mexer na top bar (cargo, busca, cronograma quick-peek, config, usuário).
- Não mexer no layout mobile (continua com o overlay hambúrguer fullscreen atual).
- Não mexer na rota `/moderacao`, que tem layout próprio (`ModerationShell`) fora do `AppTopNav`.
- Sem temas, sem múltiplas sidebars, sem drag-resize.

## Decisões de design (validadas com o usuário)

| Decisão | Escolha |
|---|---|
| Formato | Sidebar vertical à esquerda, mesmo navy `#0f1b3d` |
| Acionamento | **Toggle por clique** num botão no topo da sidebar |
| Efeito ao abrir | **Empurra** o conteúdo (não sobrepõe) |
| Estado recolhido | **Rail de ícones** (~56px), tooltip no hover |
| Estado expandido | Ícones + rótulos (~216px) |
| Estado inicial | **Sempre recolhida** ao carregar o app |
| Persistência | Nenhuma — estado em memória; cada load começa recolhido |
| Agrupamento | Com grupos; rótulos de seção só aparecem quando expandida |

## Layout

### Desktop (`!isMobile`)

```
┌─────────────────────────────────────────────┐
│ Top bar (inalterada)                          │  82px
├──────┬────────────────────────────────────────┤
│ rail │                                         │
│  ▢   │            conteúdo (Outlet)            │  flex-1
│  ▢   │                                         │
│  ▢   │                                         │
└──────┴────────────────────────────────────────┘
   ↑ sidebar 56px (recolhida) / 216px (expandida) — empurra o conteúdo
```

A estrutura atual do bloco desktop em `AppTopNav` é uma coluna (`flex flex-col h-screen`): stripe → header sticky (top bar + cargo expansion + navbar) → content area. A mudança:

- A `<nav className="bg-[#0f1b3d]">` horizontal sai de dentro do header sticky.
- O bloco abaixo da top bar vira uma **linha** (`flex`): `<Sidebar />` + área de conteúdo.
- A `CargoSelectorExpansion` continua ocupando o slot entre a top bar e a área de conteúdo (full-width, acima da linha sidebar+conteúdo) — ela é parte do fluxo de cargo, não da navegação.

### Mobile (`isMobile`)

Sem alterações. O `IconMenu2` continua abrindo o overlay fullscreen com `allNavItems`.

## Componentes

Extrair a navegação para um componente dedicado, mantendo `AppTopNav` como orquestrador do shell.

### `AppSidebar` (novo — `src/components/AppSidebar.tsx`)

- **Responsabilidade:** renderizar o rail/sidebar de navegação desktop.
- **Props:** `expanded: boolean`, `onToggle: () => void`, mais o que precisar de `location`/`navigate` (ou consome `useLocation`/`useNavigate` direto).
- **Depende de:** a config de navegação (`mainNavigation`, `rightNavigation`, `moreItems`, `moderationItem`) e `useUserRole` pra Moderação.
- **Conteúdo:**
  - Botão de toggle no topo (ícone ☰ / chevron).
  - Item solto: **Início**.
  - Grupo **Estudo:** Estudar · Flashcards · Lei Seca · Cadernos.
  - Grupo **Prática & Gestão:** Questões · Editais · Cronograma.
  - Rodapé: **Mais** (Resumos · Editor · Moderação¹) e o controle de toggle/fixar.
  - ¹ Moderação só com `isModerator`.

### `SidebarItem` (sub-componente)

- Renderiza um item de navegação. Adapta-se ao estado:
  - **Recolhida:** só ícone, centralizado; `title`/tooltip com o label.
  - **Expandida:** ícone + label.
- Item ativo: barra vertical azul à esquerda (`#1E40AF`/`#3B82F6`), texto branco. Substitui o sublinhado azul horizontal atual.
- Lógica `isActive` reaproveitada (`href === "/" ? pathname === "/" : pathname.startsWith(href)`).

### Itens com subitens (Flashcards, Mais)

- **Expandida:** clicar no item-pai expande sub-linhas recuadas (Meus Decks / Modo Estudo).
- **Recolhida (rail):** hover abre um **flyout** lateral com os subitens (reaproveita o padrão de dropdown atual, reposicionado pra sair à direita do rail).

## Estado e persistência

- Estado `expanded: boolean` mora em `AppTopNav` (`useState(false)`).
- Inicialização: **sempre `false` (recolhida)** no load. Sem persistência — o toggle vale só para a sessão de página atual e reseta em recargas. (Decisão explícita do usuário: "sempre recolhida", não "lembrar o último".)
- A largura da área de conteúdo é puramente CSS (flex), então o toggle só muda a largura da sidebar; transição suave (`transition-[width]`).

## Cronograma

Permanece nos **dois lugares** — não é duplicação acidental:
- **Top bar:** `CronogramaSheet` (ícone `IconCalendarWeek`, atalho Alt+C) → espiada rápida da semana.
- **Sidebar:** item de navegação → página `/cronograma` completa.

## Acessibilidade

- `<nav aria-label="Navegação principal">` na sidebar.
- Botão de toggle com `aria-expanded` e `aria-label` ("Expandir/Recolher menu").
- Tooltips no rail via `title` ou o `Tooltip` do projeto.
- Ordem de tab preservada.

## Plano de testes (manual + verificação visual)

1. Toggle abre/fecha a sidebar e o conteúdo é empurrado (não sobreposto).
2. Load do app começa recolhido (rail).
3. Tooltip aparece no hover de cada ícone quando recolhida.
4. Rótulos de grupo (Estudo / Prática & Gestão) só aparecem quando expandida.
5. Item ativo correto por rota, com a barra azul vertical.
6. Subitens: flyout no rail (hover) e expand quando aberta (Flashcards, Mais).
7. Moderação só aparece com role de moderador.
8. Mobile permanece idêntico (overlay hambúrguer).
9. `/moderacao` permanece com seu layout próprio.
10. Telas full-width (Lei Seca, Documents-Org) convivem bem com o rail recolhido.

## Riscos

- **Convivência com painéis laterais das páginas** (Lei Seca gutter, Documents-Org): mitigado por começar recolhida (rail estreito). Validar visualmente nessas rotas.
- **Reposicionamento dos dropdowns:** os flyouts hoje saem pra baixo; no rail precisam sair pra direita. Reaproveitar o markup ajustando posição.
