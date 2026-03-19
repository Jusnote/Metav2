# Lei Pipeline v2 — Plan 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the type system, expanded annotation regex, and database schema that both pipelines (Copy/Paste and Playwright) depend on.

**Architecture:** New TypeScript interfaces for devices, annotations, validation. Shared annotation regex module. SQL migration for new columns on `artigos` table. All changes are additive — zero breaking changes to existing code.

**Tech Stack:** TypeScript, Supabase (PostgreSQL), SQL migrations

**Specs:** `docs/superpowers/specs/2026-03-19-lei-ingestion-pipeline-design.md` (sections 5, 6), `docs/superpowers/specs/2026-03-19-lei-copypaste-pipeline-design.md` (section 3.4)

---

## File Structure

```
src/types/lei-import.ts              # MODIFY — add new interfaces
src/lib/lei-annotation-regex.ts      # CREATE — expanded regex patterns (shared)
scripts/supabase-lei-seca-migration-v2.sql  # CREATE — new columns + RPC update
```

---

### Task 1: Add New TypeScript Interfaces

**Files:**
- Modify: `src/types/lei-import.ts`

- [ ] **Step 1: Add ReferenceLink interface**

```typescript
// Add after existing interfaces in src/types/lei-import.ts

export interface ReferenceLink {
  text: string;
  href: string;
  type: 'topico' | 'legislacao';
}
```

- [ ] **Step 2: Add RawDevice interface**

```typescript
export interface RawDevice {
  text: string;
  html: string;
  href: string | null;
  slug: string | null;
  referenceLinks: ReferenceLink[];
  revoked: boolean;
  domId: string | null;
  tagName: string;
  index: number;
}
```

- [ ] **Step 3: Add TocNode interface**

```typescript
export interface TocNode {
  text: string;
  anchor: string;
  level: number; // 0=parte, 1=livro, 2=titulo, 3=capitulo, 4=secao, 5=subsecao
  children: TocNode[];
}
```

- [ ] **Step 4: Add RawLeiExtraction interface**

```typescript
export interface RawLeiExtraction {
  metadata: LeiMetadata;
  devices: RawDevice[];
  toc: TocNode[];
  stats: {
    totalDevices: number;
    totalArticles: number;
    totalRevoked: number;
    totalHierarchy: number;
    totalTocNodes: number;
  };
}
```

- [ ] **Step 5: Add LegislativeAnnotation interface**

```typescript
export type AnnotationType =
  | 'redacao' | 'inclusao' | 'revogacao' | 'vide' | 'vigencia'
  | 'regulamento' | 'producao_efeito' | 'veto' | 'outro';

export interface LegislativeAnnotation {
  texto: string;
  tipo: AnnotationType;
  lei_referenciada: string | null;
  dispositivo_slug: string;
}
```

- [ ] **Step 6: Add DeviceClassification interface**

```typescript
export interface DeviceClassification {
  tipo: ParsedElementType;
  numero: string;
  slug: string;
  method: 'link' | 'regex';
}
```

- [ ] **Step 7: Add QualityReport interface**

```typescript
export interface ValidationCheck {
  name: string;
  passed: boolean;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface FlaggedItem {
  slug: string;
  reason: string;
  severity: 'error' | 'warning';
  details?: string;
}

export interface QualityReport {
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
  checks: ValidationCheck[];
  flaggedItems: FlaggedItem[];
}
```

- [ ] **Step 8: Add PasteExtractionResult interface (for copy/paste pipeline)**

```typescript
export interface PastedDevice {
  text: string;
  html: string;
  href: string | null;
  slug: string | null;
  referenceLinks: ReferenceLink[];
  revoked: boolean;
  domId: string | null;
  tagName: string;
  index: number;
}

export interface PastedHierarchyNode {
  text: string;
  level: number;
  domId: string | null;
  index: number;
}

export interface PasteExtractionResult {
  rawHtml: string;
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
```

- [ ] **Step 9: Verify build passes**

Run: `npx tsc --noEmit`
Expected: No new type errors introduced.

- [ ] **Step 10: Commit**

```bash
git add src/types/lei-import.ts
git commit -m "feat: add TypeScript interfaces for lei pipeline v2"
```

---

### Task 2: Create Expanded Annotation Regex Module

**Files:**
- Create: `src/lib/lei-annotation-regex.ts`

- [ ] **Step 1: Create the shared regex module**

```typescript
// src/lib/lei-annotation-regex.ts
// Expanded annotation regex covering ALL known patterns from Planalto and JusBrasil.
// Shared between both pipelines (copy/paste and Playwright).

/**
 * Matches legislative annotations like:
 * (Redacao dada pela Lei...), (Incluido pela...), (Revogado pela...),
 * (Regulamento), (Producao de efeito), (Vigencia), etc.
 */
export const RE_ANOTACAO_V2 =
  /\((?:Reda[çc][ãa]o\s+dad|Inclu[ií]d|Revogad|Vide\s|Vig[eê]ncia|Acrescid|Alterad|VETAD|Suprimi|Renumerad|Regulamento|Regulamenta[çc][ãa]o|Produ[çc][ãa]o\s+de\s+efeito|Promulga[çc][ãa]o|Texto\s+compilad|Convers[ãa]o\s+d|Declara[çc][ãa]o|Declarad|Norma\s+anterior|Publica[çc][ãa]o\s+original|Mensagem\s+de\s+veto|Refer[eê]ncia)[^)]*\)/gi;

/**
 * Matches the article number pattern tolerantly.
 * Handles: Art. 1o, Art 1.636., Art. 121-A, Art. 2.046
 */
export const RE_ARTIGO_TOLERANT =
  /^\s*Art\.?\s+(\d+(?:\.\d+)*[ºo°]?(?:-[A-Za-z]+)?)\s*\.?\s*[.\-–—]?\s*(.*)/i;

/**
 * Matches any parenthetical longer than 20 chars in clean text.
 * Used as safety check to detect annotations the main regex missed.
 */
export const RE_PARENTHETICAL_SUSPECT =
  /\([^)]{20,}\)/g;

import type { AnnotationType } from '@/types/lei-import';

/**
 * Classifies an annotation text into a structured type.
 */
export function classifyAnnotation(text: string): AnnotationType {
  const t = text.toLowerCase();
  if (t.includes('reda') && t.includes('dad')) return 'redacao';
  if (t.includes('inclu')) return 'inclusao';
  if (t.includes('revogad')) return 'revogacao';
  if (t.includes('vigência') || t.includes('vigencia')) return 'vigencia';
  if (t.includes('vide')) return 'vide';
  if (t.includes('regulament')) return 'regulamento';
  if (t.includes('produ') && t.includes('efeito')) return 'producao_efeito';
  if (t.includes('vetad')) return 'veto';
  return 'outro';
}

/**
 * Extracts a referenced law number from annotation text.
 * E.g., "(Redacao dada pela Lei no 13.968, de 2019)" -> "13968/2019"
 */
export function extractLeiReferenciada(text: string): string | null {
  const match = text.match(/Lei\s+(?:n[ºo°]?\s*)?(\d+[\.\d]*)\s*(?:,\s*de\s+|\s*\/\s*)(\d{4})/i);
  if (match) {
    const numero = match[1].replace(/\./g, '');
    return `${numero}/${match[2]}`;
  }
  return null;
}

/**
 * Separates annotations from text. Returns clean text + extracted annotations.
 */
export function separateAnnotations(text: string): {
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

  textoLimpo = textoLimpo.replace(/\s{2,}/g, ' ').trim();
  textoLimpo = textoLimpo.replace(/\s*[,;]\s*$/, '').trim();

  return { textoLimpo, anotacoes, textoOriginal };
}
```

- [ ] **Step 2: Verify build passes**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/lei-annotation-regex.ts
git commit -m "feat: create expanded annotation regex module for lei pipeline v2"
```

---

### Task 3: Create Database Migration

**Files:**
- Create: `scripts/supabase-lei-seca-migration-v2.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- scripts/supabase-lei-seca-migration-v2.sql
-- Lei Pipeline v2: New columns for annotation separation, quality scoring, and source tracking.
-- All changes are additive (ADD COLUMN IF NOT EXISTS) — safe for existing data.

-- 1. Clean text without any legislative annotations (for study display)
ALTER TABLE artigos ADD COLUMN IF NOT EXISTS
  texto_limpo TEXT;

-- 2. Structured array of extracted legislative annotations
ALTER TABLE artigos ADD COLUMN IF NOT EXISTS
  anotacoes_legislativas JSONB DEFAULT '[]';

-- 3. Raw text exactly as received from source (audit trail)
ALTER TABLE artigos ADD COLUMN IF NOT EXISTS
  texto_original_fonte TEXT;

-- 4. Source identifier
ALTER TABLE artigos ADD COLUMN IF NOT EXISTS
  fonte TEXT DEFAULT 'planalto';

-- 5. Source URL
ALTER TABLE artigos ADD COLUMN IF NOT EXISTS
  fonte_url TEXT;

-- 6. Quality confidence score (0-100)
ALTER TABLE artigos ADD COLUMN IF NOT EXISTS
  qualidade_score SMALLINT;

-- 7. Validation flags for pending review
ALTER TABLE artigos ADD COLUMN IF NOT EXISTS
  flags JSONB DEFAULT '[]';

-- 8. Reference links to other devices/laws (for future cross-linking)
ALTER TABLE artigos ADD COLUMN IF NOT EXISTS
  reference_links JSONB DEFAULT '[]';

-- Update the RPC function to accept new fields
-- NOTE: The existing upsert_lei_com_artigos RPC must be updated in Supabase
-- to handle the new columns. The exact RPC update depends on the current
-- function body in supabase-lei-seca-upgrade.sql. Apply this migration
-- after reviewing the current RPC function.

-- After applying: run `supabase gen types typescript` to regenerate database.ts
```

- [ ] **Step 2: Document the text columns for clarity**

Add a comment block at the top:

```sql
-- GLOSSARY OF TEXT COLUMNS:
-- texto_plano:          Full text WITH annotations, normalized (for full-text search tsvector)
-- texto_limpo:          Text WITHOUT annotations (for study display - lei seca pura)
-- texto_original_fonte: Raw text exactly as scraped from source (for audit/debug)
-- search_text:          Normalized text for trigram search (lowercase, no accents)
-- plate_content:        Plate.js JSON for rich editor rendering (uses texto_limpo in children)
--
-- MIGRATION NOTE:
-- Existing imports have plate_content[].anotacoes (per-element annotations).
-- New imports use artigos.anotacoes_legislativas (article-level, structured).
-- The display layer checks anotacoes_legislativas first; if empty, falls back
-- to plate_content[].anotacoes for backward compatibility.
```

- [ ] **Step 3: Commit**

```bash
git add scripts/supabase-lei-seca-migration-v2.sql
git commit -m "feat: add SQL migration for lei pipeline v2 columns"
```

---

## Verification

After completing all 3 tasks:

- [ ] `npx tsc --noEmit` passes with zero new errors
- [ ] All new interfaces are exported from `src/types/lei-import.ts`
- [ ] `lei-annotation-regex.ts` exports: `RE_ANOTACAO_V2`, `RE_ARTIGO_TOLERANT`, `RE_PARENTHETICAL_SUSPECT`, `classifyAnnotation`, `extractLeiReferenciada`, `separateAnnotations`
- [ ] Migration SQL is additive only (no DROP, no ALTER existing columns)
- [ ] Migration includes glossary comment explaining text column differences
