import type { Dispositivo } from '@/types/lei-api';

export type DispositivoBlock =
  | { kind: 'structural'; item: Dispositivo; label?: Dispositivo }
  | { kind: 'article'; item: Dispositivo; children: Dispositivo[] }
  | { kind: 'orphan'; item: Dispositivo };

// Marcadores estruturais "fortes" (LIVRO I, TÍTULO I, CAPÍTULO I…). SUBTITULO
// historicamente serve de label do estrutural anterior na API (ex: depois de "LIVRO I"
// vem SUBTITULO "DAS PESSOAS"). Por isso é tratado separadamente abaixo.
const STRUCTURAL_TIPOS = new Set([
  'PARTE',
  'LIVRO',
  'TITULO',
  'CAPITULO',
  'SECAO',
  'SUBSECAO',
]);

const ARTICLE_CHILD_TIPOS = new Set([
  'CAPUT',
  'PARAGRAFO',
  'INCISO',
  'ALINEA',
  'PENA',
]);

const SKIP_TIPOS = new Set(['EMENTA', 'PREAMBULO']);

function isSkippable(item: Dispositivo): boolean {
  if (SKIP_TIPOS.has(item.tipo)) return true;
  if (item.tipo === 'EPIGRAFE' && /^(ÍNDICE|índice|\.|[*])$/i.test(item.texto.trim())) return true;
  return false;
}

export function groupDispositivos(dispositivos: Dispositivo[]): DispositivoBlock[] {
  const blocks: DispositivoBlock[] = [];
  let currentArticle: { item: Dispositivo; children: Dispositivo[] } | null = null;

  // Pré-processa pra ter "próximo dispositivo significativo" pra cada item — usado
  // pra decidir se uma EPIGRAFE labela o próximo ARTIGO (e portanto deve ser ignorada,
  // porque ARTIGO.epigrafe duplica a info) ou é sub-rubrica do artigo corrente.
  const filtered = dispositivos.filter((d) => !isSkippable(d));

  for (let i = 0; i < filtered.length; i++) {
    const item = filtered[i];

    if (item.tipo === 'ARTIGO') {
      if (currentArticle) blocks.push({ kind: 'article', ...currentArticle });
      currentArticle = { item, children: [] };
      continue;
    }

    if (STRUCTURAL_TIPOS.has(item.tipo)) {
      if (currentArticle) {
        blocks.push({ kind: 'article', ...currentArticle });
        currentArticle = null;
      }
      // Lookahead: se o próximo é SUBTITULO, é o label deste estrutural — empareelha.
      const next = filtered[i + 1];
      if (next?.tipo === 'SUBTITULO') {
        blocks.push({ kind: 'structural', item, label: next });
        i++; // consome o SUBTITULO
      } else {
        blocks.push({ kind: 'structural', item });
      }
      continue;
    }

    // SUBTITULO solto (sem estrutural antes) — trata como header de fallback.
    if (item.tipo === 'SUBTITULO') {
      if (currentArticle) {
        blocks.push({ kind: 'article', ...currentArticle });
        currentArticle = null;
      }
      blocks.push({ kind: 'structural', item });
      continue;
    }

    if (ARTICLE_CHILD_TIPOS.has(item.tipo)) {
      if (currentArticle) {
        currentArticle.children.push(item);
      } else {
        blocks.push({ kind: 'orphan', item });
      }
      continue;
    }

    // EPIGRAFE: se vem imediatamente antes de um ARTIGO, é o "marginal heading" daquele
    // artigo — pula porque ARTIGO.epigrafe field traz o mesmo conteúdo (e renderizamos
    // no header inline). Caso contrário (entre filhos de um artigo), é sub-rubrica.
    if (item.tipo === 'EPIGRAFE') {
      const next = filtered[i + 1];
      if (next?.tipo === 'ARTIGO') {
        if (currentArticle) {
          blocks.push({ kind: 'article', ...currentArticle });
          currentArticle = null;
        }
        continue;
      }
      if (currentArticle) {
        currentArticle.children.push(item);
      } else {
        blocks.push({ kind: 'orphan', item });
      }
      continue;
    }

    // Outros tipos desconhecidos: se dentro de artigo, fica como child; senão órfão.
    if (currentArticle) {
      currentArticle.children.push(item);
    } else {
      blocks.push({ kind: 'orphan', item });
    }
  }

  if (currentArticle) blocks.push({ kind: 'article', ...currentArticle });

  return blocks;
}
