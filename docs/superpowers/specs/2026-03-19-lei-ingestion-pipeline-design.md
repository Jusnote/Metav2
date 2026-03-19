# Design Spec: Pipeline de Ingestao de Leis v2

**Data:** 2026-03-19
**Status:** Draft
**Escopo:** Ingestao inicial de ~200 leis brasileiras com qualidade garantida

---

## 1. Problema

O pipeline atual de ingestao de leis apresenta tres problemas criticos:

1. **Anotacoes legislativas poluem o estudo da lei seca.** Textos como "(Redacao dada pela Lei n 13.968/2019)" aparecem inline durante o estudo, misturados com o texto legal. O regex atual (`RE_ANOTACAO` em `lei-parser.ts`) nao captura todos os padroes — faltam `(Regulamento)`, `(Producao de efeito)`, `(Promulgacao partes vetadas)`, entre outros.

2. **Copy/paste do Planalto perde toda estrutura.** Ao copiar texto puro, links, classes CSS e hierarquia DOM sao descartados. O parser precisa adivinhar via regex o que era um artigo, inciso ou anotacao.

3. **Validacao inexistente.** Com 2.000+ artigos por lei e 200 leis planejadas, nao existe verificacao automatica de que todos os dispositivos foram ingeridos corretamente. Inconsistencias como `Art 1.636` (sem ponto apos "Art") fazem dispositivos desaparecerem silenciosamente.

## 2. Decisoes de Design

| Decisao | Escolha | Alternativas Descartadas | Motivo |
|---|---|---|---|
| Fonte primaria | JusBrasil via Playwright | Planalto (HTML inconsistente), LexML (sem texto integral), copy/paste manual (nao escala) | Melhor estrutura DOM, consistente entre leis, cada dispositivo isolado em `<p>` |
| Classificacao de dispositivos | Link `<a href>` (primario) + regex (fallback) | Regex puro | Links codificam tipo e hierarquia com certeza; regex sozinho falha em edge cases como `Art 1.636` |
| Separacao de anotacoes | Regex expandido | LLM/Claude API | Regex e determinístico e auditavel; LLM pode ser fase 2 para casos ambiguos |
| Ambiente do extrator | CLI local (`npx tsx scripts/lei-extractor.ts`) | API route no Next.js, microservico | Playwright requer binarios de browser (~400MB), incompativel com Vercel serverless |
| Anotacoes no storage | Campo separado `anotacoes_legislativas` no artigo | Embeddado em `plate_content[].anotacoes` (atual) | Separacao limpa de camadas; display nao precisa filtrar |

## 3. Solucao Proposta

Pipeline de ingestao em 4 camadas usando JusBrasil como fonte primaria (ingestao inicial) com validacao cruzada contra o Planalto.

### 3.1 Visao Geral do Pipeline

```
[CLI local]
  Usuario roda: npx tsx scripts/lei-extractor.ts <url-jusbrasil>
    -> Playwright abre a pagina no browser (contorna bloqueio 403)
    -> Verifica DOM fingerprint (CSS classes esperadas, <p> com links)
    -> Extrai todos os <p> com seus <a href> + CSS classes
    -> Salva JSON intermediario: data/leis-raw/{sigla}.json

[Browser - ImportLeiV2Page]
  Usuario carrega o JSON intermediario no wizard de importacao
    -> Parser classifica cada dispositivo pelos links (tipo + hierarquia)
    -> Regex aprimorado separa anotacoes legislativas do texto
    -> Validacao automatica (contagem sequencial, gaps, residuais)
    -> Cross-check com Planalto (contagem de dispositivos por regex ^Art\.)
    -> Relatorio verde/amarelo/vermelho
    -> Usuario revisa apenas os itens flagados
    -> Upsert no Supabase via RPC upsert_lei_com_artigos() (atualizado)
```

**Nota de deploy:** O extrator Playwright roda apenas localmente (CLI). A aplicacao web nunca executa Playwright. O wizard de importacao no browser recebe o JSON ja extraido.

### 3.2 Justificativa da Fonte

Analise real do DOM do JusBrasil. Exemplo de referencia (Codigo Civil, Lei 10.406/02):

| Metrica | Valor |
|---|---|
| Artigos unicos | 2.095 (inclui versoes revogadas) |
| Artigos vigentes | 2.016 |
| Artigos revogados | 123 (marcados com CSS `law-item_revoked`) |
| Maior numero de artigo | 2.046 (completo, zero gaps reais) |
| Dispositivos totais (`<p>` + `<h6>`) | 4.880 |
| Nos hierarquicos no Sumario | 1.065 |

**Nota:** Estes numeros sao do Codigo Civil como referencia. Cada lei tera valores diferentes — leis menores terao dezenas de artigos e poucos nos hierarquicos.

**Vantagens do JusBrasil sobre o Planalto:**
- Cada dispositivo e um `<p>` isolado no DOM
- HTML consistente entre diferentes leis (mesmo padrao)
- Cada dispositivo tem um `<a href>` com identificador unico e hierarquia codificada na URL
- Dispositivos revogados marcados com CSS class `law-item_revoked`
- Pagina carrega todos os artigos de uma vez (sem paginacao)
- Hierarquia (LIVRO, TITULO, CAPITULO) usa `<h6>` com CSS classes por nivel (`heading_sizexl`, `heading_sizelg`)
- Cada elemento de hierarquia tem `id` unico com posicao DOM (ex: `livro-i-10`, `capitulo-i-4726`)
- Sumario lateral tem arvore hierarquica completa, extraivel via Playwright

**Testado com sucesso.** Exemplo real (Codigo Civil): 1.065 nos hierarquicos extraidos. Cada lei tera quantidade diferente conforme sua estrutura — leis menores podem ter apenas dezenas de nos.

**Nota critica:** O Sumario usa Radix UI tree-view que renderiza filhos **assincronamente**. Copy/paste do Sumario NAO funciona (lazy render). A extracao usa MutationObserver para garantir expansao integral — reage a cada insercao de novo no no DOM e so termina apos 500ms sem mutacoes.

**Limitacoes conhecidas:**
- Anotacoes legislativas sao texto inline (mesmo problema do Planalto — regex necessario)
- Micro-inconsistencias de formatacao existem (ex: `Art 1.636` sem ponto)
- Fonte privada, sem SLA — adequada para ingestao inicial, nao para dependencia continua

## 4. Arquitetura Detalhada

### 4.1 Camada 1: Extracao (Playwright — CLI local)

**Arquivo:** `scripts/lei-extractor.ts` (novo)

**Responsabilidade:** Abrir URL do JusBrasil via Playwright, aguardar carregamento completo, extrair todos os elementos `<p>` com metadados.

**Input:** URL do JusBrasil (ex: `https://www.jusbrasil.com.br/legislacao/91577/codigo-civil-lei-10406-02`)

**Output:** Objeto `RawLeiExtraction`:

```typescript
interface RawDevice {
  text: string;           // Texto puro do dispositivo
  html: string;           // HTML interno do <p> ou <h6>
  href: string | null;    // URL do link (ex: /topicos/10620194/artigo-1636-da-lei...)
  slug: string | null;    // Slug extraido do href
  revoked: boolean;       // CSS class law-item_revoked
  domId: string | null;   // ID do elemento (ex: "livro-i-10", "capitulo-i-4726")
  tagName: string;        // "P" ou "H6"
  index: number;          // Indice sequencial no DOM
}

interface TocNode {
  text: string;           // "LIVRO I DAS PESSOAS"
  anchor: string;         // "livroi"
  level: number;          // 1=livro, 2=titulo, 3=capitulo, 4=secao, 5=subsecao
  children: TocNode[];    // Sub-nos (arvore completa)
}

interface RawLeiExtraction {
  metadata: LeiMetadata;
  devices: RawDevice[];   // Todos os <p> e <h6> do corpo da lei
  toc: TocNode[];         // Arvore hierarquica extraida do Sumario
  stats: {
    totalDevices: number;
    totalArticles: number;
    totalRevoked: number;
    totalHierarchy: number;
    totalTocNodes: number;
  };
}
```

**Logica de extracao (dispositivos + hierarquia):**

```typescript
// Pseudocodigo
const page = await browser.newPage();
await page.goto(url, { waitUntil: 'networkidle' });

// Aguardar carregamento completo — verificar que ultimo artigo existe
await page.waitForFunction(() => {
  const ps = document.querySelectorAll('p');
  return ps.length > 100; // pagina carregou conteudo
});

// Extrair scroll height para garantir que tudo renderizou
const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
// Se necessario, scroll incremental para trigger lazy loading

// Extrair todos os <p> E <h6> (hierarquia usa h6) com metadados
const devices = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('p, h6')).map((el, i) => {
    const link = el.querySelector('a');
    return {
      text: el.textContent?.trim() || '',
      html: el.innerHTML,
      href: link?.href || null,
      slug: link?.href?.match(/topicos\/\d+\/(.+)/)?.[1] || null,
      revoked: el.className?.includes('revoked') || false,
      domId: el.id || null,        // "livro-i-10", "capitulo-i-4726", etc.
      tagName: el.tagName,          // "P" ou "H6"
      index: i,
    };
  }).filter(d => d.text.length > 0);
});

// Extrair arvore hierarquica do Sumario (botao "Sumario")
// Testado: Codigo Civil = 1.065 nos extraidos
//
// IMPORTANTE: O Sumario usa um tree-view Radix UI com nos colapsados.
// Radix renderiza filhos ASSINCRONAMENTE apos expandir o pai.
// Copy/paste do Sumario NAO funciona (lazy render nao serializa).
// Solucao: MutationObserver reage a cada insercao de novos nos.

// Step 1: Abrir o painel do Sumario
const sumBtn = await page.$('button:has-text("Sumário")');
await sumBtn?.click();
await page.waitForTimeout(500);

// Step 2: Expandir TODOS os nos usando MutationObserver
// MutationObserver e nao-bloqueante e reage instantaneamente quando
// o Radix insere novos filhos no DOM. Nao faz polling — escuta o DOM.
// Termina quando 500ms passam sem nenhuma mutacao (certeza de que acabou).
// Nao gera requisicoes HTTP — roda inteiramente no DOM local ja carregado.
const totalExpanded = await page.evaluate(() => {
  return new Promise((resolve) => {
    let total = 0;
    let timeout;

    function expandVisible() {
      const collapsed = document.querySelectorAll('button[aria-expanded="false"]');
      for (const btn of collapsed) { btn.click(); total++; }

      // Reset timer — se nada mudar em 500ms, acabou
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        observer.disconnect();
        resolve(total);
      }, 500);
    }

    // Observa mudancas no DOM (Radix inserindo filhos)
    const observer = new MutationObserver(() => expandVisible());
    observer.observe(document.body, { childList: true, subtree: true });

    // Primeiro disparo
    expandVisible();
  });
});

// Step 3: Extrair todos os links com ancora (agora todos visiveis)
const toc = await page.evaluate(() => {
  const links = document.querySelectorAll('a[href*="#"]');
  const nodes = [];
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

    nodes.push({ text, anchor, level, children: [] });
  }
  return nodes;
});
```

**Hierarquia no DOM do JusBrasil:**

| Nivel | Tag HTML | CSS class | ID pattern | Exemplo |
|---|---|---|---|---|
| PARTE | `<p>` | (none) | `parte-geral-{pos}` | PARTE GERAL |
| LIVRO | `<p>` | (none) | `livro-i-{pos}` | LIVRO I |
| TITULO | `<h6>` | `heading_sizexl` | `tituloi` | TITULO I |
| CAPITULO | `<h6>` | `heading_sizelg` | `capituloi...` | CAPITULO I |
| Secao | `<p>` | (none) | (none) | Secao I |
| Subsecao | `<p>` | (none) | (none) | Subsecao I |
| Descricao | `<p>` | (none) | (none) | DAS PESSOAS NATURAIS |

**O numero no ID (ex: `livro-i-10`) e a posicao do elemento no DOM.** Isso permite ordenacao deterministica e cruzamento com dispositivos por posicao.

**Metadados da lei** (extraidos do titulo da pagina):

```typescript
interface LeiMetadata {
  nome: string;       // "Codigo Civil"
  tipo: string;       // "LEI"
  numero: string;     // "10.406"
  data: string;       // "2002-01-10"
  sigla: string;      // "cc-2002" (derivado)
  urlFonte: string;   // URL do JusBrasil
}
```

### 4.2 Camada 2: Parser Inteligente

**Arquivo:** `src/lib/lei-parser-v2.ts` (novo — coexiste com o parser atual)

**Responsabilidade:** Classificar cada `RawDevice` em tipo, numero, hierarquia. Separar anotacoes do texto.

#### 4.2.1 Classificacao por Link (primaria)

O `<a href>` do JusBrasil codifica o tipo e hierarquia na URL:

```
/topicos/10620194/artigo-1636-da-lei-n-10406-de-10-de-janeiro-de-2002
         ^ID       ^tipo  ^num  ^contexto
```

**Padroes de URL por tipo de dispositivo:**

| Tipo | Padrao na URL |
|---|---|
| Artigo | `artigo-{N}` |
| Paragrafo | `paragrafo-{N}-do-artigo-{N}` |
| Paragrafo unico | `paragrafo-unico-do-artigo-{N}` |
| Inciso | `inciso-{romano}-do-artigo-{N}` |
| Alinea | `alinea-{letra}-do-artigo-{N}` |

```typescript
function classifyByLink(slug: string): DeviceClassification | null {
  if (!slug) return null;

  const patterns = [
    { regex: /^artigo-(\d+[a-z]?)/, tipo: 'artigo' as const },
    { regex: /^paragrafo-unico/, tipo: 'paragrafo_unico' as const },
    { regex: /^paragrafo-(\d+)/, tipo: 'paragrafo' as const },
    { regex: /^inciso-([ivxlcdm]+)/, tipo: 'inciso' as const },
    { regex: /^alinea-([a-z])/, tipo: 'alinea' as const },
    { regex: /^item-(\d+)/, tipo: 'item' as const },
  ];

  for (const { regex, tipo } of patterns) {
    const match = slug.match(regex);
    if (match) {
      return { tipo, numero: match[1] || '', slug };
    }
  }
  return null;
}
```

#### 4.2.2 Classificacao por Regex (fallback)

Para elementos sem `<a href>` (hierarquia, pena, epigrafe) ou quando o link nao segue o padrao esperado:

```typescript
// Regex tolerante — ponto opcional apos "Art"
const RE_ARTIGO = /^\s*Art\.?\s+(\d+(?:\.\d+)*[o°]?(?:-[A-Za-z]+)?)\s*[.\-–—]?\s*(.*)/i;
```

**Regra:** Link tem prioridade. Regex so e usado quando o link nao resolve o tipo.

#### 4.2.3 Separacao de Anotacoes

**Regex expandido** que cobre todos os padroes encontrados no Planalto e JusBrasil:

```typescript
const RE_ANOTACAO_V2 = /\((?:Reda[çc][ãa]o\s+dad|Inclu[ií]d|Revogad|Vide\s|Vig[eê]ncia|Acrescid|Alterad|VETAD|Suprimi|Renumerad|Regulamento|Regulamenta[çc][ãa]o|Produ[çc][ãa]o\s+de\s+efeito|Promulga[çc][ãa]o|Texto\s+compilad|Convers[ãa]o\s+d|Declara[çc][ãa]o|Declarad|Norma\s+anterior|Publicação\s+original|Mensagem\s+de\s+veto|Refer[eê]ncia)[^)]*\)/gi;
```

**Processo de separacao:**

```typescript
function separateAnnotations(text: string): {
  textoLimpo: string;
  anotacoes: string[];
  textoOriginal: string;
} {
  const textoOriginal = text;
  const anotacoes: string[] = [];

  let textoLimpo = text.replace(RE_ANOTACAO_V2, (match) => {
    anotacoes.push(match.trim());
    return '';
  });

  // Limpar espacos duplos e trailing
  textoLimpo = textoLimpo.replace(/\s{2,}/g, ' ').trim();

  // Remover trailing pontuacao solta (apos remover anotacao)
  textoLimpo = textoLimpo.replace(/\s*[,;]\s*$/, '').trim();

  return { textoLimpo, anotacoes, textoOriginal };
}
```

#### 4.2.4 Classificacao de Hierarquia

Elementos sem link que representam a estrutura da lei:

```typescript
const HIERARCHY_PATTERNS = [
  { regex: /^\s*PARTE\s+(GERAL|ESPECIAL|PRELIMINAR|COMPLEMENTAR|[IVXLCDM]+)/i, tipo: 'parte' },
  { regex: /^\s*LIVRO\s+([IVXLCDM]+|[UÚ]NICO|COMPLEMENTAR)/i, tipo: 'livro' },
  { regex: /^\s*T[IÍ]TULO\s+([IVXLCDM]+|[UÚ]NICO)/i, tipo: 'titulo' },
  { regex: /^\s*SUBT[IÍ]TULO\s+([IVXLCDM]+|[UÚ]NICO)/i, tipo: 'subtitulo' },
  { regex: /^\s*CAP[IÍ]TULO\s+([IVXLCDM]+(?:-[A-Z]+)?|[UÚ]NICO)/i, tipo: 'capitulo' },
  { regex: /^\s*Se[çc][ãa]o\s+([IVXLCDM]+|[UÚ]NICA)/i, tipo: 'secao' },
  { regex: /^\s*Subse[çc][ãa]o\s+([IVXLCDM]+|[UÚ]NICA)/i, tipo: 'subsecao' },
];
```

#### 4.2.5 Deteccao de Revogados

Tres fontes de informacao (qualquer uma confirma):

1. **CSS class** `law-item_revoked` do JusBrasil
2. **Texto** que contem apenas "(Revogado pela Lei...)" sem conteudo substantivo
3. **Elemento duplicado** — mesmo numero de artigo aparece 2x, o mais antigo e revogado

### 4.3 Camada 3: Validacao Automatica

**Arquivo:** `src/lib/lei-validator.ts` (novo)

**Responsabilidade:** Garantir integridade da ingestao antes de salvar no banco.

#### 4.3.1 Validacao Estrutural

```typescript
interface ValidationResult {
  status: 'green' | 'yellow' | 'red';
  score: number;        // 0-100
  checks: ValidationCheck[];
  flagged: FlaggedItem[];
}

interface ValidationCheck {
  name: string;
  passed: boolean;
  message: string;
  severity: 'error' | 'warning' | 'info';
}
```

**Checks implementados:**

| Check | Severidade | Descricao |
|---|---|---|
| `sequential_count` | error | Verifica que a sequencia de artigos nao tem gaps (1, 2, ..., N). Para artigos com sufixo (121-A), verifica que o base existe. |
| `empty_text` | error | Flagga dispositivos com `textoLimpo` vazio ou menor que 5 caracteres (exceto revogados). |
| `residual_annotations` | warning | Roda `RE_ANOTACAO_V2` no `textoLimpo` — se encontrar match, anotacao nao foi separada. |
| `parenthetical_scan` | warning | Busca qualquer `(...)` com mais de 20 caracteres no `textoLimpo` — potencial anotacao nao catalogada. |
| `duplicate_numbers` | warning | Artigos com mesmo numero — verifica que um e revogado e outro e vigente. Se ambos vigentes, flag. |
| `hierarchy_coverage` | info | Todo artigo deve ter pelo menos um nivel de hierarquia no path. |
| `link_classification` | info | % de dispositivos classificados por link vs regex. Abaixo de 80% indica problema na extracao. |

#### 4.3.2 Validacao Cruzada com Planalto

```typescript
async function crossValidateWithPlanalto(
  lei: ParsedLei,
  planaltoUrl: string
): Promise<CrossValidationResult> {
  // Fetch HTML do Planalto
  const html = await fetch(planaltoUrl).then(r => r.text());

  // Contar artigos no Planalto (regex ancorado em inicio de linha, multiline)
  // Remove anotacoes e TOC antes de contar para evitar falsos positivos
  const cleanHtml = html.replace(/<a[^>]*>.*?<\/a>/gi, ''); // remove links (anotacoes)
  const planaltoCount = (cleanHtml.match(/^\s*Art\.?\s+\d/gmi) || []).length;

  // Comparar contagem
  const diff = Math.abs(lei.artigos.length - planaltoCount);

  return {
    jbCount: lei.artigos.length,
    planaltoCount,
    diff,
    status: diff === 0 ? 'match' : diff < 5 ? 'close' : 'divergent',
  };
}
```

#### 4.3.3 Relatorio de Qualidade

Relatorio gerado apos cada ingestao:

```typescript
interface QualityReport {
  lei: string;
  timestamp: string;
  overallStatus: 'green' | 'yellow' | 'red';
  overallScore: number;
  stats: {
    totalDevices: number;
    articles: number;
    revokedArticles: number;
    classifiedByLink: number;   // % classificado por <a href>
    classifiedByRegex: number;  // % fallback regex
    annotationsExtracted: number;
    residualAnnotations: number;
  };
  validation: ValidationResult;
  crossValidation: CrossValidationResult | null;
  flaggedItems: FlaggedItem[];  // Itens pra revisao manual
}
```

**Criterios de status:**
- **Green:** Score >= 95, zero erros, cross-validation match
- **Yellow:** Score >= 80, warnings mas sem erros criticos
- **Red:** Score < 80, erros encontrados, ou cross-validation divergent

### 4.4 Camada 4: Storage (Supabase)

#### 4.4.1 Schema de Artigos (alteracoes)

Novos campos no `artigos` para suportar separacao de camadas:

```sql
-- Campos existentes mantidos (texto_plano, plate_content, etc.)

-- Novos campos para separacao de anotacoes
ALTER TABLE artigos ADD COLUMN IF NOT EXISTS
  texto_limpo TEXT;                    -- Texto sem NENHUMA anotacao (lei seca pura)

ALTER TABLE artigos ADD COLUMN IF NOT EXISTS
  anotacoes_legislativas JSONB DEFAULT '[]';  -- Array de anotacoes extraidas

ALTER TABLE artigos ADD COLUMN IF NOT EXISTS
  texto_original_fonte TEXT;           -- Texto bruto como veio da fonte

ALTER TABLE artigos ADD COLUMN IF NOT EXISTS
  fonte TEXT DEFAULT 'planalto';       -- 'jusbrasil' | 'planalto' | 'lexml'

ALTER TABLE artigos ADD COLUMN IF NOT EXISTS
  fonte_url TEXT;                      -- URL da fonte original

ALTER TABLE artigos ADD COLUMN IF NOT EXISTS
  qualidade_score SMALLINT;            -- 0-100, score de confianca do dispositivo

ALTER TABLE artigos ADD COLUMN IF NOT EXISTS
  flags JSONB DEFAULT '[]';            -- Flags de validacao pendentes
```

#### 4.4.2 Estrutura do plate_content (alteracao)

O `plate_content` passa a usar `texto_limpo` nos `children` (nao `texto_original`):

```jsonc
[
  {
    "type": "p",
    "children": [
      { "text": "Art. 121.", "bold": true },
      { "text": " Matar alguem:" }  // SEM anotacoes
    ],
    "slug": "artigo-121",
    "role": "artigo",
    "indent": 0
    // anotacoes NAO vao aqui — vao no campo anotacoes_legislativas do artigo
  }
]
```

#### 4.4.3 Estrutura das Anotacoes Legislativas

```jsonc
// Campo anotacoes_legislativas do artigo
[
  {
    "texto": "(Redacao dada pela Lei n 13.968, de 2019)",
    "tipo": "redacao",          // redacao | inclusao | revogacao | vide | vigencia | regulamento | outro
    "lei_referenciada": "13968/2019",
    "dispositivo_slug": "artigo-121"  // A qual dispositivo pertence
  },
  {
    "texto": "(Vigencia)",
    "tipo": "vigencia",
    "lei_referenciada": null,
    "dispositivo_slug": "artigo-121"
  }
]
```

### 4.5 UX: Camadas no Estudo da Lei Seca

#### 4.5.1 Renderizacao Padrao (Lei Seca Pura)

O editor TipTap renderiza apenas o `texto_limpo`. Nenhuma anotacao legislativa visivel.

#### 4.5.2 Indicador de Historico Legislativo

Dispositivos que possuem `anotacoes_legislativas.length > 0` exibem um indicador sutil:

- **Bolinha laranja** (8px) no canto direito do dispositivo
- Visivel mas nao intrusiva
- Hover mostra tooltip: "Este dispositivo foi alterado — clique para ver historico"

#### 4.5.3 Painel de Historico Legislativo (on-click)

Ao clicar no indicador ou no dispositivo:

```
+------------------------------------------------+
| Historico Legislativo                       [X] |
|                                                 |
| * Redacao dada pela Lei n 13.968, de 2019      |
| * Vigencia                                      |
|                                                 |
| Versao anterior: (se existir artigo revogado)   |
| "Art. 121. Matar alguem:..." (texto original)  |
+------------------------------------------------+
```

O painel abre **abaixo** do dispositivo (usando o sistema de annotation-slots existente em `annotation-slots-extension.ts`), reutilizando a mesma infraestrutura de portals React ja implementada.

#### 4.5.4 Toggle Global

Na toolbar da pagina de estudo, um toggle:

```
[Lei Seca]  [Lei Anotada]
```

- **Lei Seca** (padrao): texto limpo, indicadores de historico sutis
- **Lei Anotada**: mostra anotacoes inline como no Planalto (para quem preferir)

## 5. Glossario de Campos de Texto

Para evitar confusao entre campos similares:

| Campo | Conteudo | Uso |
|---|---|---|
| `texto_plano` | Texto completo COM anotacoes, normalizado | Full-text search (tsvector), busca |
| `texto_limpo` | Texto SEM anotacoes legislativas | **Display no estudo da lei seca** |
| `texto_original_fonte` | Texto bruto exatamente como veio da fonte | Auditoria, debug |
| `search_text` | Texto normalizado (lowercase, sem acentos) | Busca rapida (trigram) |
| `plate_content[].anotacoes` | **DEPRECADO** para novos imports | Retrocompatibilidade com imports antigos |
| `anotacoes_legislativas` | Array estruturado no nivel do artigo | Display da camada de historico |

**Migracao:** Imports antigos que tem `plate_content[].anotacoes` continuam funcionando. O editor verifica `anotacoes_legislativas` primeiro; se vazio, faz fallback para `plate_content[].anotacoes`. Novos imports nao escrevem em `plate_content[].anotacoes`.

## 6. Tipos TypeScript

```typescript
// src/types/lei-import.ts (adicoes)

interface LegislativeAnnotation {
  texto: string;
  tipo: 'redacao' | 'inclusao' | 'revogacao' | 'vide' | 'vigencia' |
        'regulamento' | 'producao_efeito' | 'veto' | 'outro';
  lei_referenciada: string | null;  // ex: "13968/2019"
  dispositivo_slug: string;
}

interface RawDevice {
  text: string;
  html: string;
  href: string | null;
  slug: string | null;
  revoked: boolean;
  index: number;
}

interface DeviceClassification {
  tipo: 'artigo' | 'paragrafo' | 'paragrafo_unico' | 'inciso' |
        'alinea' | 'item' | 'pena' | 'epigrafe' | 'hierarchy';
  numero: string;
  slug: string;
  method: 'link' | 'regex';  // como foi classificado
}

interface QualityReport {
  lei: string;
  timestamp: string;
  overallStatus: 'green' | 'yellow' | 'red';
  overallScore: number;
  stats: {
    totalDevices: number;
    articles: number;
    revokedArticles: number;
    classifiedByLink: number;
    classifiedByRegex: number;
    annotationsExtracted: number;
    residualAnnotations: number;
  };
  flaggedItems: FlaggedItem[];
}
```

**Nota:** Apos aplicar a migration SQL, regenerar tipos Supabase com `supabase gen types typescript` e verificar que os novos campos aparecem em `database.ts`.

## 7. Estrutura de Arquivos

### 7.1 Novos Arquivos

```
scripts/
  lei-extractor.ts          # Playwright — extrai HTML do JusBrasil

src/lib/
  lei-parser-v2.ts          # Parser inteligente (links + regex)
  lei-validator.ts          # Validacao automatica + cross-check
  lei-annotation-regex.ts   # Regex expandido de anotacoes (compartilhado)

src/components/lei-seca/
  lei-history-panel.tsx      # Painel de historico legislativo
  lei-history-indicator.tsx  # Bolinha indicadora de anotacoes
  lei-view-toggle.tsx        # Toggle Lei Seca / Lei Anotada
```

### 7.2 Arquivos Modificados

```
src/lib/lei-parser.ts              # Manter como fallback (sem breaking changes)
src/lib/lei-to-plate.ts            # Usar texto_limpo nos children
src/views/ImportLeiV2Page.tsx       # Novo step: validacao + relatorio
src/components/lei-seca/
  lei-seca-editor.tsx               # Integrar indicador + toggle
  annotation-slots-extension.ts     # Reutilizar para history panel
scripts/supabase-lei-seca-schema.sql # Novos campos
```

## 8. Fluxo do Usuario

### 8.1 Ingestao

1. Usuario roda CLI: `npx tsx scripts/lei-extractor.ts <url-jusbrasil>`
2. Playwright extrai HTML, salva JSON em `data/leis-raw/{sigla}.json`
3. Usuario acessa wizard de importacao, carrega o JSON
4. Tela de validacao mostra relatorio verde/amarelo/vermelho
5. Itens flagados sao exibidos para revisao manual
6. Usuario aprova → upsert no Supabase
7. Relatorio de qualidade salvo para auditoria

### 8.2 Estudo

1. Usuario abre lei seca normalmente (`/lei-seca/{leiId}`)
2. Ve texto limpo, sem anotacoes
3. Dispositivos alterados tem bolinha laranja sutil
4. Click na bolinha abre painel de historico legislativo
5. Toggle global permite alternar entre Lei Seca / Lei Anotada

## 9. DOM Fingerprint e Robustez

Antes de extrair, o Playwright verifica que a estrutura do JusBrasil nao mudou:

```typescript
async function verifyDomFingerprint(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const ps = document.querySelectorAll('p');
    const hasTopicLinks = Array.from(ps).some(p =>
      p.querySelector('a[href*="/topicos/"]')
    );
    const hasRevokedClass = !!document.querySelector('[class*="revoked"]') ||
      ps.length > 50; // lei sem revogados tambem e valida
    const hasReasonableCount = ps.length > 10;

    return hasTopicLinks && hasReasonableCount;
  });
}
```

Se o fingerprint falhar, o extrator **para e alerta** em vez de produzir dados incorretos.

## 10. Fora de Escopo (Fase 2)

- **Atualizacao automatica semanal** — comparacao com Planalto para detectar mudancas (sera sistema separado)
- **LexML como fonte** — API instavel, sem texto integral. Reavaliar quando melhorar.
- **Docling para PDFs** — Desnecessario para ingestao inicial via JusBrasil. Reavaliar se surgir necessidade de importar PDFs do DOU.
- **Import em batch** — Automacao de 200 URLs em sequencia. Primeiro validar o pipeline com 5-10 leis manuais.
