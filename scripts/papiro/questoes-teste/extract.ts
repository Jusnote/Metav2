// scripts/papiro/questoes-teste/extract.ts
//
// Extrai questoes de UM assunto da API publica do PAPIRO e salva
// um JSON enxuto (so os campos uteis pra calibrar resumos).
//
// Uso:
//   npx tsx scripts/papiro/questoes-teste/extract.ts \
//     --assunto="Da Competência (arts. 11 a 17 da Lei nº 9.784/1999)" \
//     --banca="CEBRASPE (CESPE)" \
//     --anos=2020,2021,2022,2023,2024,2025 \
//     --limit=100
//
// Modo probe (so 3 questoes, 1+ de cada tipo, pra validar formato):
//   npx tsx scripts/papiro/questoes-teste/extract.ts --probe
//
// Defaults assumem o assunto-alvo do teste atual.

import fs from 'node:fs';
import path from 'node:path';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.projetopapiro.com.br';
const SEARCH = `${API_BASE}/api/v1/questoes/search`;
const RESPONDER = (id: number) => `${API_BASE}/api/v1/questoes/${id}/responder`;

// ---------- CLI ----------

type Args = {
  assunto: string;
  banca: string;
  anos: number[];
  limit: number;
  probe: boolean;
  outDir: string;
};

function parseArgs(argv: string[]): Args {
  const get = (k: string, def?: string) => {
    const hit = argv.find((a) => a.startsWith(`--${k}=`));
    return hit ? hit.slice(`--${k}=`.length) : def;
  };
  const has = (k: string) => argv.includes(`--${k}`);

  const assunto = get('assunto', 'Da Competência (arts. 11 a 17 da Lei nº 9.784/1999)')!;
  const banca = get('banca', 'CEBRASPE (CESPE)')!;
  const anos = (get('anos', '2020,2021,2022,2023,2024,2025') || '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  const limit = Number(get('limit', '100'));
  const probe = has('probe');
  const outDir = get('out-dir', 'scripts/papiro/questoes-teste')!;
  return { assunto, banca, anos, limit, probe, outDir };
}

// ---------- Tipos brutos da API ----------

type QuestaoRaw = {
  id: number;
  enunciado: string;
  alternativas: string[];
  metadata?: {
    materia?: string;
    assunto?: string;
    banca?: string;
    orgao?: string;
    orgao_sigla?: string;
    cargo?: string;
    ano?: number;
  };
  caracteristicas?: {
    tipo?: 'CERTO_ERRADO' | 'MULTIPLA_ESCOLHA' | string;
    formato?: string;
    anulada?: boolean;
    desatualizada?: boolean;
  };
};

type SearchResponse = {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  questoes?: QuestaoRaw[];
  results?: QuestaoRaw[];
};

type ResponderResponse = {
  questao_id: number;
  alternativa_escolhida: number;
  alternativa_correta: number;
  texto_alternativa_correta: string;
  acertou: boolean;
};

// ---------- Saida enxuta ----------

type QuestaoOut = {
  id: number;
  enunciado: string;
  tipoQuestao: 'CERTO_ERRADO' | 'MULTIPLA_ESCOLHA' | string;
  alternativas: string[];
  numeroAlternativaCorreta: number;
  gabarito: string;
  bancaSigla: string;
  concursoAno: number | null;
  nomeAssunto: string;
};

// ---------- Helpers ----------

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function buildSearchUrl(args: Args, page: number, pageLimit: number): string {
  const sp = new URLSearchParams();
  sp.set('assuntos', args.assunto);
  sp.set('bancas', args.banca);
  args.anos.forEach((a) => sp.append('anos', String(a)));
  sp.set('page', String(page));
  sp.set('limit', String(pageLimit));
  // include_html nao precisa: o campo `enunciado` (puro) ja vem limpo.
  return `${SEARCH}?${sp.toString()}`;
}

async function fetchPage(args: Args, page: number, pageLimit: number): Promise<SearchResponse> {
  const url = buildSearchUrl(args, page, pageLimit);
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`search HTTP ${res.status}: ${res.statusText}\nurl: ${url}`);
  return (await res.json()) as SearchResponse;
}

async function fetchGabarito(id: number): Promise<ResponderResponse> {
  const res = await fetch(RESPONDER(id), {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ resposta_usuario: 0 }),
  });
  if (!res.ok) throw new Error(`responder HTTP ${res.status} para id=${id}`);
  return (await res.json()) as ResponderResponse;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function toOut(q: QuestaoRaw, gab: ResponderResponse): QuestaoOut {
  return {
    id: q.id,
    enunciado: q.enunciado,
    tipoQuestao: q.caracteristicas?.tipo ?? 'DESCONHECIDO',
    alternativas: q.alternativas,
    numeroAlternativaCorreta: gab.alternativa_correta,
    gabarito: gab.texto_alternativa_correta,
    bancaSigla: q.metadata?.banca ?? '',
    concursoAno: q.metadata?.ano ?? null,
    nomeAssunto: q.metadata?.assunto ?? '',
  };
}

// ---------- Coleta ----------

async function coletarBruto(args: Args, alvo: number): Promise<QuestaoRaw[]> {
  const acc: QuestaoRaw[] = [];
  const PAGE_SIZE = Math.min(50, alvo);
  let page = 1;
  let totalReportado = -1;

  while (acc.length < alvo) {
    const r = await fetchPage(args, page, PAGE_SIZE);
    if (totalReportado < 0) totalReportado = r.total ?? 0;
    const batch = r.questoes ?? r.results ?? [];
    if (batch.length === 0) break;

    // descartar anuladas/desatualizadas defensivamente
    for (const q of batch) {
      if (q.caracteristicas?.anulada) continue;
      if (q.caracteristicas?.desatualizada) continue;
      acc.push(q);
      if (acc.length >= alvo) break;
    }

    if (page >= (r.total_pages ?? 1)) break;
    page += 1;
  }

  console.log(`[search] total reportado=${totalReportado}, coletadas (uteis)=${acc.length}`);
  return acc;
}

function balancearProbe(brutos: QuestaoRaw[]): QuestaoRaw[] {
  const ce = brutos.find((q) => q.caracteristicas?.tipo === 'CERTO_ERRADO');
  const me = brutos.find((q) => q.caracteristicas?.tipo === 'MULTIPLA_ESCOLHA');
  const extra = brutos.find((q) => q !== ce && q !== me);
  return [ce, me, extra].filter((x): x is QuestaoRaw => !!x);
}

async function enriquecerComGabarito(brutos: QuestaoRaw[]): Promise<QuestaoOut[]> {
  const out: QuestaoOut[] = [];
  for (let i = 0; i < brutos.length; i++) {
    const q = brutos[i];
    try {
      const gab = await fetchGabarito(q.id);
      out.push(toOut(q, gab));
      if ((i + 1) % 10 === 0) console.log(`[gabarito] ${i + 1}/${brutos.length}`);
    } catch (e) {
      console.warn(`[gabarito] falhou id=${q.id}:`, (e as Error).message);
    }
    await sleep(120); // gentil com a API
  }
  return out;
}

// ---------- Main ----------

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  console.log('Argumentos:', { ...args, assunto: args.assunto });

  // No modo probe queremos 1 CE + 1 ME garantidos.
  // Puxamos ate ~25 pra ter chance de mix; depois balanceamos.
  const alvoBruto = args.probe ? 25 : args.limit;
  const brutos = await coletarBruto(args, alvoBruto);

  const selecionados = args.probe ? balancearProbe(brutos) : brutos.slice(0, args.limit);
  console.log(`[selecao] ${selecionados.length} questao(oes) para enriquecer com gabarito`);

  const enriquecidas = await enriquecerComGabarito(selecionados);

  // Salvar
  const slug = slugify(args.assunto);
  const suffix = args.probe ? '.probe' : '';
  const outPath = path.resolve(args.outDir, `${slug}${suffix}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(enriquecidas, null, 2), 'utf8');
  console.log(`\nSalvo em: ${outPath}  (${enriquecidas.length} questoes)`);

  // No modo probe, imprimir no terminal pra inspecao rapida
  if (args.probe) {
    console.log('\n--- PROBE OUTPUT ---');
    console.log(JSON.stringify(enriquecidas, null, 2));
  }
}

main().catch((e) => {
  console.error('Erro:', e);
  process.exit(1);
});
