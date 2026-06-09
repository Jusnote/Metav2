// Lib pura do extrator de grifo ("comentários do professor").
// Sem rede: a chamada Opus é injetada (`callOpus`) para testes determinísticos.
//
// GUARD CRÍTICO: o front grifa renderizando `trecho` sobre o texto e achando-o
// com `resolveAnchor` (src/components/questoes/highlights/lib/highlight-anchor.ts),
// que usa `full.indexOf(quote)` ESTRITO (sem normalizar espaços). Logo, todo
// `trecho` que persistimos PRECISA ser uma substring literal do texto do target.
// Quando o modelo varia só nos espaços, fazemos SNAP para a substring exata da
// fonte; quando não acha de jeito nenhum, descartamos o grifo.

import type {
  GrifoQuestion,
  GrifoRaw,
  Grifo,
  ExtractResult,
} from './grifos.types';

/**
 * Prompt SYSTEM validado (porta verbatim de
 * scripts/papiro/questoes-teste/pipeline/_grifo_test.py).
 * As 3 regras de localização são o núcleo — não alterar sem bump de PROMPT_VERSION.
 */
export const GRIFO_SYSTEM =
  "Você é o ANOTADOR DE GRIFO do PAPIRO, para o sistema de 'comentários do professor': ele GRIFA " +
  "os trechos ERRADOS de uma questão e, ao passar o mouse, mostra um tooltip explicando a pegadinha.\n\n" +
  "REGRA DE LOCALIZAÇÃO (crucial — varia com a estrutura da questão):\n" +
  "- Se as alternativas (A-E) são afirmações completas → grife nas ALTERNATIVAS erradas.\n" +
  "- Se a questão tem ITENS (I, II, III...) e as alternativas só dizem quais itens estão corretos " +
  "('I e IV', 'apenas II') → grife nos ITENS errados (que estão no enunciado), NÃO nas alternativas.\n" +
  "- Se é CERTO/ERRADO → grife no ENUNCIADO.\n\n" +
  "Para CADA trecho a grifar, devolva:\n" +
  "- local: onde está ('item II', 'item III', 'alternativa C', 'enunciado')\n" +
  "- trecho: a citação EXATA E LITERAL do texto (copie palavra por palavra — a UI precisa achar e grifar)\n" +
  "- tipo_armadilha\n" +
  "- tooltip: explicação curta (o erro + a verdade, com o artigo/súmula)\n\n" +
  'Responda APENAS o JSON, sem crases: {"tipo_estrutura": "...", "grifos": [...]}';

const CONTEXT = 32;

/** Monta a mensagem do usuário no mesmo formato do script de referência. */
export function buildUserMessage(q: GrifoQuestion): string {
  const banca = q.banca ?? '';
  const ano = q.ano ?? '';
  const alternativas = q.alternativas
    .map((a) => `${a.letter}) ${a.text}`)
    .join(' | ');
  return (
    `QUESTÃO (banca ${banca}, ${ano}):\n\n` +
    `ENUNCIADO:\n${q.enunciado}\n\n` +
    `ALTERNATIVAS: ${alternativas}\n` +
    `GABARITO (correta): ${q.correta}\n`
  );
}

/**
 * Tira cercas de markdown (```json ... ``` ou ``` ... ```), faz JSON.parse e
 * tolera campos faltando. Lança erro claro se não for JSON válido.
 */
export function parseGrifos(rawText: string): {
  tipo_estrutura: string | null;
  grifos: GrifoRaw[];
} {
  let txt = rawText.trim();

  // Remove cerca de abertura ```json / ``` e a de fechamento ```.
  if (txt.startsWith('```')) {
    txt = txt.replace(/^```[ \t]*[a-zA-Z]*[ \t]*\r?\n?/, '');
    txt = txt.replace(/\r?\n?```$/, '');
    txt = txt.trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(txt);
  } catch (e) {
    throw new Error(
      `parseGrifos: resposta do modelo não é JSON válido — ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('parseGrifos: JSON não é um objeto');
  }

  const obj = parsed as Record<string, unknown>;
  const tipoRaw = obj.tipo_estrutura;
  const tipo_estrutura =
    typeof tipoRaw === 'string' && tipoRaw.length > 0 ? tipoRaw : null;

  const rawGrifos = Array.isArray(obj.grifos) ? obj.grifos : [];
  const grifos: GrifoRaw[] = rawGrifos.map((g) => {
    const item = (typeof g === 'object' && g !== null ? g : {}) as Record<
      string,
      unknown
    >;
    return {
      local: typeof item.local === 'string' ? item.local : '',
      trecho: typeof item.trecho === 'string' ? item.trecho : '',
      tipo_armadilha:
        typeof item.tipo_armadilha === 'string' ? item.tipo_armadilha : '',
      tooltip: typeof item.tooltip === 'string' ? item.tooltip : '',
    };
  });

  return { tipo_estrutura, grifos };
}

/**
 * 'alternativa C' → 'alt:C' (uppercase); qualquer outro local
 * (item …, enunciado, comando…) → 'enunciado' (itens vivem no enunciado).
 */
export function mapLocalToTarget(local: string): string {
  const m = /alternativa\s+([A-E])/i.exec(local);
  if (m) return `alt:${m[1].toUpperCase()}`;
  return 'enunciado';
}

/** prefix/suffix (≤32 chars) ao redor da 1ª ocorrência literal de `trecho`. */
export function computeContext(
  text: string,
  trecho: string,
): { prefix: string; suffix: string } {
  const idx = text.indexOf(trecho);
  if (idx === -1) return { prefix: '', suffix: '' };
  const prefix = text.slice(Math.max(0, idx - CONTEXT), idx);
  const suffix = text.slice(idx + trecho.length, idx + trecho.length + CONTEXT);
  return { prefix, suffix };
}

/**
 * Acha o trecho no texto da fonte e devolve a SUBSTRING EXATA da fonte (snap).
 *
 * 1. Tentativa literal (`indexOf`) — é o que o `resolveAnchor` faz.
 * 2. Se falhar, casa por espaços normalizados: mapeia cada char não-espaço do
 *    texto para um índice e procura a sequência do trecho ignorando diferenças
 *    de whitespace. Retorna a fatia exata `text.slice(start, end)` — garantida
 *    de ser achada pelo `indexOf` estrito do front.
 *
 * Retorna `null` se não casar de nenhum jeito (grifo descartado).
 */
function snapTrecho(text: string, trecho: string): string | null {
  if (!trecho) return null;

  // 1. Casamento literal — caminho feliz.
  if (text.indexOf(trecho) !== -1) return trecho;

  // 2. Casamento por whitespace normalizado.
  // Coleta os chars não-espaço do trecho (a "assinatura" a procurar).
  const isWs = (c: string) => /\s/.test(c);
  const needleChars: string[] = [];
  for (const ch of trecho) if (!isWs(ch)) needleChars.push(ch);
  if (needleChars.length === 0) return null;

  // Lista de chars não-espaço do texto, com seu índice na string original.
  const textNonWs: { ch: string; idx: number }[] = [];
  for (let i = 0; i < text.length; i++) {
    if (!isWs(text[i])) textNonWs.push({ ch: text[i], idx: i });
  }

  // Procura a subsequência contígua (ignorando espaços) de needleChars em textNonWs.
  for (let s = 0; s + needleChars.length <= textNonWs.length; s++) {
    let ok = true;
    for (let k = 0; k < needleChars.length; k++) {
      if (textNonWs[s + k].ch !== needleChars[k]) {
        ok = false;
        break;
      }
    }
    if (ok) {
      const start = textNonWs[s].idx;
      const end = textNonWs[s + needleChars.length - 1].idx + 1;
      const snapped = text.slice(start, end);
      // Sanidade: a fatia da fonte tem de ser achável por indexOf estrito.
      if (text.indexOf(snapped) !== -1) return snapped;
      return null;
    }
  }

  return null;
}

/**
 * Pipeline puro do extrator. `callOpus(system, user)` é injetado (testes mockam).
 *
 * Passos: monta msg → chama Opus → parse → para cada grifo: roteia local→target,
 * busca o texto do target, GUARDA (snap literal — espelha resolveAnchor) ou
 * DESCARTA, calcula prefix/suffix. Devolve só os grifos validados.
 */
export async function extractGrifos(
  q: GrifoQuestion,
  callOpus: (system: string, user: string) => Promise<string>,
): Promise<ExtractResult> {
  const user = buildUserMessage(q);
  const rawText = await callOpus(GRIFO_SYSTEM, user);
  const { tipo_estrutura, grifos } = parseGrifos(rawText);

  // Mapa target → texto-fonte (o mesmo texto que o front renderiza por bloco).
  const textByTarget: Record<string, string> = { enunciado: q.enunciado };
  for (const alt of q.alternativas) {
    textByTarget[`alt:${alt.letter.toUpperCase()}`] = alt.text;
  }

  const validated: Grifo[] = [];
  for (const g of grifos) {
    const target = mapLocalToTarget(g.local);
    const targetText = textByTarget[target];
    if (typeof targetText !== 'string') continue; // target inexistente → descarta

    const snapped = snapTrecho(targetText, g.trecho);
    if (snapped === null) continue; // não casa nem após snap → descarta

    const { prefix, suffix } = computeContext(targetText, snapped);
    validated.push({
      target,
      trecho: snapped,
      prefix,
      suffix,
      tipoArmadilha: g.tipo_armadilha,
      tooltip: g.tooltip,
    });
  }

  return { tipoEstrutura: tipo_estrutura, grifos: validated };
}
