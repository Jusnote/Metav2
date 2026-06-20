// Testa a rota POST /api/ai/extract-grifos com uma questão REAL do inventário.
// Uso: node scripts/papiro/questoes-teste/test_grifo_route.mjs [id]
//   (precisa do dev server rodando + .env.local com ANTHROPIC_API_KEY e SUPABASE_SERVICE_ROLE_KEY)
import fs from 'node:fs';
import path from 'node:path';

const ID = Number(process.argv[2] || 171306);
const FOLDER = 'D:/inventario-v2/direito-civil/da-responsabilidade-civil-arts-927-a-954';
const URL = process.env.GRIFO_URL || 'http://localhost:3000/api/ai/extract-grifos';

let qs = [];
for (const f of fs.readdirSync(FOLDER)) {
  if (/^lote-\d+\.json$/.test(f)) {
    qs = qs.concat(JSON.parse(fs.readFileSync(path.join(FOLDER, f), 'utf8')));
  }
}
const q = qs.find((x) => x.id === ID);
if (!q) { console.error('questão', ID, 'não encontrada em', FOLDER); process.exit(1); }

// alternativas no inventário são strings → vira [{letter,text}] (igual o card)
const alternativas = q.alternativas.map((text, i) => ({ letter: String.fromCharCode(65 + i), text }));
const payload = {
  questaoId: q.id,
  enunciado: q.enunciado,
  alternativas,
  correta: q.gabarito,
  banca: q.bancaSigla,
  ano: q.concursoAno,
  tipoQuestao: q.tipoQuestao,
};

console.log(`POST ${URL}\n  questão ${ID} · ${q.tipoQuestao} · gabarito "${q.gabarito}"`);
const t0 = Date.now();
const res = await fetch(URL, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(payload),
});
const ms = Date.now() - t0;
const text = await res.text();
console.log(`HTTP ${res.status} (${ms} ms)`);

let json;
try { json = JSON.parse(text); } catch { console.log(text.slice(0, 800)); process.exit(1); }
if (!res.ok) { console.log(JSON.stringify(json, null, 2)); process.exit(1); }

console.log(`cached: ${json.cached}   tipo_estrutura: ${json.tipoEstrutura}`);
const full = q.enunciado + ' ' + q.alternativas.join(' ');
for (const g of json.grifos || []) {
  console.log(`\n[${g.target}] (${g.tipoArmadilha})`);
  console.log(`  GRIFAR: «${g.trecho}»`);
  console.log(`  tooltip: ${g.tooltip}`);
  console.log(`  casa literal? ${full.includes(g.trecho) ? '✓' : '✗ NÃO CASA'}`);
}
console.log(`\ntotal grifos validados: ${(json.grifos || []).length}`);
