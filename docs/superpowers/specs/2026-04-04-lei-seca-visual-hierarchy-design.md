# Lei Seca — Visual Hierarchy Redesign

## Summary

CSS-only changes to the Lei Seca study page to improve visual structure and readability. No new components, no logic changes, no data model changes.

## Problem

The current page feels "flat" — all dispositivos (articles, paragraphs, incisos, alíneas) render at the same size and color with minimal visual separation between article blocks. There's no clear hierarchy or breathing room.

## Design Decisions

All decisions validated through iterative browser mockups (`.superpowers/brainstorm/11449-1775308770/`).

### 1. Article number in amber

The "Art. Xº" text renders in **amber 700** (`#b45309`), inline with the article text. No pill, no background, no border — just the color. This is the only warm element on the page, creating a natural anchor point for each article.

**Scope:** Only the "Art." prefix + number. The rest of the article text stays in the default color.

### 2. Font-size hierarchy

| Element | Current | New |
|---------|---------|-----|
| Artigo (caput) | 15px (inherits from container) | **15px** (unchanged) |
| Parágrafo, Inciso, Alínea, Pena | 15px (same as artigo) | **13px** |

All child dispositivos share the same 13px size — no graduated reduction per level. Hierarchy comes from the size difference to the article + existing indentation.

### 3. Cold neutral color palette

Replace warm grays with cool slate tones:

| Element | Current | New |
|---------|---------|-----|
| Body background | `#f6f5f2` (warm) or white | `#ffffff` (pure white) |
| Article text | `rgb(67,80,92)` | `#3b4654` (cool slate) |
| Child dispositivos | same as article | `#64748b` (lighter slate) |
| Chevrons (›) | `#d0d0d0` | `#d1d5db` (cool gray) |
| Annotations | `#bbb` | `#b0b8c4` (cool gray) |
| Structural headers | `#aaa` | `#9ca3af` (cool gray) |
| Structural border | `#eee` | `#f0f1f3` (cool) |

### 4. Spacing between article blocks

**8px gap** (`margin-bottom: 8px`) between each article block (the wrapper div that contains the artigo + its children). No separator line, no gradient, no hover effect.

### 5. What does NOT change

- Gutter (heart, flame, comments, ⋯ menu) — unchanged
- DispositivoFooter — unchanged
- GrifoText / highlights — unchanged
- Indentation values (34px, 58px, 82px) — unchanged
- Font family (Literata) — unchanged
- Line-height (1.9) — unchanged
- EstruturaBlock / structural headers — unchanged (except color)
- Revogado styling (line-through) — unchanged
- Annotation italic styling — unchanged (except color)
- ReactionPicker, CommunityPopover — unchanged
- Any JavaScript logic — unchanged

## Files to Modify

### `src/components/lei-seca/dispositivos/Artigo.tsx`
- Wrap the article number prefix ("Art. Xº") in a `<span className="text-[#b45309]">` or equivalent
- Need to parse/detect "Art. XX" from the text string, or if already separated, just apply the class

### `src/components/lei-seca/dispositivos/Paragrafo.tsx`
- Add `text-[13px] text-[#64748b]`

### `src/components/lei-seca/dispositivos/Inciso.tsx`
- Add `text-[13px] text-[#64748b]`

### `src/components/lei-seca/dispositivos/Alinea.tsx`
- Add `text-[13px] text-[#64748b]`

### `src/components/lei-seca/dispositivos/Pena.tsx`
- Add `text-[13px]` (color already lighter)

### `src/components/lei-seca/dispositivos/DispositivoList.tsx`
- Adjust gap/margin between article blocks to 8px
- Update container text color to `#3b4654`
- Chevron colors to `#d1d5db`

### `src/components/lei-seca/dispositivos/EstruturaBlock.tsx`
- Update color to `#9ca3af`, border to `#f0f1f3`

### Global / parent styles
- Ensure body/page background is `#ffffff`
- Annotation color to `#b0b8c4`

## Token Reference

```css
/* Article number */
--lei-art-num: #b45309;        /* amber-700 */

/* Text hierarchy */
--lei-text-primary: #3b4654;   /* article text */
--lei-text-secondary: #64748b; /* child dispositivos */
--lei-text-annotation: #b0b8c4;/* annotations */

/* Structural */
--lei-structural-text: #9ca3af;
--lei-structural-border: #f0f1f3;

/* UI elements */
--lei-chevron: #d1d5db;
--lei-bg: #ffffff;

/* Spacing */
--lei-art-gap: 8px;

/* Font sizes */
--lei-font-artigo: 15px;
--lei-font-filho: 13px;
```

## Mockup Reference

Final approved mockup: `.superpowers/brainstorm/11449-1775308770/content/article-grouping-v14-spacing-only.html` (with 8px gap selected, amber 700 from v11)
