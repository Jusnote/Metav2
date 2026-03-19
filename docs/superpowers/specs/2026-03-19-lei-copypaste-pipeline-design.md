# Design Spec: Pipeline de Ingestao de Leis — Copy/Paste

**Data:** 2026-03-19
**Status:** Draft
**Escopo:** Pipeline alternativo de ingestao via copy/paste do JusBrasil
**Relacionado:** `2026-03-19-lei-ingestion-pipeline-design.md` (Pipeline Playwright)

---

## 1. Contexto

Este spec descreve um pipeline **alternativo** ao Playwright para ingestao de leis. Ambos coexistem para teste e comparacao. As camadas 2 (parser), 3 (validacao) e 4 (storage) sao **identicas** entre os dois pipelines — so muda a camada 1 (entrada).

| Aspecto | Pipeline Playwright | Pipeline Copy/Paste |
|---|---|---|
| Camada 1 | CLI automatizado | Usuario cola manualmente |
| Camada 2 | Mesmo parser | Mesmo parser |
| Camada 3 | Mesma validacao | Mesma validacao |
| Camada 4 | Mesmo storage | Mesmo storage |
| Quando usar | Escalar para 200 leis | Primeiras 10-20 leis, validacao visual |

## 2. Problema Especifico do Copy/Paste

Quando o usuario copia do JusBrasil e cola no editor TipTap atual:

1. **Links `<a href>` sao descartados** — o editor de ingestao (`lei-ingestao-editor.tsx`) nao inclui a extensao Link do TipTap. Os links que identificam cada dispositivo sao perdidos.
2. **CSS classes sao perdidas** — `law-item_revoked` desaparece ao colar.
3. **Tags `<h6>` de hierarquia viram `<p>`** — TITULO e CAPITULO perdem a distincao visual.
4. **IDs de elementos sao perdidos** — `livro-i-10`, `capitulo-i-4726` desaparecem.

## 3. Solucao: Abordagem A+C (Link Extension + Paste Interceptor)

### 3.1 Visao Geral

```
Usuario copia lei inteira do JusBrasil (Ctrl+C)
  -> Cola no editor de ingestao (Ctrl+V)
  -> [A] Extensao Link preserva os <a href> no TipTap
  -> [C] Paste interceptor captura o HTML raw do clipboard ANTES do TipTap
     -> Extrai: links, CSS classes, IDs, tags h6
     -> Salva como metadados estruturados em paralelo
  -> Editor mostra texto com links visiveis (conferencia visual)
  -> Parser usa metadados do interceptor (primario) + links do TipTap (fallback)
  -> Camadas 2, 3, 4 identicas ao pipeline Playwright
```

### 3.2 Componente A: Link Extension no Editor de Ingestao

**Arquivo modificado:** `src/components/lei-seca/lei-ingestao-editor.tsx`

**Mudanca:** Adicionar extensao Link ao TipTap do editor de ingestao.

```typescript
// Atual (sem Link):
const extensions = [
  StarterKit.configure({ paragraph: false }),
  LeiParagraph,
  TextAlign,
  Highlight,
  Underline,
];

// Proposto (com Link):
const extensions = [
  StarterKit.configure({ paragraph: false }),
  LeiParagraph,
  TextAlign,
  Highlight,
  Underline,
  Link.configure({
    openOnClick: false,        // Nao abrir links ao clicar
    HTMLAttributes: {
      class: 'lei-device-link', // Classe CSS para estilizar
      target: null,             // Nao abrir em nova aba
    },
  }),
];
```

**Beneficio:** O usuario VE os links no editor apos colar. Cada "Art. 1o", "I -", "Paragrafo unico" aparece como link clicavel, dando **conferencia visual** de que os links foram preservados.

### 3.3 Componente C: Paste Interceptor

**Arquivo novo:** `src/lib/lei-paste-interceptor.ts`

**Responsabilidade:** Interceptar o evento de paste ANTES do TipTap processar, extrair o HTML raw do clipboard, e parsear metadados estruturados.

```typescript
interface PasteExtractionResult {
  devices: PastedDevice[];
  hierarchy: PastedHierarchyNode[];
  stats: {
    totalElements: number;
    linksFound: number;
    revokedFound: number;
    hierarchyFound: number;
    h6Found: number;
    idsFound: number;
  };
}

interface PastedDevice {
  text: string;           // Texto puro
  html: string;           // HTML interno
  href: string | null;    // Link do <a>
  slug: string | null;    // Slug extraido do href
  revoked: boolean;       // Tinha CSS class revoked?
  domId: string | null;   // ID do elemento (livro-i-10, etc.)
  tagName: string;        // P ou H6
  index: number;          // Posicao sequencial
}

interface PastedHierarchyNode {
  text: string;           // "TITULO I DAS PESSOAS NATURAIS"
  level: number;          // 0-5
  domId: string | null;   // "livro-i-10"
  index: number;          // Posicao no DOM
}
```

**Logica de interceptacao:**

```typescript
export function extractFromClipboardHtml(clipboardHtml: string): PasteExtractionResult {
  // 1. Parsear o HTML do clipboard com DOMParser
  const parser = new DOMParser();
  const doc = parser.parseFromString(clipboardHtml, 'text/html');

  // 2. Extrair todos os <p> e <h6>
  const elements = doc.querySelectorAll('p, h6');
  const devices: PastedDevice[] = [];
  const hierarchy: PastedHierarchyNode[] = [];

  elements.forEach((el, i) => {
    const text = el.textContent?.trim() || '';
    if (!text) return;

    const link = el.querySelector('a');
    const href = link?.getAttribute('href') || null;
    const slug = href?.match(/topicos\/\d+\/(.+)/)?.[1] || null;

    // Detectar revogado pela class (pode vir no HTML colado)
    const revoked = el.className?.includes('revoked') || false;

    // Detectar hierarquia
    const isHierarchy = text.match(/^(PARTE\s|LIVRO\s|TÍTULO\s|CAPÍTULO\s|Seção\s|Subseção\s)/i)
      || el.tagName === 'H6';

    const device: PastedDevice = {
      text, html: el.innerHTML, href, slug, revoked,
      domId: el.id || null,
      tagName: el.tagName,
      index: i,
    };
    devices.push(device);

    if (isHierarchy) {
      const level = text.match(/^PARTE/) ? 0 :
                    text.match(/^LIVRO/) ? 1 :
                    text.match(/^TÍTULO/i) ? 2 : el.tagName === 'H6' && text.match(/^TÍTULO/i) ? 2 :
                    text.match(/^CAPÍTULO/i) ? 3 :
                    text.match(/^Seção/i) ? 4 :
                    text.match(/^Subseção/i) ? 5 : 6;

      hierarchy.push({ text, level, domId: el.id || null, index: i });
    }
  });

  return {
    devices,
    hierarchy,
    stats: {
      totalElements: devices.length,
      linksFound: devices.filter(d => d.href).length,
      revokedFound: devices.filter(d => d.revoked).length,
      hierarchyFound: hierarchy.length,
      h6Found: devices.filter(d => d.tagName === 'H6').length,
      idsFound: devices.filter(d => d.domId).length,
    },
  };
}
```

**Integracao com o editor:**

```typescript
// Em lei-ingestao-editor.tsx, adicionar ao editorProps:
editorProps: {
  handlePaste: (view, event) => {
    // Capturar HTML raw ANTES do TipTap processar
    const clipboardHtml = event.clipboardData?.getData('text/html');

    if (clipboardHtml) {
      // Extrair metadados estruturados
      const extraction = extractFromClipboardHtml(clipboardHtml);

      // Salvar em state/context para o parser usar depois
      onPasteExtraction?.(extraction);

      // Log para conferencia
      console.log(`Paste: ${extraction.stats.totalElements} elementos, ` +
        `${extraction.stats.linksFound} links, ` +
        `${extraction.stats.hierarchyFound} hierarquia`);
    }

    // Retornar false para deixar o TipTap processar normalmente
    // (a extensao Link vai preservar os <a href>)
    return false;
  },
}
```

### 3.4 O que o HTML do Clipboard Preserva?

Quando o usuario seleciona e copia do JusBrasil, o clipboard contem HTML rico. Testes indicam que browsers preservam:

| Elemento | Preservado no clipboard? | Notas |
|---|---|---|
| `<a href>` | **Sim** | Links completos com URL |
| `<p>` | **Sim** | Cada dispositivo |
| `<h6>` | **Sim** | Hierarquia (TITULO, CAPITULO) |
| CSS class inline | **Parcial** | Depende do browser — `law-item_revoked` pode nao vir |
| `id` attribute | **Parcial** | Browsers podem descartar IDs ao copiar |
| Texto strikethrough | **Sim** | Dispositivos revogados tem `<s>` ou `text-decoration` |

**Nota importante:** O clipboard HTML nao e garantido ser identico ao DOM. Browsers podem simplificar o HTML ao copiar. O paste interceptor deve ser **tolerante** e tratar campos como `domId` e `revoked` como opcionais. Quando nao disponiveis via clipboard, o parser usa regex como fallback.

### 3.5 Fallback para Dados Perdidos no Clipboard

| Dado | Fonte primaria (clipboard) | Fallback |
|---|---|---|
| Tipo do dispositivo | `<a href>` slug | Regex no texto |
| Hierarquia | `<h6>` tag + `id` attribute | Regex (PARTE, LIVRO, TITULO...) |
| Revogado | CSS class `revoked` ou `<s>` tag | Regex no texto ("Revogado") |
| Posicao/ordem | Indice sequencial no HTML | Ordem de aparicao no TipTap |
| Descricoes de hierarquia | `<p>` apos elemento de hierarquia | Heuristica (ALL CAPS ou "Da/Das/Do/Dos") |

## 4. Hierarquia: Sumario Manual (Opcional)

No pipeline Playwright, o Sumario do JusBrasil e extraido automaticamente (396 nos com arvore completa). No copy/paste, o usuario teria que copiar o Sumario separadamente.

**Opcao A — Sumario automatico (recomendado):**
O wizard de importacao tem um step "Hierarquia" onde o usuario:
1. Abre o Sumario no JusBrasil (botao "Sumario")
2. Seleciona todo o conteudo do Sumario e copia
3. Cola num campo separado no wizard
4. Parser extrai a arvore hierarquica dos links do Sumario

**Opcao B — Hierarquia inferida:**
O parser constroi a hierarquia a partir dos `<h6>` e `<p>` de hierarquia capturados pelo paste interceptor. Menos confiavel que o Sumario, mas funciona como fallback.

**Opcao C — Sem hierarquia separada:**
O parser existente (`lei-parser.ts`) ja reconstroi hierarquia por regex. Manter como fallback final.

**Recomendacao:** Opcao A com fallback para C. Se o clipboard preservar os `<h6>` e IDs, a Opcao B funciona automaticamente sem passo extra.

## 5. Fluxo do Usuario

### 5.1 Ingestao via Copy/Paste

```
Step 1: Fonte
  - Usuario abre JusBrasil no browser
  - Seleciona toda a lei (Ctrl+A no corpo da lei)
  - Copia (Ctrl+C)

Step 2: Colar
  - Usuario abre o wizard de importacao (ImportLeiV2Page)
  - Preenche metadados (nome, numero, sigla da lei)
  - Cola no editor (Ctrl+V)
  - [Bastidores] Paste interceptor captura HTML raw
  - [Bastidores] Link extension preserva links no TipTap
  - Editor mostra texto com links azuis (conferencia visual)
  - Status bar mostra: "2.155 elementos, 1.890 links, 396 hierarquia"

Step 3: Hierarquia (opcional)
  - Se o interceptor nao capturou hierarquia suficiente:
  - Usuario abre Sumario no JusBrasil, copia, cola num campo separado
  - Parser extrai arvore hierarquica

Step 4: Validacao
  - Parser classifica dispositivos (links primario, regex fallback)
  - Regex separa anotacoes
  - Validacao automatica roda (contagem, gaps, residuais)
  - Cross-check com Planalto
  - Relatorio verde/amarelo/vermelho
  - Usuario revisa flagados

Step 5: Salvar
  - Usuario aprova -> upsert no Supabase
```

### 5.2 Comparacao: Copy/Paste vs Playwright

| Aspecto | Copy/Paste | Playwright |
|---|---|---|
| Setup | Zero (browser ja aberto) | Instalar Playwright + binarios |
| Velocidade | Manual (1-3 min por lei) | Automatico (~30s por lei) |
| Links preservados | Sim (clipboard HTML) | Sim (DOM direto) |
| CSS classes | Parcial (browser pode simplificar) | Completo |
| IDs de hierarquia | Parcial | Completo |
| Sumario | Passo manual extra | Automatico |
| Conferencia visual | Sim (ve no editor) | Nao (JSON) |
| Escala para 200 leis | Doloroso | Viavel |
| Confiabilidade | Alta (humano valida) | Alta (validacao automatica) |

## 6. Estrutura de Arquivos

### 6.1 Novos Arquivos

```
src/lib/
  lei-paste-interceptor.ts    # Extrai metadados do HTML do clipboard
```

### 6.2 Arquivos Modificados

```
src/components/lei-seca/
  lei-ingestao-editor.tsx      # Adicionar Link extension + handlePaste
src/views/
  ImportLeiV2Page.tsx           # Novo state para paste extraction + step hierarquia
```

### 6.3 Arquivos Compartilhados (sem mudanca)

Estes arquivos sao usados por AMBOS os pipelines:

```
src/lib/
  lei-parser-v2.ts             # Parser inteligente (links + regex)
  lei-validator.ts             # Validacao automatica
  lei-annotation-regex.ts      # Regex expandido de anotacoes
  lei-to-plate.ts              # Conversao para Plate.js (usa texto_limpo)
```

## 7. Riscos e Mitigacoes

| Risco | Impacto | Mitigacao |
|---|---|---|
| Browser simplifica HTML ao copiar | Links OK, mas IDs e classes podem sumir | Fallback regex funciona sem eles |
| Usuario copia parcialmente | Lei incompleta | Validacao de contagem sequencial detecta gaps |
| TipTap strip links mesmo com extensao | Perde classificacao por link | Paste interceptor captura ANTES do TipTap |
| Copy de area errada (header, footer) | Lixo no inicio/fim | Parser ignora preambulo e detecta fim da lei |
| Lei muito grande trava o editor | UX ruim ao colar CC com 4.880 dispositivos | Medir performance; se necessario, processar fora do TipTap |

## 8. Fora de Escopo

- **Drag & drop de arquivo HTML** — Possivel extensao futura, usuario salva pagina e arrasta
- **Extensao de browser** — Botao "Enviar para Meta" no JusBrasil seria ideal mas overengineering
- **OCR / PDF** — Fora do escopo de copy/paste
