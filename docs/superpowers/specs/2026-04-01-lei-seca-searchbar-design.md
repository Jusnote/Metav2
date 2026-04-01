# Lei Seca — Redesign da Barra de Busca (Estado Fechado)

**Data:** 2026-04-01
**Status:** Aprovado
**Escopo:** Visual da barra fechada + reposicionamento do breadcrumb + tab "Buscar" placeholder

---

## 1. Problema

A barra de busca da Lei Seca usa glass morphism (white/65 + backdrop-blur) com breadcrumb integrado. O estilo destoa da barra de questões (limpa, branca, borda sólida) e parece carregado.

## 2. Mudanças

### 2.1 Barra fechada — novo visual

**Antes (glass morphism):**
```
bg-white/65 backdrop-blur-[12px] border-white/50 rounded-[10px]
box-shadow: inset highlight + dual layer
Conteúdo: ícone + breadcrumb cheio + counter + kbd
```

**Depois (estilo questões):**
```
bg-white border-[#e2e5ea] rounded-[12px] height: 42px
Conteúdo: ícone busca + placeholder + ⌘F badge
```

Especificações:
- **Background:** `#fff` (branco sólido)
- **Borda:** `1px solid #e2e5ea`
- **Borda hover:** `1px solid #d0d3d8`
- **Border radius:** `12px`
- **Altura:** `42px`
- **Padding:** `0 16px`
- **Gap:** `10px`
- **Ícone busca:** 16px, cor `#888`, hover `#16a34a`
- **Placeholder:** "Buscar artigo, tema, palavra...", `13.5px`, cor `#a0a0a0`
- **Kbd badge:** `⌘F` (Mac) / `Ctrl+F` (Windows), font mono 10px, bg `#f5f6f8`, border `#e8eaed`, radius `4px`
- **Transição:** `border-color 150ms ease`

### 2.2 Breadcrumb — reposicionado abaixo

O breadcrumb sai de dentro da barra e vai para baixo dela como texto informativo.

- **Posição:** abaixo da barra, `padding: 6px 4px 0`
- **Font:** 11px, cor `#a0afa5` (segmentos inativos)
- **Segmento ativo** (último): cor `#4a6350`, weight 500
- **Separadores:** `›`, cor `#d4dbd7`, font 9px
- **Não clicável** — apenas informativo
- **Conteúdo:** mesma hierarquia que já existe (Lei > Parte > Título > Capítulo)

### 2.3 Estado expandido — sem mudanças visuais

Ao clicar na barra, abre o estado expandido verde **exatamente como está hoje**:
- Background `#fafcfb`
- Borda `rgba(22,163,74,0.2)` com glow `rgba(22,163,74,0.06)`
- Input com placeholder "Buscar artigo, tema, palavra..."
- Lista de artigos com dropdown navegável
- Resultados filtrados ao digitar

### 2.4 Tabs no estado expandido — Navegar + Buscar (em breve)

Adicionar duas tabs entre o input e a lista de resultados:

**Tab "Navegar":**
- Ativa por padrão
- Estilo: padding `8px 16px`, font 12px, weight 600, cor `#16a34a`, border-bottom `2px solid #16a34a`
- Conteúdo: lista de artigos existente (sem mudança)

**Tab "Buscar":**
- Desabilitada, não clicável
- Estilo: cor `#c4ccc8`, weight 500, cursor default
- Badge "Em breve" ao lado: font 9px, weight 600, bg `#f0f5f2`, cor `#a0afa5`, padding `2px 6px`, radius `4px`

**Container das tabs:**
- `display: flex`, sem gap
- `border-bottom: 1px solid #e8ede9`
- Margin top `12px` (abaixo do input)

---

## 3. Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/components/lei-seca/SearchBreadcrumb.tsx` | Redesign do estado fechado + breadcrumb externo + tabs |

---

## 4. O que NÃO muda

- Lógica de abertura/fechamento (Ctrl+F, clique)
- Estado expandido interno (input, filtros, lista de artigos, resultados)
- Keyboard shortcuts
- Mobile behavior
- Scroll spy (atualização do breadcrumb ao scrollar)

---

## 5. Decisões técnicas

- **Sem counter (3/50)** na barra fechada — a contagem de artigos pode estar incorreta por conta dos revogados
- **Breadcrumb não clicável** — a navegação por artigos fica dentro do estado expandido
- **Tab "Buscar" desabilitada** — será ativada quando embeddings estiverem prontos (spec futuro)
- **Detecção futura:** quando "Buscar" for implementada, digitar número fica na tab "Navegar", digitar texto muda pra tab "Buscar" automaticamente
