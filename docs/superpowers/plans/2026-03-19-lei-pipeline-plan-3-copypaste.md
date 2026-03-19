# Lei Pipeline v2 — Plan 3: Copy/Paste Pipeline

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the copy/paste ingestion pipeline: user pastes from JusBrasil, paste interceptor captures raw HTML, TipTap serves as preview editor, parser v2 processes from clipboard data.

**Architecture:** `handlePaste` captures `clipboardData.getData('text/html')` before TipTap processes it. Raw HTML is parsed by `lei-parser-v2`. TipTap with Link extension shows preview for visual confirmation and manual corrections. Playwright extracts Sumario for hierarchy (separate small CLI script).

**Tech Stack:** TypeScript, TipTap, DOMParser, Playwright (TOC only)

**Depends on:** Plan 1 (Foundation), Plan 2 (Parser + Validation)

**Spec:** `2026-03-19-lei-copypaste-pipeline-design.md`

---

## File Structure

```
src/lib/lei-paste-interceptor.ts                # CREATE — extract metadata from clipboard HTML
scripts/lei-toc-extractor.ts                     # CREATE — Playwright TOC-only extraction
src/components/lei-seca/lei-ingestao-editor.tsx   # MODIFY — add handlePaste + Link extension
src/views/ImportLeiV2Page.tsx                     # MODIFY — add validation step + quality report
src/app/api/lei-upload/route.ts                   # MODIFY — accept new fields
```

---

### Task 1: Create Paste Interceptor

**Files:**
- Create: `src/lib/lei-paste-interceptor.ts`

- [ ] **Step 1: Create the paste interceptor module**

```typescript
// src/lib/lei-paste-interceptor.ts
// Extracts structured metadata from clipboard HTML before TipTap processes it.
// Captures: links, h6 tags, IDs, CSS classes, reference links.

import type {
  PastedDevice,
  PastedHierarchyNode,
  PasteExtractionResult,
  ReferenceLink,
} from '@/types/lei-import';

export function extractFromClipboardHtml(clipboardHtml: string): PasteExtractionResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(clipboardHtml, 'text/html');

  const elements = doc.querySelectorAll('p, h6');
  const devices: PastedDevice[] = [];
  const hierarchy: PastedHierarchyNode[] = [];

  elements.forEach((el, i) => {
    const text = el.textContent?.trim() || '';
    if (!text) return;

    // Extract device link vs reference links
    const links = el.querySelectorAll('a');
    let deviceHref: string | null = null;
    let deviceSlug: string | null = null;
    const referenceLinks: ReferenceLink[] = [];

    for (const a of links) {
      const href = a.getAttribute('href') || '';
      const linkText = a.textContent?.trim() || '';

      if (!deviceHref && href.includes('/topicos/') &&
          linkText.match(/^(Art\.?\s|§\s|Parágrafo|[IVXLCDM]+\s*[-–—]|[a-z]\))/i)) {
        deviceHref = href;
        deviceSlug = href.match(/topicos\/\d+\/(.+)/)?.[1] || null;
        continue;
      }

      if (href.includes('/topicos/') || href.includes('/legislacao/')) {
        referenceLinks.push({
          text: linkText,
          href,
          type: href.includes('/legislacao/') ? 'legislacao' : 'topico',
        });
      }
    }

    const revoked = (el as HTMLElement).className?.includes('revoked') || false;
    const domId = (el as HTMLElement).id || null;

    const device: PastedDevice = {
      text,
      html: el.innerHTML,
      href: deviceHref,
      slug: deviceSlug,
      referenceLinks,
      revoked,
      domId,
      tagName: el.tagName,
      index: i,
    };
    devices.push(device);

    // Detect hierarchy
    const isHierarchy =
      text.match(/^(PARTE\s|LIVRO\s|TÍTULO\s|CAPÍTULO\s|Seção\s|Subseção\s)/i) ||
      el.tagName === 'H6';

    if (isHierarchy) {
      const level = text.match(/^PARTE/i) ? 0 :
                    text.match(/^LIVRO/i) ? 1 :
                    text.match(/^TÍTULO/i) ? 2 :
                    text.match(/^CAPÍTULO/i) ? 3 :
                    text.match(/^Seção/i) ? 4 :
                    text.match(/^Subseção/i) ? 5 : 6;

      hierarchy.push({ text, level, domId, index: i });
    }
  });

  return {
    rawHtml: clipboardHtml,
    devices,
    hierarchy,
    stats: {
      totalElements: devices.length,
      linksFound: devices.filter((d) => d.href).length,
      revokedFound: devices.filter((d) => d.revoked).length,
      hierarchyFound: hierarchy.length,
      h6Found: devices.filter((d) => d.tagName === 'H6').length,
      idsFound: devices.filter((d) => d.domId).length,
    },
  };
}
```

- [ ] **Step 2: Verify build passes**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/lib/lei-paste-interceptor.ts
git commit -m "feat: create paste interceptor for clipboard HTML extraction"
```

---

### Task 2: Create TOC Extractor (Playwright — Sumario Only)

**Files:**
- Create: `scripts/lei-toc-extractor.ts`

- [ ] **Step 1: Create the CLI script**

```typescript
// scripts/lei-toc-extractor.ts
// Playwright CLI — extracts ONLY the Sumario (table of contents) from JusBrasil.
// Usage: npx tsx scripts/lei-toc-extractor.ts <url> [output-path]
//
// The Sumario uses a Radix UI tree-view that renders children asynchronously.
// MutationObserver guarantees all nodes are expanded before extraction.

import { chromium } from 'playwright';

interface TocNode {
  text: string;
  anchor: string;
  level: number;
  children: TocNode[];
}

async function extractToc(url: string): Promise<TocNode[]> {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  console.log(`Opening: ${url}`);
  await page.goto(url, { waitUntil: 'networkidle' });

  // Open Sumario panel
  const sumBtn = await page.$('button:has-text("Sumário")');
  if (!sumBtn) {
    console.error('Botao Sumario nao encontrado');
    await browser.close();
    return [];
  }
  await sumBtn.click();
  await page.waitForTimeout(500);

  // Expand all nodes using MutationObserver (async-safe)
  console.log('Expanding all nodes...');
  const totalExpanded = await page.evaluate(() => {
    return new Promise<number>((resolve) => {
      let total = 0;
      let timeout: ReturnType<typeof setTimeout>;

      function expandVisible() {
        const collapsed = document.querySelectorAll(
          'button[aria-expanded="false"]'
        );
        for (const btn of collapsed) {
          (btn as HTMLElement).click();
          total++;
        }
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          observer.disconnect();
          resolve(total);
        }, 500);
      }

      const observer = new MutationObserver(() => expandVisible());
      observer.observe(document.body, { childList: true, subtree: true });
      expandVisible();
    });
  });

  console.log(`Expanded ${totalExpanded} nodes`);

  // Extract TOC
  const toc = await page.evaluate(() => {
    const links = document.querySelectorAll('a[href*="#"]');
    const nodes: Array<{ text: string; anchor: string; level: number }> = [];

    for (const a of links) {
      const text = a.textContent?.trim();
      const href = a.getAttribute('href') || '';
      if (!text || !href.includes('#')) continue;
      if (
        !text.match(
          /^(LIVRO|TÍTULO|CAPÍTULO|Seção|Subseção|PARTE|DISPOSIÇÕES)/i
        )
      )
        continue;

      const anchor = href.split('#')[1];
      const level = text.match(/^PARTE/i)
        ? 0
        : text.match(/^LIVRO/i)
          ? 1
          : text.match(/^TÍTULO/i)
            ? 2
            : text.match(/^CAPÍTULO/i)
              ? 3
              : text.match(/^Seção/i)
                ? 4
                : text.match(/^Subseção/i)
                  ? 5
                  : 6;

      nodes.push({ text, anchor, level });
    }

    return nodes;
  });

  await browser.close();

  console.log(`Extracted ${toc.length} TOC nodes`);

  // Build tree from flat list
  const tree = buildTree(toc.map((n) => ({ ...n, children: [] })));

  return tree;
}

function buildTree(flatNodes: TocNode[]): TocNode[] {
  const root: TocNode[] = [];
  const stack: TocNode[] = [];

  for (const node of flatNodes) {
    // Pop stack until parent level
    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }

    stack.push(node);
  }

  return root;
}

// --- CLI ---
const url = process.argv[2];
const outputPath = process.argv[3] || null;

if (!url) {
  console.error('Usage: npx tsx scripts/lei-toc-extractor.ts <url> [output-path]');
  process.exit(1);
}

extractToc(url).then((toc) => {
  const json = JSON.stringify(toc, null, 2);

  if (outputPath) {
    const fs = require('fs');
    fs.writeFileSync(outputPath, json, 'utf-8');
    console.log(`Saved to ${outputPath}`);
  } else {
    console.log(json);
  }
});
```

- [ ] **Step 2: Test with a real URL**

Run: `npx tsx scripts/lei-toc-extractor.ts "https://www.jusbrasil.com.br/legislacao/91577/codigo-civil-lei-10406-02" data/leis-raw/cc-2002-toc.json`
Expected: JSON file with hierarchical tree of TOC nodes.

- [ ] **Step 3: Commit**

```bash
git add scripts/lei-toc-extractor.ts
git commit -m "feat: create Playwright TOC extractor for JusBrasil Sumario"
```

---

### Task 3: Update Ingestion Editor — handlePaste + Link Extension

**Files:**
- Modify: `src/components/lei-seca/lei-ingestao-editor.tsx`

- [ ] **Step 1: Read the current file fully**

Read `src/components/lei-seca/lei-ingestao-editor.tsx` to understand current extensions and editorProps.

- [ ] **Step 2: Add Link extension to TipTap for visual preview**

Add to the extensions array:

```typescript
import Link from '@tiptap/extension-link';

// In extensions array, add:
Link.configure({
  openOnClick: false,
  HTMLAttributes: {
    class: 'lei-device-link',
    target: null,
  },
}),
```

- [ ] **Step 3: Add handlePaste to editorProps**

The editor component should accept a callback prop `onPasteExtraction` and wire it to handlePaste:

```typescript
import { extractFromClipboardHtml } from '@/lib/lei-paste-interceptor';

// In editorProps:
handlePaste: (view, event) => {
  const clipboardHtml = event.clipboardData?.getData('text/html');
  if (clipboardHtml) {
    const extraction = extractFromClipboardHtml(clipboardHtml);
    onPasteExtraction?.(extraction);
  }
  return false; // Let TipTap render normally (preview)
},
```

- [ ] **Step 4: Verify build passes**

Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add src/components/lei-seca/lei-ingestao-editor.tsx
git commit -m "feat: add paste interceptor and Link extension to ingestion editor"
```

---

### Task 4: Update Import Wizard — Validation Step + Quality Report

**Files:**
- Modify: `src/views/ImportLeiV2Page.tsx`

- [ ] **Step 1: Read the current file fully**

Read `src/views/ImportLeiV2Page.tsx` to understand current steps and state.

- [ ] **Step 2: Add state for paste extraction and validation**

```typescript
const [pasteExtraction, setPasteExtraction] = useState<PasteExtractionResult | null>(null);
const [qualityReport, setQualityReport] = useState<QualityReport | null>(null);
const [tocData, setTocData] = useState<TocNode[] | null>(null);
```

- [ ] **Step 3: Wire paste extraction callback to editor**

Pass `onPasteExtraction={setPasteExtraction}` to the ingestion editor component.

- [ ] **Step 4: Add validation step between review and export**

After parsing, run validation:

```typescript
import { parseDevices } from '@/lib/lei-parser-v2';
import { validateParsedLei } from '@/lib/lei-validator';

function handleValidate() {
  if (!pasteExtraction) return;
  const parsed = parseDevices(pasteExtraction.devices);
  const report = validateParsedLei(parsed, metadata.nome);
  setQualityReport(report);
}
```

- [ ] **Step 5: Add quality report UI (green/yellow/red status)**

Display the report with:
- Overall status badge (green/yellow/red)
- Score number
- List of checks (passed/failed)
- Flagged items for manual review
- Stats bar (total devices, links found, annotations extracted)

- [ ] **Step 6: Add paste stats bar**

After paste, show inline stats:
```
"2.155 elementos | 1.890 links | 8 h6 | 315 revogados"
```

- [ ] **Step 7: Verify build passes**

Run: `npx tsc --noEmit`

- [ ] **Step 8: Commit**

```bash
git add src/views/ImportLeiV2Page.tsx
git commit -m "feat: add validation step and quality report to import wizard"
```

---

### Task 5: Update API Route — Accept New Fields

**Files:**
- Modify: `src/app/api/lei-upload/route.ts`

- [ ] **Step 1: Read the current file**

Read `src/app/api/lei-upload/route.ts` to understand current payload handling.

- [ ] **Step 2: Add new fields to the artigos payload validation**

Ensure the route accepts and passes through: `texto_limpo`, `anotacoes_legislativas`, `texto_original_fonte`, `fonte`, `fonte_url`, `qualidade_score`, `flags`, `reference_links`.

These are optional fields — existing imports without them should still work.

- [ ] **Step 3: Verify build passes**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/lei-upload/route.ts
git commit -m "feat: accept new pipeline v2 fields in lei-upload API route"
```

---

## Verification

After completing all 5 tasks:

- [ ] Paste interceptor captures HTML raw on paste in the editor
- [ ] TipTap shows links as clickable (visual confirmation)
- [ ] Paste stats bar shows element/link/hierarchy counts
- [ ] Parser v2 processes clipboard data with link-based classification
- [ ] Validation report shows green/yellow/red status
- [ ] TOC extractor CLI produces hierarchy JSON from JusBrasil URL
- [ ] API route accepts new fields without breaking existing imports
- [ ] Full flow: paste → validate → export to Supabase works end-to-end
