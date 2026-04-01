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

O TipTap transforma o HTML ao colar — descarta links, CSS classes, IDs e tags `<h6>`. Testamos o clipboard HTML num `contenteditable div` simples e tudo foi preservado (links, h6, IDs, classes). Mas no TipTap nao ha garantia.

## 3. Solucao: Paste Interceptor + TipTap como Preview Editavel

### 3.1 Visao Geral

```
Usuario copia lei inteira do JusBrasil (Ctrl+C)
  -> Cola no editor de ingestao (Ctrl+V)
  -> handlePaste intercepta ANTES do TipTap:
     -> Captura clipboardData.getData('text/html')
     -> Extrai: links, CSS classes, IDs, tags h6
     -> Salva HTML raw em state (dados para o parser)
  -> TipTap renderiza o conteudo normalmente (preview editavel)
  -> Usuario corrige formatacao se necessario (bold, indent, roles)
  -> Na hora de parsear:
     -> HTML raw do clipboard = fonte primaria (links, hierarquia, revogados)
     -> TipTap JSON = correcoes manuais do usuario (roles, indent, formatacao)
  -> Playwright extrai Sumario automaticamente (hierarquia completa)
  -> Validacao automatica
  -> Supabase
```

**Principio:** O TipTap continua como **editor de preview e correcao**. O parser usa o **HTML raw do clipboard** para dados estruturados (links, h6, IDs, classes). As correcoes manuais do usuario no TipTap (roles, indent) sao mergeadas depois.

### 3.2 Paste Interceptor

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

    // Retornar false para deixar o TipTap renderizar normalmente
    // TipTap funciona como PREVIEW EDITAVEL — usuario ve e corrige
    // Os dados estruturados vem do HTML raw capturado acima
    return false;
  },
}
```

### 3.3 Papel do TipTap: Preview Editavel

O TipTap **continua no editor de ingestao** com papel de preview editavel. Parser le **HTML raw** do clipboard (primario) e TipTap JSON para correcoes manuais (secundario). Adicionar extensao Link para conferencia visual (links clicaveis no preview).

### 3.4 Links de Dispositivo vs Links de Referencia

No JusBrasil existem dois tipos de links dentro de cada `<p>`:

1. **Link do dispositivo** (identifica O dispositivo): `<a href="/topicos/...">Art. 1o</a>`
2. **Link de referencia** (aponta para OUTRO dispositivo ou lei): `"nos termos do <a href="/topicos/...">art. 5o</a>"`

**Dados reais testados (Codigo Civil): 4.089 device links, 457 ref links, 0 falsos positivos.**

**Regra para o parser:**

```typescript
function extractLinks(element: Element): {
  deviceLink: string | null;
  referenceLinks: ReferenceLink[];
} {
  const links = element.querySelectorAll('a');
  let deviceLink: string | null = null;
  const referenceLinks: ReferenceLink[] = [];

  for (const a of links) {
    const href = a.getAttribute('href') || '';
    const text = a.textContent?.trim() || '';

    // Link do dispositivo: primeiro <a> com /topicos/ cujo texto match padrao
    if (!deviceLink && href.includes('/topicos/') &&
        text.match(/^(Art\.?\s|§\s|Parágrafo|[IVXLCDM]+\s*[-–—]|[a-z]\))/i)) {
      deviceLink = href;
      continue;
    }

    // Demais links: guardar como referencia (para linkagem futura entre leis)
    if (href.includes('/topicos/') || href.includes('/legislacao/')) {
      referenceLinks.push({
        text,
        href,
        type: href.includes('/legislacao/') ? 'legislacao' : 'topico'
      });
    }
  }

  return { deviceLink, referenceLinks };
}
```

**Os links de referencia NAO sao descartados.** Sao armazenados como metadata do dispositivo para uso futuro: linkagem interna entre leis no sistema (ex: "art. 5o da CF/88" clicavel abrindo direto na lei seca correspondente).

### 3.5 O que o HTML do Clipboard Preserva?

Quando o usuario seleciona e copia do JusBrasil, o clipboard contem HTML rico. Testes indicam que browsers preservam:

| Elemento | Preservado no clipboard? | Notas |
|---|---|---|
| `<a href>` | **Sim** | Links completos com URL |
| `<p>` | **Sim** | Cada dispositivo |
| `<h6>` | **Sim** | Hierarquia (TITULO, CAPITULO) |
| CSS class inline | **Sim** | `law-item_revoked`, `heading_sizexl`, `heading_sizelg` preservadas |
| `id` attribute | **Sim** | `capitulo-i-14`, `art.-1o-16`, etc. preservados |
| Texto strikethrough | **Sim** | Dispositivos revogados tem `<s>` ou `text-decoration` |

**Testado em Chrome (Windows 10, marco 2026).** O clipboard HTML preservou TUDO: links (27), h6 (2), IDs (8), CSS classes (10), inclusive `law-item_revoked`. Resultado melhor que o esperado.

**Nota:** Outros browsers (Firefox, Edge) podem se comportar diferente. O paste interceptor deve ser **tolerante** e tratar campos como `domId` e `revoked` como opcionais com fallback regex.

### 3.5 Fallback para Dados Perdidos no Clipboard

| Dado | Fonte primaria (clipboard) | Fallback |
|---|---|---|
| Tipo do dispositivo | `<a href>` slug | Regex no texto |
| Hierarquia | `<h6>` tag + `id` attribute | Regex (PARTE, LIVRO, TITULO...) |
| Revogado | CSS class `revoked` ou `<s>` tag | Regex no texto ("Revogado") |
| Posicao/ordem | Indice sequencial no HTML | Ordem de aparicao no TipTap |
| Descricoes de hierarquia | `<p>` apos elemento de hierarquia | Heuristica (ALL CAPS ou "Da/Das/Do/Dos") |

## 4. Hierarquia: Playwright Extrai o Sumario Automaticamente

### 4.1 Problema Testado

O Sumario do JusBrasil e um componente tree-view (Radix UI) que **nao serializa corretamente para o clipboard**. Mesmo com todos os nos expandidos, o copy/paste captura apenas ~10 dos 733 nos. O tree-view usa lazy rendering que nao vai pro clipboard.

### 4.2 Solucao: Playwright so para o Sumario

O pipeline copy/paste usa Playwright **exclusivamente** para extrair o Sumario. O usuario cola o corpo da lei manualmente; o Playwright faz apenas uma chamada leve para a mesma URL e extrai a arvore hierarquica.

**Testado com sucesso.** Exemplo real (Codigo Civil): 1.065 nos extraidos (31 livros, 39 titulos, 529 capitulos, 451 secoes, 15 subsecoes). Cada lei tera quantidade diferente conforme sua estrutura.

**Logica de extracao do Sumario:**

```typescript
async function extractTocFromJusBrasil(page: Page): Promise<TocNode[]> {
  // 1. Clicar no botao Sumario
  const sumBtn = await page.$('button:has-text("Sumário")');
  await sumBtn?.click();
  await page.waitForTimeout(500);

  // 2. Expandir TODOS os nos usando MutationObserver
  // Radix renderiza filhos assincronamente — MutationObserver reage
  // instantaneamente a cada insercao. Termina apos 500ms sem mutacoes.
  // Nao gera requisicoes HTTP — roda no DOM local ja carregado.
  await page.evaluate(() => {
    return new Promise((resolve) => {
      let total = 0;
      let timeout;

      function expandVisible() {
        const collapsed = document.querySelectorAll('button[aria-expanded="false"]');
        for (const btn of collapsed) { btn.click(); total++; }
        clearTimeout(timeout);
        timeout = setTimeout(() => { observer.disconnect(); resolve(total); }, 500);
      }

      const observer = new MutationObserver(() => expandVisible());
      observer.observe(document.body, { childList: true, subtree: true });
      expandVisible();
    });
  });

  // 3. Extrair todos os links com ancora (todos visiveis agora)
  return page.evaluate(() => {
    const links = document.querySelectorAll('a[href*="#"]');
    const toc = [];
    for (const a of links) {
      const text = a.textContent?.trim();
      const href = a.getAttribute('href') || '';
      if (!text || !href.includes('#')) continue;
      if (!text.match(/^(LIVRO|TÍTULO|CAPÍTULO|Seção|Subseção|PARTE|DISPOSIÇÕES)/i)) continue;

      const anchor = href.split('#')[1];
      const level = text.match(/^PARTE/) ? 0 :
                    text.match(/^LIVRO/) ? 1 :
                    text.match(/^TÍTULO/i) ? 2 :
                    text.match(/^CAPÍTULO/i) ? 3 :
                    text.match(/^Seção/i) ? 4 :
                    text.match(/^Subseção/i) ? 5 : 6;
      toc.push({ text, anchor, level, children: [] });
    }
    return toc;
  });
}
```

### 4.3 Risco: Bloqueio do Playwright pelo JusBrasil

O JusBrasil ja bloqueia HTTP direto (403). O Playwright usa browser real, entao hoje passa. Mas podem adicionar deteccao de automacao.

**Mitigacoes:**
- `playwright.launch({ headless: false })` — browser visivel, dificil de detectar
- User-agent real do Chrome instalado
- Delays humanos (`waitForTimeout`) entre acoes
- Acesso leve: 1 pagina, 1 vez por lei, so pro Sumario

**Se for bloqueado — fallback em cascata:**
1. **Fallback A:** Hierarquia dos `<h6>` + `<p>` do corpo colado (testado, funciona, perde descricoes de nivel superior)
2. **Fallback B:** Parser regex reconstroi hierarquia pelo texto (parser existente, `lei-parser.ts`)
3. **Fallback C:** Usuario informa hierarquia manualmente no wizard

Na pratica, mesmo sem Sumario a lei funciona — a hierarquia fica menos completa mas os dispositivos sao os mesmos.

## 5. Fluxo do Usuario

### 5.1 Ingestao via Copy/Paste Hibrido

```
Step 1: Colar o corpo da lei (MANUAL)
  - Usuario abre JusBrasil no browser
  - Seleciona toda a lei (Ctrl+A no corpo da lei)
  - Copia (Ctrl+C)
  - Abre wizard de importacao, preenche metadados (nome, numero, sigla, URL)
  - Cola no editor (Ctrl+V)
  - [Bastidores] Paste interceptor captura HTML raw (links, h6, IDs, classes)
  - [Bastidores] Link extension preserva links no TipTap
  - Editor mostra texto com links azuis (conferencia visual)
  - Status bar: "2.155 elementos, 1.890 links, 8 h6, 315 revogados"

Step 2: Extrair hierarquia (AUTOMATICO)
  - Wizard usa a URL informada no Step 1
  - Playwright abre a URL, clica Sumario, expande tudo
  - Extrai arvore hierarquica (733 nos do Codigo Civil)
  - Se Playwright falhar: fallback para h6/p do corpo colado
  - Status bar: "733 nos de hierarquia extraidos"

Step 3: Validacao (AUTOMATICO)
  - Parser classifica dispositivos (links primario, regex fallback)
  - Cruza dispositivos com hierarquia do Sumario
  - Regex separa anotacoes
  - Validacao: contagem, gaps, residuais
  - Cross-check com Planalto
  - Relatorio verde/amarelo/vermelho
  - Usuario revisa flagados

Step 4: Salvar
  - Usuario aprova -> upsert no Supabase
```

### 5.2 Comparacao: Copy/Paste Hibrido vs Playwright Puro

| Aspecto | Copy/Paste Hibrido | Playwright Puro |
|---|---|---|
| Setup | Playwright so pra Sumario | Playwright pra tudo |
| Corpo da lei | Manual (cola no editor) | Automatico (extrai DOM) |
| Hierarquia | Playwright extrai Sumario | Playwright extrai Sumario |
| Links preservados | Sim (testado Chrome) | Sim (DOM direto) |
| CSS classes | Sim (testado Chrome) | Sim |
| IDs de hierarquia | Sim (testado Chrome) | Sim |
| Conferencia visual | Sim (ve no editor) | Nao (JSON) |
| Velocidade | ~2 min (cola + Playwright Sumario) | ~30s (tudo automatico) |
| Escala para 200 leis | Viavel mas lento | Ideal |
| Se JusBrasil bloquear Playwright | Fallback: h6/p do corpo colado | Pipeline inteiro quebra |

## 6. Estrutura de Arquivos

### 6.1 Novos Arquivos

```
src/lib/
  lei-paste-interceptor.ts    # Extrai metadados do HTML do clipboard
scripts/
  lei-toc-extractor.ts        # Playwright — extrai APENAS o Sumario do JusBrasil
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
| Browser simplifica HTML ao copiar | Testado Chrome: preserva tudo. Outros browsers podem variar | Fallback regex funciona sem eles |
| Usuario copia parcialmente | Lei incompleta | Validacao de contagem sequencial detecta gaps |
| TipTap strip links mesmo com extensao | Perde classificacao por link | Paste interceptor captura ANTES do TipTap |
| Copy de area errada (header, footer) | Lixo no inicio/fim | Parser ignora preambulo e detecta fim da lei |
| Lei muito grande trava o editor | UX ruim ao colar CC com 4.880 dispositivos | Medir performance; se necessario, processar fora do TipTap |
| JusBrasil bloqueia Playwright | Perde extracao do Sumario | Fallback: h6/p do corpo colado; headless:false + delays humanos; acesso leve (1 pagina/lei) |

## 8. Fora de Escopo

- **Drag & drop de arquivo HTML** — Possivel extensao futura, usuario salva pagina e arrasta
- **Extensao de browser** — Botao "Enviar para Meta" no JusBrasil seria ideal mas overengineering
- **OCR / PDF** — Fora do escopo de copy/paste
