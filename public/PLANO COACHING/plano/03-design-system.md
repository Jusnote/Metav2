# 03 — Design System

> **Esta é a fonte da verdade visual do sistema. Nenhum componente deve hardcoded cores, espaçamentos ou tamanhos fora dos tokens definidos aqui.**

## Tema

**Dark-first.** Os mockups validados pelo cliente estão em dark mode. Light mode é V2.

## Paleta de cores

### Cores base (fundo e texto)

```css
:root {
  /* Backgrounds */
  --bg-canvas: #0F1419;           /* Background principal da página */
  --bg-surface: #1A1F26;          /* Cards, containers */
  --bg-surface-2: rgba(255,255,255,0.03);  /* Hover, áreas secundárias */
  --bg-surface-3: rgba(255,255,255,0.06);  /* Press, áreas terciárias */
  
  /* Texto */
  --text-primary: #E6E8EB;        /* Texto principal */
  --text-secondary: #8B95A1;      /* Texto secundário, labels */
  --text-tertiary: #5A6470;       /* Texto desabilitado, placeholders */
  
  /* Bordas */
  --border-subtle: rgba(255,255,255,0.06);
  --border-default: rgba(255,255,255,0.08);
  --border-strong: rgba(255,255,255,0.12);
}
```

### Cores semânticas

```css
:root {
  /* Verde (Teoria, Sucesso, Concluído) */
  --color-teoria-bg: rgba(29,158,117,0.12);
  --color-teoria-border: rgba(29,158,117,0.4);
  --color-teoria-text: #5DCAA5;
  --color-teoria-solid: #1D9E75;
  
  /* Azul (Questões, Informação) */
  --color-questoes-bg: rgba(55,138,221,0.12);
  --color-questoes-border: rgba(55,138,221,0.4);
  --color-questoes-text: #85B7EB;
  --color-questoes-solid: #378ADD;
  
  /* Coral (Lei Seca, Alerta) */
  --color-leiseca-bg: rgba(216,90,48,0.12);
  --color-leiseca-border: rgba(216,90,48,0.4);
  --color-leiseca-text: #F0997B;
  --color-leiseca-solid: #D85A30;
  
  /* Roxo (Revisão FSRS, Sugestão Inteligente) */
  --color-revisao-bg: rgba(127,119,221,0.12);
  --color-revisao-border: rgba(127,119,221,0.4);
  --color-revisao-text: #AFA9EC;
  --color-revisao-solid: #7F77DD;
  
  /* Verde-claro (Mapa Mental, Resumo) */
  --color-mapa-bg: rgba(99,153,34,0.15);
  --color-mapa-text: #97C459;
  --color-mapa-solid: #639922;
  
  /* Âmbar (Atenção, Em Risco) */
  --color-atencao-bg: rgba(239,159,39,0.15);
  --color-atencao-text: #EF9F27;
  --color-atencao-solid: #EF9F27;
  
  /* Vermelho (Erro, Crítico, Peso 5) */
  --color-erro-bg: rgba(226,75,74,0.15);
  --color-erro-text: #F09595;
  --color-erro-solid: #E24B4A;
}
```

### Mapeamento tipo de atividade → cor

| Tipo | Cor base | Uso |
|------|----------|-----|
| `teoria` | Verde | Conteúdo teórico, leitura |
| `questoes` | Azul | Sessão de questões |
| `lei_seca` | Coral | Leitura de letra de lei |
| `revisao_fsrs` | Roxo | Revisão agendada pelo FSRS |
| `mapa_mental` | Verde-claro | Mapas, esquemas visuais |
| `resumo` | Verde-claro | Resumos, sínteses |
| `simulado` | Cinza forte | Simulados cronometrados |

### Mapeamento peso → cor da barrinha

| Peso | Cor | Significado |
|------|-----|-------------|
| 5 | Vermelho `#E24B4A` | Cai sempre — prioridade máxima |
| 4 | Âmbar forte `#EF9F27` | Cai muito |
| 3 | Âmbar `#EF9F27` (parcial) | Médio |
| 2 | Cinza claro | Cai pouco |
| 1 | Cinza | Raro |

## Tipografia

### Família

```css
--font-sans: 'Inter', 'Anthropic Sans', system-ui, sans-serif;
--font-mono: 'JetBrains Mono', 'Consolas', monospace;
```

### Escala

| Token | Tamanho | Line-height | Uso |
|-------|---------|-------------|-----|
| `text-xs` | 10px | 1.4 | Labels técnicos, badges |
| `text-sm` | 11px | 1.4 | Metadados, dicas |
| `text-base` | 12px | 1.5 | Texto secundário |
| `text-md` | 13px | 1.5 | Texto padrão da UI |
| `text-lg` | 14px | 1.5 | Subtítulos |
| `text-xl` | 16px | 1.5 | Títulos de seção |
| `text-2xl` | 18px | 1.4 | Títulos de página |
| `text-3xl` | 24px | 1.3 | KPIs, números grandes |

### Pesos

- **400** (regular): texto corrido
- **500** (medium): títulos, labels destacados, valores numéricos

**Nunca usar 600 ou 700.** Fica visualmente pesado contra o dark background.

### Regras tipográficas

1. **Sentence case sempre.** Nunca Title Case, nunca ALL CAPS (exceto labels técnicos minúsculos como "SEMANA ATUAL" em 10-11px com letter-spacing).
2. **Letter-spacing 0.6-0.8px** nos labels uppercase pequenos (10-11px).
3. **Sem bold no meio de frase.** Bold apenas em títulos e labels.
4. **Números monospace** quando alinhamento importa (tabelas).

## Espaçamento

Sistema base 4px:

| Token | Valor |
|-------|-------|
| `space-1` | 4px |
| `space-2` | 8px |
| `space-3` | 12px |
| `space-4` | 16px |
| `space-5` | 20px |
| `space-6` | 24px |
| `space-8` | 32px |
| `space-10` | 40px |

## Border radius

| Token | Valor | Uso |
|-------|-------|-----|
| `radius-sm` | 4px | Badges, pills pequenos |
| `radius-md` | 6px | Botões, inputs, atividades |
| `radius-lg` | 8px | Cards, banners |
| `radius-xl` | 12px | Containers maiores |
| `radius-full` | 9999px | Avatares, ícones circulares |

## Componentes base

### Card

```tsx
// Padrão: fundo sutil, sem borda, radius-lg, padding consistente
<div className="
  bg-[var(--bg-surface-2)]
  rounded-lg
  p-4
">
```

### Card com destaque

```tsx
// Sugestão, item ativo: fundo semântico + borda semântica
<div className="
  bg-[var(--color-revisao-bg)]
  border border-[var(--color-revisao-border)]
  rounded-lg
  p-3.5
">
```

### Botão primário

```tsx
<button className="
  bg-[rgba(127,119,221,0.2)]
  border border-[rgba(127,119,221,0.4)]
  text-[var(--color-revisao-text)]
  px-3 py-1.5
  rounded-md
  text-sm font-medium
  hover:bg-[rgba(127,119,221,0.3)]
  transition-colors
">
```

### Botão secundário (outline)

```tsx
<button className="
  bg-transparent
  border border-[var(--border-default)]
  text-[var(--text-secondary)]
  px-2.5 py-1.5
  rounded-md
  text-sm
  hover:border-[var(--border-strong)]
  hover:text-[var(--text-primary)]
">
```

### Badge de tipo

```tsx
// Exemplo Teoria
<span className="
  bg-[var(--color-teoria-bg)]
  text-[var(--color-teoria-text)]
  text-[10px]
  px-1.5 py-0.5
  rounded
">
  Teoria
</span>
```

### Badge de peso (barrinha)

Visual de "sinal de wifi" — 5 barras crescentes, coloridas conforme peso:

```tsx
// peso = 1..5
function BarrinhaRelevancia({ peso }: { peso: number }) {
  const cores = {
    5: '#E24B4A',
    4: '#EF9F27',
    3: '#EF9F27',
    2: '#888780',
    1: '#5A6470'
  }
  const cor = cores[peso]
  
  return (
    <div className="flex gap-px items-end h-3">
      {[4, 6, 8, 10, 12].map((altura, i) => (
        <div
          key={i}
          className="w-[3px] rounded-sm"
          style={{
            height: `${altura}px`,
            background: i < peso ? cor : 'rgba(255,255,255,0.1)'
          }}
        />
      ))}
    </div>
  )
}
```

### Linha de atividade

Componente central do sistema. Spec completa:

```tsx
<div className="
  grid
  grid-cols-[24px_80px_1fr_70px_60px_60px]
  gap-2.5
  items-center
  px-3 py-2.5
  bg-[var(--bg-surface-2)]
  rounded-md
  /* Quando concluída: bg verde sutil + borda esquerda verde */
  /* Quando sugerida: bg roxo sutil + borda esquerda roxa */
">
  <Checkbox />
  <BadgeTipo tipo={atividade.tipo} />
  <Titulo />
  <BarrinhaRelevancia peso={atividade.peso} />
  <Tempo />
  <Desempenho />
</div>
```

### Cabeçalho de bloco temático

```tsx
<div className="
  flex items-center justify-between
  px-1 py-2
  mb-1.5
">
  <div className="flex items-center gap-2">
    <ChevronDown className="text-secondary" />
    <span className="w-2 h-2 rounded-sm" style={{ background: corDisciplina }} />
    <span className="text-md font-medium">
      {disciplina} · {bloco}
    </span>
    <span className="text-xs text-tertiary">
      {totalAtividades} · {totalHoras}
    </span>
  </div>
  
  {/* Mini progresso */}
  <div className="flex items-center gap-1">
    <ProgressMini valor={concluidas / total} cor={corDisciplina} />
    <span className="text-xs text-secondary">{concluidas}/{total}</span>
  </div>
</div>
```

## Tons de cinza para tabelas e listas

```css
/* Linha alternada (zebra) */
.row-zebra-odd { background: transparent; }
.row-zebra-even { background: rgba(255,255,255,0.015); }

/* Hover */
.row-hover:hover { background: var(--bg-surface-2); }

/* Selecionada */
.row-selected { background: var(--bg-surface-3); }
```

## Estados visuais

### Atividade pendente
- `bg: var(--bg-surface-2)`
- Sem borda lateral
- Texto cor normal

### Atividade concluída
- `bg: rgba(29,158,117,0.05)`
- `border-left: 2px solid #1D9E75`
- Título com `text-decoration: line-through`
- Mostra `desempenho_pct` à direita

### Atividade sugerida (banner principal)
- `bg: rgba(127,119,221,0.08)`
- `border-left: 2px solid #7F77DD`
- Ícone de `Sparkles` ao lado do título
- Título com `font-weight: 500`

### Atividade FSRS due
- Ícone de relógio antes do título
- Badge "due hoje" em âmbar
- Prioridade visual alta

## Iconografia

Biblioteca: **Lucide React** (importar individualmente para tree-shaking).

### Mapeamento

| Conceito | Ícone Lucide |
|----------|--------------|
| Bandeira/Marco | `Flag` |
| Checkmark | `CheckCircle2` (concluído), `Circle` (pendente) |
| Player | `PlayCircle` |
| Cadeado | `Lock` |
| Sparkles (sugestão IA) | `Sparkles` |
| Alvo | `Target` |
| Relógio | `Clock` |
| Calendário stats | `CalendarRange` |
| Chama (peso alto) | `Flame` |
| Cérebro (memória) | `Brain` |
| Tendência | `TrendingUp` |
| Lupa (zoom) | `ZoomIn` |
| Lâmpada (insight) | `Lightbulb` |

### Tamanhos

- **xs**: 11-12px (inline com texto pequeno)
- **sm**: 14-16px (badges, botões pequenos)
- **md**: 18-20px (botões padrão, headers de seção)
- **lg**: 24px (decorativos)

Nunca maior que 24px exceto em ilustrações específicas.

## Layout responsivo

### Breakpoints

```css
sm: 640px   /* Mobile landscape */
md: 768px   /* Tablet */
lg: 1024px  /* Desktop pequeno */
xl: 1280px  /* Desktop padrão */
2xl: 1536px /* Desktop grande */
```

### Estratégia

- **Mobile-first** no CSS
- **Tela do aluno funcional em 360px** (mínimo)
- **Admin pode exigir 1024px+** (uso desktop dominante)
- Tabelas em mobile viram cards empilhados
- Grids 4-col → 2-col em tablet → 1-col em mobile

## Animações e transições

**Regras:**

1. **Sutil sempre.** Duração 150-200ms para hover, 200-300ms para mudanças de estado.
2. **Easing `ease-out`** para entradas, `ease-in` para saídas.
3. **Sem animações elaboradas no MVP** — sem spring, sem parallax, sem confete.
4. **Respeitar `prefers-reduced-motion`.**

```css
/* Padrão de transição */
.transition-default {
  transition: background-color 200ms ease-out,
              border-color 200ms ease-out,
              color 150ms ease-out,
              opacity 200ms ease-out;
}
```

## Acessibilidade

- **Contraste mínimo:** WCAG AA (4.5:1 para texto normal, 3:1 para texto grande)
- **Focus rings:** sempre visíveis, usar `outline: 2px solid var(--color-revisao-solid); outline-offset: 2px`
- **Aria labels:** todo ícone-botão precisa de `aria-label`
- **Aria-live:** mudanças de estado importantes (concluiu atividade) anunciadas por screen reader

## Não-negociáveis visuais

1. **Sem gradientes decorativos.** Cores flat.
2. **Sem sombras** (exceto focus rings funcionais).
3. **Sem emojis na UI** (ícones Lucide).
4. **Sem CAPS** exceto labels técnicos pequenos.
5. **Sem cores fora desta paleta.**
6. **Cada cor encode significado** — não usar arco-íris para diferenciar coisas categoricamente neutras.

## Tailwind config (resumo)

O `tailwind.config.ts` deve declarar:

```ts
export default {
  content: [...],
  theme: {
    extend: {
      colors: {
        // Mapear as CSS vars
        canvas: 'var(--bg-canvas)',
        surface: 'var(--bg-surface)',
        // ... etc
      },
      fontSize: {
        // Mapear a escala custom
      },
      borderRadius: {
        // Mapear radius custom
      }
    }
  }
}
```

**Recomendação:** usar Tailwind v4 com `@theme` no CSS, que aceita CSS vars nativamente e elimina a duplicação no `tailwind.config.ts`.
