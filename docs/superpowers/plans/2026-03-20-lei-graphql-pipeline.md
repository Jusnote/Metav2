# Lei GraphQL Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ingest Brazilian laws from JusBrasil's GraphQL API — devices come pre-classified by type, eliminating DOM scraping and regex classification.

**Architecture:** User runs extraction script in browser console → copies JSON → pastes in wizard → mapper converts to our schema → regex separates annotations → validation → Supabase. Description rendered with annotations styled differently (gray/italic) instead of stripped. Toggle hides via CSS.

**Tech Stack:** TypeScript, Next.js, Supabase, TipTap (study view only), vanilla JS (extraction script)

**Spec:** `docs/superpowers/specs/2026-03-19-lei-graphql-pipeline-design.md` (local, not committed)

---

## File Structure

```
# NEW FILES
scripts/lei-graphql-extractor.js          # Vanilla JS script for browser console
src/lib/lei-graphql-mapper.ts             # Maps GraphQL items → our schema
src/lib/lei-nao-identificado.ts           # Sub-classifies NAO_IDENTIFICADO items
src/components/lei-seca/lei-anotacao-tooltip.tsx  # Tooltip for organized annotations
src/components/lei-seca/lei-view-toggle.tsx       # Lei Seca / Lei Anotada toggle

# MODIFIED FILES
src/types/lei-import.ts                   # Add GraphQL-specific interfaces
src/views/ImportLeiV2Page.tsx             # Add JSON paste input + validation step
src/lib/lei-to-plate.ts                   # Render annotations as styled spans
src/lib/lei-exporter.ts                   # Include new fields in payload
src/app/api/lei-upload/route.ts           # Accept new fields
src/components/lei-seca/lei-seca-editor.tsx  # Integrate toggle + tooltip
scripts/supabase-lei-seca-migration-v2.sql   # Add source_id, source_type, source_index columns
```

---

### Task 1: Add GraphQL Types + Update Migration

**Files:**
- Modify: `src/types/lei-import.ts`
- Modify: `scripts/supabase-lei-seca-migration-v2.sql`

- [ ] **Step 1: Add GraphQL item interfaces to lei-import.ts**

Add at the end of the file (after existing v2 types):

```typescript
// --- GraphQL Pipeline Types ---

export type GraphQLItemType =
  | 'ARTIGO' | 'PARAGRAFO' | 'INCISO' | 'ALINEA'
  | 'PARTE' | 'LIVRO' | 'TITULO' | 'CAPITULO' | 'SECAO' | 'SUBSECAO'
  | 'EMENTA' | 'PROTOCOLO' | 'DOU_PUBLICACAO' | 'TABELA'
  | 'NAO_IDENTIFICADO';

export interface GraphQLItem {
  codeInt64: number;
  type: GraphQLItemType;
  description: string;
  index: number;
}

export interface StructuralItem extends GraphQLItem {
  subtitle: string | null;
}

export interface LawDataExport {
  docId: number;
  extractedAt: string;
  allItems: GraphQLItem[];
  structural: StructuralItem[];
  stats: {
    totalItems: number;
    totalStructural: number;
    totalArticles: number;
  };
}

export type NaoIdentificadoSubType =
  | 'subtitulo' | 'pena' | 'epigrafe' | 'anotacao_standalone'
  | 'vide' | 'vigencia' | 'preambulo' | 'html_content' | 'nao_classificado';
```

- [ ] **Step 2: Add source columns to migration SQL**

Append to `scripts/supabase-lei-seca-migration-v2.sql`:

```sql
-- Source tracking from GraphQL API (internal, not exposed)
ALTER TABLE artigos ADD COLUMN IF NOT EXISTS source_id BIGINT;
ALTER TABLE artigos ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE artigos ADD COLUMN IF NOT EXISTS source_index INT;

-- Raw data storage on leis table
ALTER TABLE leis ADD COLUMN IF NOT EXISTS raw_tabelas JSONB DEFAULT '[]';
ALTER TABLE leis ADD COLUMN IF NOT EXISTS raw_metadata JSONB DEFAULT '{}';
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/types/lei-import.ts scripts/supabase-lei-seca-migration-v2.sql
git commit -m "feat: add GraphQL pipeline types and source tracking columns"
```

---

### Task 2: Create Browser Extraction Script

**Files:**
- Create: `scripts/lei-graphql-extractor.js`

- [ ] **Step 1: Create the vanilla JS script**

This runs in the browser console. NO TypeScript, NO imports — pure vanilla JS.

```javascript
// scripts/lei-graphql-extractor.js
// Run in browser console while on JusBrasil legislation page.
// Usage: paste this script, then run copy(JSON.stringify(window._lawData, null, 2))

(async function() {
    // Extract docId from URL or prompt
    const urlMatch = location.pathname.match(/\/legislacao\/(\d+)\//);
    const docId = urlMatch ? parseInt(urlMatch[1]) : parseInt(prompt('docId not found in URL. Enter manually:'));

    if (!docId || isNaN(docId)) {
        console.error('docId invalido');
        return;
    }

    const batchSize = 500;
    let allItems = [];
    let start = 0;

    console.log(`Extraindo lei docId=${docId}...`);

    while (true) {
        const r = await fetch('/web-docview/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                operationName: 'LawItems',
                query: `query LawItems($docId: NumericID!, $lawItemsStartFrom: Int!, $lawItemsLimit: Int) {
                    root {
                        document: documentByNumericID(artifact: "LEGISLACAO", docId: $docId) {
                            lawItems(start: $lawItemsStartFrom, end: $lawItemsLimit) {
                                codeInt64  type  description
                            }
                        }
                    }
                }`,
                variables: { docId, lawItemsStartFrom: start, lawItemsLimit: start + batchSize }
            })
        });

        if (!r.ok) {
            console.error(`HTTP ${r.status} — voce esta logado no JusBrasil?`);
            return;
        }

        const data = await r.json();
        const items = data?.data?.root?.document?.lawItems;

        if (!items) {
            console.error('Resposta inesperada da API:', data);
            return;
        }

        allItems = allItems.concat(items.map((item, i) => ({
            codeInt64: item.codeInt64,
            type: item.type,
            description: item.description,
            index: start + i
        })));

        console.log(`Carregados ${allItems.length} itens...`);

        if (items.length < batchSize) break;
        start += batchSize;
    }

    // Build structural items with subtitles
    const structuralTypes = ['PARTE', 'LIVRO', 'TITULO', 'CAPITULO', 'SECAO', 'SUBSECAO'];
    const structural = allItems
        .filter(i => structuralTypes.includes(i.type))
        .map(item => {
            const next = allItems[item.index + 1];
            return {
                ...item,
                subtitle: (next && next.type === 'NAO_IDENTIFICADO') ? next.description : null
            };
        });

    // Count articles
    const totalArticles = allItems.filter(i => i.type === 'ARTIGO').length;

    window._lawData = {
        docId,
        extractedAt: new Date().toISOString(),
        allItems,
        structural,
        stats: {
            totalItems: allItems.length,
            totalStructural: structural.length,
            totalArticles
        }
    };

    console.log('');
    console.log(`PRONTO! ${allItems.length} itens totais, ${structural.length} estruturais, ${totalArticles} artigos.`);
    console.log('');
    console.log('Para copiar, execute:');
    console.log('  copy(JSON.stringify(window._lawData, null, 2))');
})();
```

- [ ] **Step 2: Commit**

```bash
git add scripts/lei-graphql-extractor.js
git commit -m "feat: create browser console script for GraphQL law extraction"
```

---

### Task 3: Create NAO_IDENTIFICADO Sub-Classifier

**Files:**
- Create: `src/lib/lei-nao-identificado.ts`

- [ ] **Step 1: Create the sub-classifier**

```typescript
// src/lib/lei-nao-identificado.ts
// Sub-classifies NAO_IDENTIFICADO items from the GraphQL API.
// These include: penas, epigrafes, subtitulos, anotacoes standalone, preambulo, etc.

import type { GraphQLItem, NaoIdentificadoSubType } from '@/types/lei-import';
import { RE_ANOTACAO_V2 } from '@/lib/lei-annotation-regex';

/**
 * Determines the sub-type of a NAO_IDENTIFICADO item based on heuristics.
 * @param item The item to classify
 * @param prevItem The previous item in sequence (for context)
 */
export function classifyNaoIdentificado(
  item: GraphQLItem,
  prevItem: GraphQLItem | null
): NaoIdentificadoSubType {
  const desc = item.description.trim();

  // 1. After a structural item = subtitle
  if (prevItem && ['PARTE', 'LIVRO', 'TITULO', 'CAPITULO', 'SECAO', 'SUBSECAO'].includes(prevItem.type)) {
    return 'subtitulo';
  }

  // 2. Pena pattern
  if (/^Pena\s*[-–—]/i.test(desc)) {
    return 'pena';
  }

  // 3. Standalone annotation
  RE_ANOTACAO_V2.lastIndex = 0;
  if (RE_ANOTACAO_V2.test(desc) && desc.startsWith('(')) {
    return 'anotacao_standalone';
  }

  // 4. Vide
  if (/^(\(?\s*Vide\s|Vide\s)/i.test(desc)) {
    return 'vide';
  }

  // 5. Vigencia
  if (/^Vig[êe]ncia$/i.test(desc)) {
    return 'vigencia';
  }

  // 6. HTML content (tables, links from Planalto index)
  if (desc.startsWith('<table') || desc.startsWith('<a ') || desc.includes('<tr>')) {
    return 'html_content';
  }

  // 7. Preambulo pattern
  if (/^O PRESIDENTE DA REP[ÚU]BLICA/i.test(desc)) {
    return 'preambulo';
  }

  // 8. Epigrafe (short, title-case or ALL CAPS — e.g., "Homicidio simples", "Aumento de pena")
  if (desc.length < 80 && !desc.startsWith('(')) {
    return 'epigrafe';
  }

  return 'nao_classificado';
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/lib/lei-nao-identificado.ts
git commit -m "feat: create NAO_IDENTIFICADO sub-classifier for GraphQL pipeline"
```

---

### Task 4: Create GraphQL Mapper

**Files:**
- Create: `src/lib/lei-graphql-mapper.ts`

- [ ] **Step 1: Create the mapper module**

This is the core of the pipeline — converts GraphQL items to our schema.

```typescript
// src/lib/lei-graphql-mapper.ts
// Maps GraphQL API items to our internal schema.
// Handles: type mapping, slug generation, annotation separation,
// hierarchy building, and article grouping.

import type {
  GraphQLItem,
  StructuralItem,
  LawDataExport,
  LegislativeAnnotation,
  HierarchyNode,
  HierarchyPath,
  PlateElement,
  PlateChild,
  ExportedArticle,
  ExportedLei,
  LeiMetadata,
} from '@/types/lei-import';

import {
  RE_ANOTACAO_V2,
  classifyAnnotation,
  extractLeiReferenciada,
} from '@/lib/lei-annotation-regex';

import { classifyNaoIdentificado } from '@/lib/lei-nao-identificado';

// --- Type mapping ---

const TYPE_TO_ROLE: Record<string, string> = {
  ARTIGO: 'artigo',
  PARAGRAFO: 'paragrafo',
  INCISO: 'inciso',
  ALINEA: 'alinea',
  PARTE: 'parte',
  LIVRO: 'livro',
  TITULO: 'titulo',
  CAPITULO: 'capitulo',
  SECAO: 'secao',
  SUBSECAO: 'subsecao',
  EMENTA: 'ementa',
  PROTOCOLO: 'protocolo',
  DOU_PUBLICACAO: 'dou_publicacao',
  TABELA: 'tabela',
};

const INDENT_MAP: Record<string, number> = {
  ARTIGO: 0,
  PARAGRAFO: 1,
  INCISO: 1,
  ALINEA: 2,
};

// --- Slug generation ---

function extractArticleNumber(description: string): string {
  const match = description.match(/^Art\.?\s+(\d+(?:\.\d+)*[ºo°]?(?:-[A-Za-z]+)?)/i);
  if (match) return match[1].replace(/[o°]/g, 'º').replace(/\./g, '');
  return '';
}

function generateSlug(item: GraphQLItem, currentArticle: string): string {
  const type = item.type;
  const desc = item.description.trim();

  if (type === 'ARTIGO') {
    const num = extractArticleNumber(desc);
    return `artigo-${num}`;
  }

  if (type === 'PARAGRAFO') {
    if (/par[áa]grafo\s+[úu]nico/i.test(desc)) {
      return `paragrafo-unico-artigo-${currentArticle}`;
    }
    const match = desc.match(/§\s*(\d+[ºo°]?)/i);
    const num = match ? match[1].replace(/[o°]/g, 'º') : '';
    return `paragrafo-${num}-artigo-${currentArticle}`;
  }

  if (type === 'INCISO') {
    const match = desc.match(/^([IVXLCDM]+)\s*[-–—]/);
    const num = match ? match[1].toLowerCase() : '';
    return `inciso-${num}-artigo-${currentArticle}`;
  }

  if (type === 'ALINEA') {
    const match = desc.match(/^([a-z])\)/);
    const letra = match ? match[1] : '';
    return `alinea-${letra}-artigo-${currentArticle}`;
  }

  return `item-${item.index}`;
}

// --- Annotation extraction (for tooltip, NOT removed from text) ---

function extractAnnotations(
  description: string,
  slug: string
): LegislativeAnnotation[] {
  const annotations: LegislativeAnnotation[] = [];
  RE_ANOTACAO_V2.lastIndex = 0;
  let match;
  while ((match = RE_ANOTACAO_V2.exec(description)) !== null) {
    annotations.push({
      texto: match[0].trim(),
      tipo: classifyAnnotation(match[0]),
      lei_referenciada: extractLeiReferenciada(match[0]),
      dispositivo_slug: slug,
    });
  }
  return annotations;
}

// --- Plate content generation ---

function itemToPlateElement(
  item: GraphQLItem,
  slug: string,
  indent: number
): PlateElement {
  const desc = item.description;
  const children: PlateChild[] = [];

  // Split description into: label (bold) + text + annotations (marked)
  // For ARTIGO: "Art. 4º" is bold, rest is normal, annotations marked
  if (item.type === 'ARTIGO') {
    const artMatch = desc.match(/^(Art\.?\s+\d+(?:\.\d+)*[ºo°]?(?:-[A-Za-z]+)?\.?\s*)/i);
    if (artMatch) {
      children.push({ text: artMatch[1], bold: true });
      // Rest of text (may contain annotations)
      const rest = desc.slice(artMatch[1].length);
      children.push({ text: rest });
    } else {
      children.push({ text: desc });
    }
  } else if (item.type === 'PARAGRAFO') {
    const parMatch = desc.match(/^(§\s*\d+[ºo°]?\s*\.?\s*|Par[áa]grafo\s+[úu]nico\.?\s*)/i);
    if (parMatch) {
      children.push({ text: parMatch[1], bold: true });
      children.push({ text: desc.slice(parMatch[1].length) });
    } else {
      children.push({ text: desc });
    }
  } else if (item.type === 'INCISO') {
    const incMatch = desc.match(/^([IVXLCDM]+\s*[-–—]\s*)/);
    if (incMatch) {
      children.push({ text: incMatch[1], bold: true });
      children.push({ text: desc.slice(incMatch[1].length) });
    } else {
      children.push({ text: desc });
    }
  } else if (item.type === 'ALINEA') {
    const aliMatch = desc.match(/^([a-z]\)\s*)/);
    if (aliMatch) {
      children.push({ text: aliMatch[1], bold: true });
      children.push({ text: desc.slice(aliMatch[1].length) });
    } else {
      children.push({ text: desc });
    }
  } else {
    children.push({ text: desc });
  }

  return {
    type: 'p',
    children,
    id: crypto.randomUUID(),
    slug,
    urn: '',
    search_text: desc,
    texto_original: null,
    anotacoes: null,
    ...(indent > 0 ? { indent } : {}),
  };
}

// --- Revoked detection ---

function isRevoked(description: string): boolean {
  const clean = description.replace(RE_ANOTACAO_V2, '').trim();
  return /^\s*\(?\s*Revogad[oa]\s*\)?\s*\.?\s*$/i.test(clean) ||
    clean.length === 0 && /Revogad/i.test(description);
}

// --- Hierarchy builder ---

function buildHierarchy(structural: StructuralItem[]): HierarchyNode {
  const root: HierarchyNode = {
    tipo: 'documento',
    titulo: 'documento',
    partes: [], livros: [], titulos: [], subtitulos: [],
    capitulos: [], secoes: [], subsecoes: [],
  };

  const LEVEL_KEY: Record<string, keyof HierarchyNode> = {
    PARTE: 'partes', LIVRO: 'livros', TITULO: 'titulos',
    CAPITULO: 'capitulos', SECAO: 'secoes', SUBSECAO: 'subsecoes',
  };

  const LEVEL_ORDER = ['PARTE', 'LIVRO', 'TITULO', 'CAPITULO', 'SECAO', 'SUBSECAO'];

  const stack: Array<{ level: number; node: HierarchyNode }> = [];

  for (const item of structural) {
    const levelIdx = LEVEL_ORDER.indexOf(item.type);
    if (levelIdx === -1) continue;

    const titulo = item.subtitle
      ? `${item.description} ${item.subtitle}`
      : item.description;

    const node: HierarchyNode = {
      tipo: TYPE_TO_ROLE[item.type] as any,
      titulo,
      partes: [], livros: [], titulos: [], subtitulos: [],
      capitulos: [], secoes: [], subsecoes: [],
    };

    // Pop stack to find parent
    while (stack.length > 0 && stack[stack.length - 1].level >= levelIdx) {
      stack.pop();
    }

    const parent = stack.length > 0 ? stack[stack.length - 1].node : root;
    const key = LEVEL_KEY[item.type];
    if (key) (parent[key] as HierarchyNode[]).push(node);

    stack.push({ level: levelIdx, node });
  }

  return root;
}

// --- Build hierarchy path for each article ---

function buildArticlePaths(
  allItems: GraphQLItem[],
  structural: StructuralItem[]
): Map<number, { path: HierarchyPath; contexto: string }> {
  const LEVEL_ORDER = ['PARTE', 'LIVRO', 'TITULO', 'CAPITULO', 'SECAO', 'SUBSECAO'];
  const PATH_KEY: Record<string, keyof HierarchyPath> = {
    PARTE: 'parte', LIVRO: 'livro', TITULO: 'titulo',
    CAPITULO: 'capitulo', SECAO: 'secao', SUBSECAO: 'subsecao',
  };

  const paths = new Map<number, { path: HierarchyPath; contexto: string }>();
  const currentPath: HierarchyPath = {};

  for (const item of allItems) {
    if (['PARTE', 'LIVRO', 'TITULO', 'CAPITULO', 'SECAO', 'SUBSECAO'].includes(item.type)) {
      const s = structural.find(si => si.index === item.index);
      const label = s?.subtitle
        ? `${item.description} ${s.subtitle}`
        : item.description;

      const key = PATH_KEY[item.type];
      if (key) currentPath[key] = label;

      // Clear lower levels
      const levelIdx = LEVEL_ORDER.indexOf(item.type);
      for (let i = levelIdx + 1; i < LEVEL_ORDER.length; i++) {
        const lowerKey = PATH_KEY[LEVEL_ORDER[i]];
        if (lowerKey) delete currentPath[lowerKey];
      }
    }

    if (item.type === 'ARTIGO') {
      const contexto = Object.values(currentPath).filter(Boolean).join(' > ');
      paths.set(item.index, { path: { ...currentPath }, contexto });
    }
  }

  return paths;
}

// --- Main conversion function ---

export function convertGraphQLToExported(
  lawData: LawDataExport,
  metadata: LeiMetadata
): {
  exportedLei: ExportedLei;
  rawTabelas: GraphQLItem[];
  rawMetadata: GraphQLItem[];
  sourceItems: Array<{ index: number; sourceId: number; sourceType: string }>;
} {
  const { allItems, structural } = lawData;

  // Build hierarchy
  const hierarquia = buildHierarchy(structural);
  const articlePaths = buildArticlePaths(allItems, structural);

  // Separate metadata and tabela items
  const rawTabelas = allItems.filter(i => i.type === 'TABELA');
  const rawMetadata = allItems.filter(i =>
    ['EMENTA', 'PROTOCOLO', 'DOU_PUBLICACAO'].includes(i.type)
  );

  // Group items into articles
  const articles: ExportedArticle[] = [];
  const sourceItems: Array<{ index: number; sourceId: number; sourceType: string }> = [];
  let currentArticleNum = '';
  let currentArticleItems: GraphQLItem[] = [];
  let currentArticleIndex = -1;

  function flushArticle() {
    if (currentArticleItems.length === 0 || currentArticleIndex === -1) return;

    const firstItem = currentArticleItems[0];
    const num = extractArticleNumber(firstItem.description);
    const slug = `artigo-${num}`;
    const pathInfo = articlePaths.get(currentArticleIndex);

    const plateContent: PlateElement[] = [];
    const allAnnotations: LegislativeAnnotation[] = [];

    for (const item of currentArticleItems) {
      const itemSlug = generateSlug(item, num);
      const indent = INDENT_MAP[item.type] || 0;

      // NAO_IDENTIFICADO within article context
      if (item.type === 'NAO_IDENTIFICADO') {
        const prevItem = currentArticleItems[currentArticleItems.indexOf(item) - 1] || null;
        const subType = classifyNaoIdentificado(item, prevItem);

        // Pena and epigrafe get their own plate element
        if (subType === 'pena' || subType === 'epigrafe') {
          plateContent.push(itemToPlateElement(item, `${slug}-${subType}-${item.index}`, subType === 'pena' ? 1 : 0));
        }
        // Standalone annotations get extracted
        if (subType === 'anotacao_standalone' || subType === 'vide' || subType === 'vigencia') {
          allAnnotations.push({
            texto: item.description,
            tipo: classifyAnnotation(item.description),
            lei_referenciada: extractLeiReferenciada(item.description),
            dispositivo_slug: slug,
          });
        }
        continue;
      }

      const itemAnnotations = extractAnnotations(item.description, itemSlug);
      allAnnotations.push(...itemAnnotations);

      plateContent.push(itemToPlateElement(item, itemSlug, indent));

      sourceItems.push({
        index: item.index,
        sourceId: item.codeInt64,
        sourceType: item.type,
      });
    }

    const textoPlano = plateContent.map(p => p.search_text).join('\n');
    const vigente = !isRevoked(firstItem.description);

    articles.push({
      id: `artigo-${num}`,
      numero: num,
      slug,
      epigrafe: '',
      plate_content: plateContent,
      texto_plano: textoPlano,
      search_text: textoPlano,
      vigente,
      contexto: pathInfo?.contexto || '',
      path: pathInfo?.path || {},
      content_hash: simpleHash(textoPlano),
      revoked_versions: [],
      anotacoes_legislativas: allAnnotations,
      fonte: 'jusbrasil-graphql',
    });
  }

  for (const item of allItems) {
    // Skip non-content items
    if (['PARTE', 'LIVRO', 'TITULO', 'CAPITULO', 'SECAO', 'SUBSECAO',
         'EMENTA', 'PROTOCOLO', 'DOU_PUBLICACAO', 'TABELA'].includes(item.type)) {
      continue;
    }

    if (item.type === 'ARTIGO') {
      flushArticle();
      currentArticleNum = extractArticleNumber(item.description);
      currentArticleItems = [item];
      currentArticleIndex = item.index;
    } else {
      currentArticleItems.push(item);
    }
  }
  flushArticle();

  return {
    exportedLei: { lei: { hierarquia }, artigos: articles },
    rawTabelas,
    rawMetadata,
    sourceItems,
  };
}

// --- Utility ---

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/lib/lei-graphql-mapper.ts
git commit -m "feat: create GraphQL mapper — converts API items to our schema"
```

---

### Task 5: Update Import Wizard — JSON Paste + Validation

**Files:**
- Modify: `src/views/ImportLeiV2Page.tsx`

- [ ] **Step 1: Read the current ImportLeiV2Page.tsx**

Read the full file to understand existing steps and state.

- [ ] **Step 2: Add JSON paste mode**

Add a new entry point at the first step: a textarea where the user pastes the JSON from the GraphQL extraction. When valid JSON is detected:

1. Parse as `LawDataExport`
2. Show stats: total items, structural, articles
3. Auto-populate metadata from the JSON (docId, extractedAt)
4. Run `convertGraphQLToExported()` to get the exported lei
5. Run validation (`validateParsedLei` adapted or new validation on exported articles)
6. Show quality report (green/yellow/red)
7. Allow user to proceed to export

The key states to add:

```typescript
const [jsonInput, setJsonInput] = useState('');
const [lawData, setLawData] = useState<LawDataExport | null>(null);
const [conversionResult, setConversionResult] = useState<ConversionResult | null>(null);
```

- [ ] **Step 3: Add validation display**

Show a quality report card with:
- Overall status badge (green/yellow/red)
- Stats: total items, articles, structural, NAO_IDENTIFICADO breakdown
- List of flagged items (if any)
- Button to proceed to export

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add src/views/ImportLeiV2Page.tsx
git commit -m "feat: add GraphQL JSON import path to wizard with validation"
```

---

### Task 6: Update API Route + Exporter

**Files:**
- Modify: `src/app/api/lei-upload/route.ts`
- Modify: `src/lib/lei-exporter.ts`

- [ ] **Step 1: Read both files**

Read `src/app/api/lei-upload/route.ts` and `src/lib/lei-exporter.ts`.

- [ ] **Step 2: Update API route to accept new fields**

The route should pass through these additional fields to the RPC:
- `source_id` (BIGINT)
- `source_type` (TEXT)
- `source_index` (INT)
- `anotacoes_legislativas` (JSONB)
- `raw_tabelas` and `raw_metadata` on the lei payload

All optional — existing imports still work.

- [ ] **Step 3: Update exporter to include source fields**

In `uploadToSupabase`, add to artigos payload:
```typescript
source_id: art.source_id ?? null,
source_type: art.source_type ?? null,
source_index: art.source_index ?? null,
```

Add to lei payload:
```typescript
raw_tabelas: data.rawTabelas ?? [],
raw_metadata: data.rawMetadata ?? {},
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add src/app/api/lei-upload/route.ts src/lib/lei-exporter.ts
git commit -m "feat: accept GraphQL source fields in API route and exporter"
```

---

### Task 7: Create Annotation Tooltip Component

**Files:**
- Create: `src/components/lei-seca/lei-anotacao-tooltip.tsx`

- [ ] **Step 1: Create the tooltip component**

```tsx
// src/components/lei-seca/lei-anotacao-tooltip.tsx
'use client';

import type { LegislativeAnnotation } from '@/types/lei-import';
import { cn } from '@/lib/utils';

const TIPO_LABELS: Record<string, string> = {
  redacao: 'Redacao alterada',
  inclusao: 'Incluido',
  revogacao: 'Revogado',
  vide: 'Vide',
  vigencia: 'Vigencia',
  regulamento: 'Regulamento',
  producao_efeito: 'Producao de efeito',
  veto: 'Vetado',
  outro: 'Outro',
};

const TIPO_COLORS: Record<string, string> = {
  redacao: 'text-orange-400',
  inclusao: 'text-green-400',
  revogacao: 'text-red-400',
  vide: 'text-blue-400',
  vigencia: 'text-yellow-400',
  regulamento: 'text-purple-400',
  veto: 'text-red-500',
  outro: 'text-gray-400',
};

interface LeiAnotacaoTooltipProps {
  annotations: LegislativeAnnotation[];
  className?: string;
}

export function LeiAnotacaoTooltip({ annotations, className }: LeiAnotacaoTooltipProps) {
  if (annotations.length === 0) return null;

  return (
    <div className={cn(
      'p-3 rounded-lg border border-orange-500/20 bg-orange-50 dark:bg-orange-950/20',
      'max-w-sm shadow-lg',
      className
    )}>
      <div className="text-xs font-semibold text-orange-600 dark:text-orange-400 mb-2">
        Historico Legislativo
      </div>
      <ul className="space-y-1">
        {annotations.map((a, i) => (
          <li key={i} className="text-xs leading-relaxed">
            <span className={cn('font-medium', TIPO_COLORS[a.tipo] || 'text-gray-400')}>
              {TIPO_LABELS[a.tipo] || a.tipo}
            </span>
            {a.lei_referenciada && (
              <span className="text-muted-foreground"> — Lei {a.lei_referenciada}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/lei-seca/lei-anotacao-tooltip.tsx
git commit -m "feat: create annotation tooltip component for legislative history"
```

---

### Task 8: Create View Toggle + Integrate in Study Editor

**Files:**
- Create: `src/components/lei-seca/lei-view-toggle.tsx`
- Modify: `src/components/lei-seca/lei-seca-editor.tsx`

- [ ] **Step 1: Create the toggle component**

```tsx
// src/components/lei-seca/lei-view-toggle.tsx
'use client';

import { cn } from '@/lib/utils';

interface LeiViewToggleProps {
  mode: 'completo' | 'lei-seca';
  onChange: (mode: 'completo' | 'lei-seca') => void;
  className?: string;
}

export function LeiViewToggle({ mode, onChange, className }: LeiViewToggleProps) {
  return (
    <div className={cn('inline-flex rounded-lg border bg-muted p-0.5', className)}>
      <button
        onClick={() => onChange('completo')}
        className={cn(
          'px-3 py-1 text-xs font-medium rounded-md transition-colors',
          mode === 'completo'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        Completo
      </button>
      <button
        onClick={() => onChange('lei-seca')}
        className={cn(
          'px-3 py-1 text-xs font-medium rounded-md transition-colors',
          mode === 'lei-seca'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        Lei Seca
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Read lei-seca-editor.tsx**

Read the full file to understand where to integrate the toggle.

- [ ] **Step 3: Add view mode state and CSS class toggle**

Add `viewMode` state. When `lei-seca` mode is active, add CSS class `lei-seca-mode` to the editor container. CSS rule:

```css
.lei-seca-mode .lei-anotacao {
  display: none;
}
```

When `completo` (default), annotations render with:
```css
.lei-anotacao {
  color: #999;
  font-size: 0.85em;
  font-style: italic;
}
```

- [ ] **Step 4: Add toggle to toolbar area**

Render `LeiViewToggle` in the editor toolbar/header.

- [ ] **Step 5: Verify build**

Run: `npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add src/components/lei-seca/lei-view-toggle.tsx src/components/lei-seca/lei-seca-editor.tsx
git commit -m "feat: add view toggle and annotation styling in study editor"
```

---

## Verification

After all 8 tasks:

- [ ] Browser script extracts law data from JusBrasil console
- [ ] JSON paste in wizard parses and shows stats
- [ ] NAO_IDENTIFICADO items sub-classified (pena, epigrafe, etc.)
- [ ] Articles grouped with plate_content, annotations, hierarchy paths
- [ ] Validation report shows green/yellow/red
- [ ] Export to Supabase includes source_id, source_type, anotacoes_legislativas
- [ ] Study view renders annotations in gray/italic
- [ ] Toggle "Lei Seca" hides annotations via CSS
- [ ] Tooltip shows organized annotation history on hover
- [ ] `npx tsc --noEmit` passes
