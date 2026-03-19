# Lei Pipeline v2 — Plan 2: Parser v2 + Validation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared parser (link-based classification + regex fallback) and validation layer used by both pipelines.

**Architecture:** Parser v2 classifies devices by `<a href>` links (primary) with regex fallback. Validator checks sequential article numbering, residual annotations, and cross-validates with Planalto. Updated `lei-to-plate.ts` uses `texto_limpo` in plate_content children.

**Tech Stack:** TypeScript, DOMParser (browser), regex

**Depends on:** Plan 1 (Foundation — types, regex module, schema)

**Specs:** `2026-03-19-lei-ingestion-pipeline-design.md` (sections 4.2, 4.3, 4.4, 5), `2026-03-19-lei-copypaste-pipeline-design.md` (section 3.4)

---

## File Structure

```
src/lib/lei-parser-v2.ts    # CREATE — link-based + regex classification
src/lib/lei-validator.ts     # CREATE — quality scoring + cross-validation
src/lib/lei-to-plate.ts      # MODIFY — use texto_limpo, separate anotacoes
src/lib/lei-exporter.ts      # MODIFY — export new fields
```

---

### Task 1: Create Parser v2 — Link Classification

**Files:**
- Create: `src/lib/lei-parser-v2.ts`

- [ ] **Step 1: Create file with link-based device classification**

```typescript
// src/lib/lei-parser-v2.ts
// Parser v2: classifies devices by <a href> links (primary) + regex (fallback).
// Processes raw HTML from clipboard or Playwright extraction.

import type {
  RawDevice,
  PastedDevice,
  DeviceClassification,
  LegislativeAnnotation,
  ParsedElementType,
  ReferenceLink,
  TocNode,
  HierarchyPath,
  HierarchyNode,
  ParsedArticle,
} from '@/types/lei-import';

import {
  RE_ANOTACAO_V2,
  RE_ARTIGO_TOLERANT,
  separateAnnotations,
  classifyAnnotation,
  extractLeiReferenciada,
} from '@/lib/lei-annotation-regex';

// --- Link-based classification (primary) ---

const SLUG_PATTERNS: Array<{ regex: RegExp; tipo: ParsedElementType }> = [
  { regex: /^artigo-(\d+[a-z]?)/, tipo: 'artigo' },
  { regex: /^paragrafo-unico/, tipo: 'paragrafo_unico' },
  { regex: /^paragrafo-(\d+)/, tipo: 'paragrafo' },
  { regex: /^inciso-([ivxlcdm]+)/, tipo: 'inciso' },
  { regex: /^alinea-([a-z])/, tipo: 'alinea' },
  { regex: /^item-(\d+)/, tipo: 'item' },
];

export function classifyByLink(slug: string): DeviceClassification | null {
  if (!slug) return null;

  for (const { regex, tipo } of SLUG_PATTERNS) {
    const match = slug.match(regex);
    if (match) {
      return { tipo, numero: match[1] || '', slug, method: 'link' };
    }
  }
  return null;
}

// --- Regex-based classification (fallback) ---

export function classifyByRegex(text: string): DeviceClassification | null {
  const trimmed = text.trim();

  const artMatch = RE_ARTIGO_TOLERANT.exec(trimmed);
  if (artMatch) {
    const numero = artMatch[1].replace(/[o°]/g, 'º');
    return { tipo: 'artigo', numero, slug: `artigo-${numero}`, method: 'regex' };
  }

  if (/^\s*Par[áa]grafo\s+[úu]nico/i.test(trimmed))
    return { tipo: 'paragrafo_unico', numero: 'único', slug: 'paragrafo-unico', method: 'regex' };

  if (/^\s*§\s*(\d+[ºo°]?)/.test(trimmed)) {
    const m = trimmed.match(/§\s*(\d+[ºo°]?)/);
    const num = m?.[1]?.replace(/[o°]/g, 'º') || '';
    return { tipo: 'paragrafo', numero: num, slug: `paragrafo-${num}`, method: 'regex' };
  }

  if (/^\s*([IVXLCDM]+)\s*[-–—]/.test(trimmed)) {
    const m = trimmed.match(/^\s*([IVXLCDM]+)/);
    return { tipo: 'inciso', numero: m?.[1] || '', slug: `inciso-${m?.[1]?.toLowerCase()}`, method: 'regex' };
  }

  if (/^\s*([a-z])\)/.test(trimmed)) {
    const m = trimmed.match(/^\s*([a-z])/);
    return { tipo: 'alinea', numero: m?.[1] || '', slug: `alinea-${m?.[1]}`, method: 'regex' };
  }

  if (/^\s*Pena\s*[-–—]/i.test(trimmed))
    return { tipo: 'pena', numero: '', slug: 'pena', method: 'regex' };

  return null;
}

// --- Device link extraction (distinguishes device vs reference links) ---

export function extractDeviceLink(html: string): {
  deviceHref: string | null;
  deviceSlug: string | null;
  referenceLinks: ReferenceLink[];
} {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const links = doc.querySelectorAll('a');

  let deviceHref: string | null = null;
  let deviceSlug: string | null = null;
  const referenceLinks: ReferenceLink[] = [];

  for (const a of links) {
    const href = a.getAttribute('href') || '';
    const text = a.textContent?.trim() || '';

    if (!deviceHref && href.includes('/topicos/') &&
        text.match(/^(Art\.?\s|§\s|Parágrafo|[IVXLCDM]+\s*[-–—]|[a-z]\))/i)) {
      deviceHref = href;
      deviceSlug = href.match(/topicos\/\d+\/(.+)/)?.[1] || null;
      continue;
    }

    if (href.includes('/topicos/') || href.includes('/legislacao/')) {
      referenceLinks.push({
        text,
        href,
        type: href.includes('/legislacao/') ? 'legislacao' : 'topico',
      });
    }
  }

  return { deviceHref, deviceSlug, referenceLinks };
}

// --- Hierarchy classification ---

const HIERARCHY_PATTERNS: Array<{ regex: RegExp; tipo: string; level: number }> = [
  { regex: /^\s*PARTE\s+(GERAL|ESPECIAL|PRELIMINAR|COMPLEMENTAR|[IVXLCDM]+)/i, tipo: 'parte', level: 0 },
  { regex: /^\s*LIVRO\s+([IVXLCDM]+|[UÚ]NICO|COMPLEMENTAR)/i, tipo: 'livro', level: 1 },
  { regex: /^\s*T[IÍ]TULO\s+([IVXLCDM]+|[UÚ]NICO)/i, tipo: 'titulo', level: 2 },
  { regex: /^\s*SUBT[IÍ]TULO\s+([IVXLCDM]+|[UÚ]NICO)/i, tipo: 'subtitulo', level: 2 },
  { regex: /^\s*CAP[IÍ]TULO\s+([IVXLCDM]+(?:-[A-Z]+)?|[UÚ]NICO)/i, tipo: 'capitulo', level: 3 },
  { regex: /^\s*Se[çc][ãa]o\s+([IVXLCDM]+|[UÚ]NICA)/i, tipo: 'secao', level: 4 },
  { regex: /^\s*Subse[çc][ãa]o\s+([IVXLCDM]+|[UÚ]NICA)/i, tipo: 'subsecao', level: 5 },
];

export function classifyHierarchy(text: string, tagName?: string): {
  tipo: string;
  level: number;
  numero: string;
} | null {
  const trimmed = text.trim();

  for (const { regex, tipo, level } of HIERARCHY_PATTERNS) {
    const match = regex.exec(trimmed);
    if (match) {
      return { tipo, level, numero: match[1] };
    }
  }

  // h6 tags from JusBrasil are always hierarchy (TITULO or CAPITULO)
  if (tagName === 'H6') {
    if (trimmed.match(/TÍTULO/i)) return { tipo: 'titulo', level: 2, numero: '' };
    if (trimmed.match(/CAPÍTULO/i)) return { tipo: 'capitulo', level: 3, numero: '' };
  }

  return null;
}

// --- Main parse function ---

export interface ParseV2Result {
  devices: Array<{
    classification: DeviceClassification | null;
    hierarchy: { tipo: string; level: number; numero: string } | null;
    textoLimpo: string;
    textoOriginal: string;
    anotacoes: LegislativeAnnotation[];
    referenceLinks: ReferenceLink[];
    revoked: boolean;
    domId: string | null;
    index: number;
  }>;
  stats: {
    total: number;
    classifiedByLink: number;
    classifiedByRegex: number;
    unclassified: number;
    hierarchyElements: number;
    annotationsExtracted: number;
  };
}

export function parseDevices(
  devices: Array<RawDevice | PastedDevice>
): ParseV2Result {
  let byLink = 0;
  let byRegex = 0;
  let unclassified = 0;
  let hierarchyCount = 0;
  let annotationCount = 0;

  const parsed = devices.map((device) => {
    // 1. Check if it's hierarchy
    const hierarchy = classifyHierarchy(device.text, device.tagName);
    if (hierarchy) {
      hierarchyCount++;
    }

    // 2. Classify device type
    let classification: DeviceClassification | null = null;

    // Primary: link-based
    if (device.slug) {
      classification = classifyByLink(device.slug);
      if (classification) byLink++;
    }

    // Fallback: regex
    if (!classification && !hierarchy) {
      classification = classifyByRegex(device.text);
      if (classification) byRegex++;
      else unclassified++;
    }

    // 3. Separate annotations
    const { textoLimpo, anotacoes: rawAnotacoes, textoOriginal } =
      separateAnnotations(device.text);

    // 4. Structure annotations
    const anotacoes: LegislativeAnnotation[] = rawAnotacoes.map((a) => ({
      texto: a,
      tipo: classifyAnnotation(a),
      lei_referenciada: extractLeiReferenciada(a),
      dispositivo_slug: classification?.slug || device.slug || '',
    }));
    annotationCount += anotacoes.length;

    // 5. Extract reference links from HTML
    const { referenceLinks } = device.html
      ? extractDeviceLink(device.html)
      : { referenceLinks: device.referenceLinks || [] };

    return {
      classification,
      hierarchy,
      textoLimpo,
      textoOriginal,
      anotacoes,
      referenceLinks,
      revoked: device.revoked,
      domId: device.domId,
      index: device.index,
    };
  });

  return {
    devices: parsed,
    stats: {
      total: devices.length,
      classifiedByLink: byLink,
      classifiedByRegex: byRegex,
      unclassified,
      hierarchyElements: hierarchyCount,
      annotationsExtracted: annotationCount,
    },
  };
}
```

- [ ] **Step 2: Verify build passes**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/lei-parser-v2.ts
git commit -m "feat: create parser v2 with link-based classification"
```

---

### Task 2: Create Validation Layer

**Files:**
- Create: `src/lib/lei-validator.ts`

- [ ] **Step 1: Create the validator module**

```typescript
// src/lib/lei-validator.ts
// Automatic quality validation for ingested laws.
// Checks: sequential numbering, empty text, residual annotations,
// duplicate numbers, hierarchy coverage.

import type {
  QualityReport,
  ValidationCheck,
  FlaggedItem,
} from '@/types/lei-import';

import {
  RE_ANOTACAO_V2,
  RE_PARENTHETICAL_SUSPECT,
} from '@/lib/lei-annotation-regex';

import type { ParseV2Result } from '@/lib/lei-parser-v2';

export function validateParsedLei(
  parsed: ParseV2Result,
  leiName: string
): QualityReport {
  const checks: ValidationCheck[] = [];
  const flagged: FlaggedItem[] = [];

  const articles = parsed.devices.filter(
    (d) => d.classification?.tipo === 'artigo' && !d.revoked
  );

  // 1. Sequential article count — detect gaps
  const articleNumbers = articles
    .map((a) => {
      const num = a.classification?.numero || '';
      return parseInt(num.replace(/\./g, '').replace(/[ºo°]/g, ''), 10);
    })
    .filter((n) => !isNaN(n))
    .sort((a, b) => a - b);

  const gaps: Array<{ from: number; to: number }> = [];
  for (let i = 1; i < articleNumbers.length; i++) {
    const diff = articleNumbers[i] - articleNumbers[i - 1];
    if (diff > 1) {
      gaps.push({ from: articleNumbers[i - 1], to: articleNumbers[i] });
    }
  }

  checks.push({
    name: 'sequential_count',
    passed: gaps.length === 0,
    message: gaps.length === 0
      ? `${articles.length} artigos em sequencia, sem gaps`
      : `${gaps.length} gap(s) encontrado(s): ${gaps.map((g) => `${g.from}-${g.to}`).join(', ')}`,
    severity: gaps.length > 0 ? 'error' : 'info',
  });

  gaps.forEach((g) => {
    for (let n = g.from + 1; n < g.to; n++) {
      flagged.push({
        slug: `artigo-${n}`,
        reason: `Artigo ${n} nao encontrado (gap entre ${g.from} e ${g.to})`,
        severity: 'error',
      });
    }
  });

  // 2. Empty text detection
  const emptyDevices = parsed.devices.filter(
    (d) =>
      d.classification &&
      !d.revoked &&
      d.textoLimpo.length < 5 &&
      !d.hierarchy
  );

  checks.push({
    name: 'empty_text',
    passed: emptyDevices.length === 0,
    message:
      emptyDevices.length === 0
        ? 'Nenhum dispositivo com texto vazio'
        : `${emptyDevices.length} dispositivo(s) com texto suspeitamente curto`,
    severity: emptyDevices.length > 0 ? 'error' : 'info',
  });

  emptyDevices.forEach((d) => {
    flagged.push({
      slug: d.classification?.slug || 'unknown',
      reason: `Texto muito curto: "${d.textoLimpo}"`,
      severity: 'error',
    });
  });

  // 3. Residual annotations in clean text
  const residuals = parsed.devices.filter((d) => {
    if (!d.textoLimpo) return false;
    RE_ANOTACAO_V2.lastIndex = 0;
    return RE_ANOTACAO_V2.test(d.textoLimpo);
  });

  checks.push({
    name: 'residual_annotations',
    passed: residuals.length === 0,
    message:
      residuals.length === 0
        ? 'Nenhuma anotacao residual no texto limpo'
        : `${residuals.length} dispositivo(s) com anotacao nao extraida`,
    severity: residuals.length > 0 ? 'warning' : 'info',
  });

  residuals.forEach((d) => {
    flagged.push({
      slug: d.classification?.slug || 'unknown',
      reason: 'Anotacao legislativa residual no texto limpo',
      severity: 'warning',
      details: d.textoLimpo.substring(0, 200),
    });
  });

  // 4. Suspect parentheticals
  const suspects = parsed.devices.filter((d) => {
    if (!d.textoLimpo) return false;
    RE_PARENTHETICAL_SUSPECT.lastIndex = 0;
    return RE_PARENTHETICAL_SUSPECT.test(d.textoLimpo);
  });

  checks.push({
    name: 'parenthetical_scan',
    passed: suspects.length <= 5,
    message: `${suspects.length} dispositivo(s) com parenteticos longos no texto limpo`,
    severity: suspects.length > 5 ? 'warning' : 'info',
  });

  // 5. Duplicate article numbers (both vigente)
  const artNums = new Map<string, number>();
  articles.forEach((a) => {
    const num = a.classification?.numero || '';
    artNums.set(num, (artNums.get(num) || 0) + 1);
  });
  const duplicates = Array.from(artNums.entries()).filter(([, count]) => count > 1);

  checks.push({
    name: 'duplicate_numbers',
    passed: duplicates.length === 0,
    message:
      duplicates.length === 0
        ? 'Nenhum artigo duplicado'
        : `${duplicates.length} numero(s) de artigo duplicado(s)`,
    severity: duplicates.length > 0 ? 'warning' : 'info',
  });

  // 6. Link classification coverage
  const linkPct = parsed.stats.total > 0
    ? Math.round((parsed.stats.classifiedByLink / parsed.stats.total) * 100)
    : 0;

  checks.push({
    name: 'link_classification',
    passed: linkPct >= 80,
    message: `${linkPct}% dispositivos classificados por link (${parsed.stats.classifiedByLink}/${parsed.stats.total})`,
    severity: linkPct < 50 ? 'warning' : 'info',
  });

  // Calculate overall score
  const errorCount = checks.filter((c) => !c.passed && c.severity === 'error').length;
  const warningCount = checks.filter((c) => !c.passed && c.severity === 'warning').length;
  const score = Math.max(0, 100 - errorCount * 20 - warningCount * 5);

  const overallStatus: 'green' | 'yellow' | 'red' =
    score >= 95 ? 'green' : score >= 80 ? 'yellow' : 'red';

  return {
    lei: leiName,
    timestamp: new Date().toISOString(),
    overallStatus,
    overallScore: score,
    stats: {
      totalDevices: parsed.stats.total,
      articles: articles.length,
      revokedArticles: parsed.devices.filter((d) => d.revoked).length,
      classifiedByLink: parsed.stats.classifiedByLink,
      classifiedByRegex: parsed.stats.classifiedByRegex,
      annotationsExtracted: parsed.stats.annotationsExtracted,
      residualAnnotations: residuals.length,
    },
    checks,
    flaggedItems: flagged,
  };
}
```

- [ ] **Step 2: Add cross-validation with Planalto**

Add to the same file:

```typescript
export interface CrossValidationResult {
  jbCount: number;
  planaltoCount: number;
  diff: number;
  status: 'match' | 'close' | 'divergent';
}

export async function crossValidateWithPlanalto(
  articleCount: number,
  planaltoUrl: string
): Promise<CrossValidationResult> {
  try {
    const response = await fetch(planaltoUrl);
    const html = await response.text();

    // Remove links (annotations often inside <a>) and count articles
    // anchored at start of line to avoid false positives
    const cleanHtml = html.replace(/<a[^>]*>.*?<\/a>/gi, '');
    const matches = cleanHtml.match(/^\s*Art\.?\s+\d/gmi) || [];
    const planaltoCount = matches.length;

    const diff = Math.abs(articleCount - planaltoCount);

    return {
      jbCount: articleCount,
      planaltoCount,
      diff,
      status: diff === 0 ? 'match' : diff < 5 ? 'close' : 'divergent',
    };
  } catch {
    return {
      jbCount: articleCount,
      planaltoCount: -1,
      diff: -1,
      status: 'divergent',
    };
  }
}
```

- [ ] **Step 3: Verify build passes**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/lib/lei-validator.ts
git commit -m "feat: create validation layer with quality scoring and cross-validation"
```

---

### Task 3: Update lei-to-plate.ts — Use texto_limpo

**Files:**
- Modify: `src/lib/lei-to-plate.ts`

- [ ] **Step 1: Read the current file to understand the structure**

Read `src/lib/lei-to-plate.ts` fully before making changes.

- [ ] **Step 2: Update `elementToPlateNode` to use texto_limpo**

In the function that builds PlateElement children, the text content should come from `texto_limpo` (annotation-free text), not `textoOriginal`. Annotations go to the article-level `anotacoes_legislativas` field, NOT inside `plate_content[].anotacoes`.

Key change: when generating the `children` array for each PlateElement, use the clean text. Remove or deprecate the per-element `anotacoes` field for new imports.

- [ ] **Step 3: Verify build passes and existing imports still work**

Run: `npx tsc --noEmit`
Existing imports with `plate_content[].anotacoes` should still render correctly (backward compatible).

- [ ] **Step 4: Commit**

```bash
git add src/lib/lei-to-plate.ts
git commit -m "feat: update lei-to-plate to use texto_limpo in plate_content children"
```

---

### Task 4: Update lei-exporter.ts — Export New Fields

**Files:**
- Modify: `src/lib/lei-exporter.ts`

- [ ] **Step 1: Read the current file**

Read `src/lib/lei-exporter.ts` to understand current payload structure.

- [ ] **Step 2: Add new fields to the artigos payload**

Update the payload builder to include: `texto_limpo`, `anotacoes_legislativas`, `texto_original_fonte`, `fonte`, `fonte_url`, `qualidade_score`, `flags`, `reference_links`.

- [ ] **Step 3: Verify build passes**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/lib/lei-exporter.ts
git commit -m "feat: export new pipeline v2 fields to Supabase"
```

---

## Verification

After completing all 4 tasks:

- [ ] `npx tsc --noEmit` passes
- [ ] `lei-parser-v2.ts` exports: `classifyByLink`, `classifyByRegex`, `extractDeviceLink`, `classifyHierarchy`, `parseDevices`
- [ ] `lei-validator.ts` exports: `validateParsedLei`, `crossValidateWithPlanalto`
- [ ] `lei-to-plate.ts` uses `texto_limpo` in children (new imports), backward compatible with old imports
- [ ] `lei-exporter.ts` includes new fields in payload
