# Lei Pipeline v2 — Plan 4: Playwright Pipeline

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the fully automated Playwright extraction pipeline: CLI takes a JusBrasil URL, extracts all devices + TOC, outputs JSON ready for the import wizard.

**Architecture:** CLI script uses Playwright to open JusBrasil page, verify DOM fingerprint, extract all `<p>` + `<h6>` devices with metadata, expand and extract Sumario via MutationObserver, save as JSON. The import wizard loads this JSON and runs the same parser/validation/export as the copy/paste pipeline.

**Tech Stack:** TypeScript, Playwright, Node.js CLI

**Depends on:** Plan 1 (Foundation), Plan 2 (Parser + Validation). Plan 3 (Copy/Paste) is independent — both pipelines can be built in parallel.

**Spec:** `2026-03-19-lei-ingestion-pipeline-design.md`

---

## File Structure

```
scripts/lei-extractor.ts     # CREATE — full Playwright extraction CLI
data/leis-raw/               # CREATE — output directory for extracted JSON
```

---

### Task 1: Create Full Playwright Extractor CLI

**Files:**
- Create: `scripts/lei-extractor.ts`

- [ ] **Step 1: Create the CLI script with DOM fingerprint verification**

```typescript
// scripts/lei-extractor.ts
// Full Playwright extraction from JusBrasil.
// Usage: npx tsx scripts/lei-extractor.ts <url> <sigla>
// Output: data/leis-raw/<sigla>.json
//
// Extracts: all devices (<p> + <h6>), TOC (Sumario), metadata.

import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

interface ReferenceLink {
  text: string;
  href: string;
  type: 'topico' | 'legislacao';
}

interface RawDevice {
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

interface TocNode {
  text: string;
  anchor: string;
  level: number;
  children: TocNode[];
}

interface LeiMetadata {
  nome: string;
  tipo: string;
  numero: string;
  data: string;
  sigla: string;
  urlFonte: string;
}

interface RawLeiExtraction {
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

// --- DOM Fingerprint ---

async function verifyDomFingerprint(page: any): Promise<boolean> {
  return page.evaluate(() => {
    const ps = document.querySelectorAll('p');
    const hasTopicLinks = Array.from(ps).some((p: Element) =>
      p.querySelector('a[href*="/topicos/"]')
    );
    const hasReasonableCount = ps.length > 10;
    return hasTopicLinks && hasReasonableCount;
  });
}

// --- Device Extraction ---

async function extractDevices(page: any): Promise<RawDevice[]> {
  return page.evaluate(() => {
    const elements = document.querySelectorAll('p, h6');
    const devices: any[] = [];

    elements.forEach((el: Element, i: number) => {
      const text = el.textContent?.trim() || '';
      if (!text) return;

      // Extract device link vs reference links
      const links = el.querySelectorAll('a');
      let deviceHref: string | null = null;
      let deviceSlug: string | null = null;
      const referenceLinks: any[] = [];

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

      devices.push({
        text,
        html: el.innerHTML,
        href: deviceHref,
        slug: deviceSlug,
        referenceLinks,
        revoked: (el as HTMLElement).className?.includes('revoked') || false,
        domId: (el as HTMLElement).id || null,
        tagName: el.tagName,
        index: i,
      });
    });

    return devices;
  });
}

// --- TOC Extraction (MutationObserver) ---

async function extractToc(page: any): Promise<TocNode[]> {
  // Open Sumario
  const sumBtn = await page.$('button:has-text("Sumário")');
  if (!sumBtn) {
    console.warn('Sumario button not found — skipping TOC extraction');
    return [];
  }
  await sumBtn.click();
  await page.waitForTimeout(500);

  // Expand all nodes
  const totalExpanded = await page.evaluate(() => {
    return new Promise<number>((resolve) => {
      let total = 0;
      let timeout: ReturnType<typeof setTimeout>;

      function expandVisible() {
        const collapsed = document.querySelectorAll('button[aria-expanded="false"]');
        for (const btn of collapsed) { (btn as HTMLElement).click(); total++; }
        clearTimeout(timeout);
        timeout = setTimeout(() => { observer.disconnect(); resolve(total); }, 500);
      }

      const observer = new MutationObserver(() => expandVisible());
      observer.observe(document.body, { childList: true, subtree: true });
      expandVisible();
    });
  });

  console.log(`  Expanded ${totalExpanded} TOC nodes`);

  // Extract flat list
  const flatToc = await page.evaluate(() => {
    const links = document.querySelectorAll('a[href*="#"]');
    const nodes: Array<{ text: string; anchor: string; level: number }> = [];

    for (const a of links) {
      const text = a.textContent?.trim();
      const href = a.getAttribute('href') || '';
      if (!text || !href.includes('#')) continue;
      if (!text.match(/^(LIVRO|TÍTULO|CAPÍTULO|Seção|Subseção|PARTE|DISPOSIÇÕES)/i)) continue;

      const anchor = href.split('#')[1];
      const level = text.match(/^PARTE/i) ? 0 :
                    text.match(/^LIVRO/i) ? 1 :
                    text.match(/^TÍTULO/i) ? 2 :
                    text.match(/^CAPÍTULO/i) ? 3 :
                    text.match(/^Seção/i) ? 4 :
                    text.match(/^Subseção/i) ? 5 : 6;
      nodes.push({ text, anchor, level });
    }
    return nodes;
  });

  // Build tree
  return buildTree(flatToc.map((n: any) => ({ ...n, children: [] })));
}

function buildTree(flatNodes: TocNode[]): TocNode[] {
  const root: TocNode[] = [];
  const stack: TocNode[] = [];

  for (const node of flatNodes) {
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

// --- Metadata Extraction ---

async function extractMetadata(page: any, url: string, sigla: string): Promise<LeiMetadata> {
  const title = await page.title();
  // JusBrasil title format: "Código Civil | LEI Nº 10.406, DE 10 DE JANEIRO DE 2002 | Jusbrasil"
  const parts = title.split('|').map((p: string) => p.trim());

  return {
    nome: parts[0] || sigla,
    tipo: parts[1]?.match(/^(LEI|DECRETO|DECRETO-LEI|LEI COMPLEMENTAR)/i)?.[1] || '',
    numero: parts[1]?.match(/[Nn][ºo°]\s*([\d.]+)/)?.[1] || '',
    data: '', // TODO: extract from page metadata
    sigla,
    urlFonte: url,
  };
}

// --- Main ---

async function main() {
  const url = process.argv[2];
  const sigla = process.argv[3];

  if (!url || !sigla) {
    console.error('Usage: npx tsx scripts/lei-extractor.ts <url> <sigla>');
    console.error('Example: npx tsx scripts/lei-extractor.ts "https://www.jusbrasil.com.br/legislacao/91577/codigo-civil-lei-10406-02" cc-2002');
    process.exit(1);
  }

  console.log(`\nLei Extractor v2`);
  console.log(`URL: ${url}`);
  console.log(`Sigla: ${sigla}`);
  console.log('');

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // 1. Navigate
    console.log('1. Opening page...');
    await page.goto(url, { waitUntil: 'networkidle' });

    // 2. Verify DOM fingerprint
    console.log('2. Verifying DOM fingerprint...');
    const valid = await verifyDomFingerprint(page);
    if (!valid) {
      console.error('DOM fingerprint failed — JusBrasil may have changed structure');
      process.exit(1);
    }
    console.log('   Fingerprint OK');

    // 3. Extract metadata
    console.log('3. Extracting metadata...');
    const metadata = await extractMetadata(page, url, sigla);
    console.log(`   Lei: ${metadata.nome}`);

    // 4. Extract devices
    console.log('4. Extracting devices...');
    const devices = await extractDevices(page);

    const totalArticles = devices.filter((d) =>
      d.text.match(/^Art\.?\s/i)
    ).length;
    const totalRevoked = devices.filter((d) => d.revoked).length;
    const totalHierarchy = devices.filter((d) =>
      d.tagName === 'H6' || d.text.match(/^(PARTE|LIVRO|TÍTULO|CAPÍTULO|Seção|Subseção)\s/i)
    ).length;

    console.log(`   ${devices.length} devices (${totalArticles} articles, ${totalRevoked} revoked, ${totalHierarchy} hierarchy)`);

    // 5. Extract TOC
    console.log('5. Extracting TOC (Sumario)...');
    const toc = await extractToc(page);

    function countNodes(nodes: TocNode[]): number {
      return nodes.reduce((sum, n) => sum + 1 + countNodes(n.children), 0);
    }
    const totalTocNodes = countNodes(toc);
    console.log(`   ${totalTocNodes} TOC nodes`);

    // 6. Assemble output
    const extraction: RawLeiExtraction = {
      metadata,
      devices,
      toc,
      stats: {
        totalDevices: devices.length,
        totalArticles,
        totalRevoked,
        totalHierarchy,
        totalTocNodes,
      },
    };

    // 7. Save
    const outDir = path.resolve('data/leis-raw');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `${sigla}.json`);
    fs.writeFileSync(outPath, JSON.stringify(extraction, null, 2), 'utf-8');

    console.log(`\nSaved to: ${outPath}`);
    console.log('Done.');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Create output directory**

```bash
mkdir -p data/leis-raw
echo "*.json" > data/leis-raw/.gitignore
```

- [ ] **Step 3: Test with Codigo Civil**

Run: `npx tsx scripts/lei-extractor.ts "https://www.jusbrasil.com.br/legislacao/91577/codigo-civil-lei-10406-02" cc-2002`

Expected output:
```
Lei Extractor v2
URL: https://www.jusbrasil.com.br/legislacao/91577/codigo-civil-lei-10406-02
Sigla: cc-2002

1. Opening page...
2. Verifying DOM fingerprint...
   Fingerprint OK
3. Extracting metadata...
   Lei: Código Civil
4. Extracting devices...
   ~4880 devices (~2095 articles, ~315 revoked, ~X hierarchy)
5. Extracting TOC (Sumario)...
   Expanded ~1000+ TOC nodes
   ~1065 TOC nodes

Saved to: data/leis-raw/cc-2002.json
Done.
```

- [ ] **Step 4: Verify JSON structure**

Read the first 50 lines of `data/leis-raw/cc-2002.json` and verify:
- `metadata` has nome, sigla, urlFonte
- `devices[0]` has text, html, href, slug, tagName
- `toc` has nested tree structure
- `stats` has all counts

- [ ] **Step 5: Commit**

```bash
git add scripts/lei-extractor.ts data/leis-raw/.gitignore
git commit -m "feat: create full Playwright extractor CLI for JusBrasil"
```

---

### Task 2: Wire Playwright JSON to Import Wizard

**Files:**
- Modify: `src/views/ImportLeiV2Page.tsx`

- [ ] **Step 1: Add JSON file upload option to the import wizard**

In the first step of the wizard, add a button/dropzone: "Carregar JSON do Playwright" alongside the paste editor. When a JSON file is loaded:

1. Parse it as `RawLeiExtraction`
2. Populate metadata fields from `extraction.metadata`
3. Set `pasteExtraction` from `extraction.devices` (reuse same state as copy/paste)
4. Set `tocData` from `extraction.toc`
5. Skip to validation step (no need for paste or hierarchy steps)

- [ ] **Step 2: Verify both entry paths work**

Test: copy/paste flow (paste → validate → export)
Test: Playwright JSON flow (load JSON → validate → export)
Both should use the same parser v2 and validation layer.

- [ ] **Step 3: Commit**

```bash
git add src/views/ImportLeiV2Page.tsx
git commit -m "feat: add Playwright JSON import path to wizard"
```

---

## Verification

After completing all tasks:

- [ ] `npx tsx scripts/lei-extractor.ts <url> <sigla>` produces valid JSON
- [ ] DOM fingerprint check catches broken pages
- [ ] MutationObserver expands all TOC nodes (zero remaining)
- [ ] Device links distinguished from reference links
- [ ] Import wizard accepts both copy/paste AND Playwright JSON
- [ ] Same parser/validation/export flow for both entry paths
