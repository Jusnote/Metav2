// scripts/lei-pipeline/lib/link-extractor.js
//
// Ported from extractInlineLinks in src/lib/lei-graphql-mapper.ts
// Extracts <a> links from description HTML and returns clean text + links.

/**
 * Common HTML entity map for legislative text.
 */
const HTML_ENTITIES = {
  '&ordm;': 'º',
  '&ordf;': 'ª',
  '&Ccedil;': 'Ç',
  '&ccedil;': 'ç',
  '&Atilde;': 'Ã',
  '&atilde;': 'ã',
  '&Otilde;': 'Õ',
  '&otilde;': 'õ',
  '&Aacute;': 'Á',
  '&aacute;': 'á',
  '&Eacute;': 'É',
  '&eacute;': 'é',
  '&Iacute;': 'Í',
  '&iacute;': 'í',
  '&Oacute;': 'Ó',
  '&oacute;': 'ó',
  '&Uacute;': 'Ú',
  '&uacute;': 'ú',
  '&Agrave;': 'À',
  '&agrave;': 'à',
  '&Acirc;': 'Â',
  '&acirc;': 'â',
  '&Ecirc;': 'Ê',
  '&ecirc;': 'ê',
  '&Ocirc;': 'Ô',
  '&ocirc;': 'ô',
  '&Uuml;': 'Ü',
  '&uuml;': 'ü',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&nbsp;': ' ',
};

/**
 * Decode HTML entities in a string.
 * Handles named entities (from map) and numeric entities (&#123;).
 * @param {string} str
 * @returns {string}
 */
function decodeEntities(str) {
  let result = str;
  for (const [entity, char] of Object.entries(HTML_ENTITIES)) {
    // Use split+join for global replace without regex
    while (result.includes(entity)) {
      result = result.replace(entity, char);
    }
  }
  // Numeric entities: &#123; → char
  result = result.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
  // Hex entities: &#x1F; → char
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  return result;
}

/**
 * Extracts <a> links from description HTML and returns clean text + links.
 *
 * Example:
 *   'conforme a <a href="/legislacao/123" title="CF">Constituição</a> Federal'
 *   → cleanText: 'conforme a Constituição Federal'
 *   → links: [{ href: '/legislacao/123', titulo: 'CF', textoAncora: 'Constituição' }]
 *
 * @param {string} description - Raw HTML description from the API
 * @returns {{ cleanText: string, links: Array<{href: string, titulo: string, textoAncora: string}> }}
 */
export function extractInlineLinks(description) {
  if (!description) return { cleanText: '', links: null };

  const links = [];

  // Extract links before stripping tags
  // Use a two-step approach: first match the whole <a> tag, then extract href/title from attributes
  const linkRegex = /<a\s+([^>]*)>(.*?)<\/a>/gi;
  let match;
  while ((match = linkRegex.exec(description)) !== null) {
    const attrs = match[1];
    const body = match[2];
    const hrefMatch = attrs.match(/href="([^"]*)"/i);
    const titleMatch = attrs.match(/title="([^"]*)"/i);
    links.push({
      href: decodeEntities(hrefMatch ? hrefMatch[1] : ''),
      titulo: decodeEntities(titleMatch ? titleMatch[1] : ''),
      textoAncora: body.replace(/<[^>]*>/g, ''), // Strip nested tags
    });
  }

  // Replace <a> tags with their text content
  let cleanText = description.replace(/<a\s+[^>]*>(.*?)<\/a>/gi, '$1');

  // Targeted HTML tag removal — safe for texts containing < and > (e.g., "se X < Y")
  const KNOWN_TAGS = /(<\/?(a|span|b|i|em|strong|strike|font|div|p|br|sup|sub|table|tr|td|th|thead|tbody)\b[^>]*>)/gi;
  cleanText = cleanText.replace(KNOWN_TAGS, '');

  // Decode HTML entities
  cleanText = decodeEntities(cleanText);

  return { cleanText, links: links.length > 0 ? links : null };
}
