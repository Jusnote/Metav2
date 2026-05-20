/**
 * PAPIRO — Gerador de seed SQL idempotente a partir de JSON do Arquiteto.
 *
 * Uso:
 *   npx tsx scripts/papiro/generate-seed.ts <caminho-do-json>
 *
 * Exemplo:
 *   npx tsx scripts/papiro/generate-seed.ts \
 *     scripts/papiro/input/informatica_redes.json
 *
 * Fluxo (5 etapas; falha em qualquer aborta sem escrever arquivo):
 *   1. Parse + validate JSON (Zod)
 *   2. Validate invariantes (prefix, prereqs, ciclos, ordem, slugs)
 *   3. Topological sort (defensivo)
 *   4. Emit SQL idempotente
 *   5. Write file em supabase/seed/papiro/<macro_area_slug>.sql
 *
 * O SQL gerado é idempotente:
 *   - UPSERT por slug (disciplina, macro_area, tema)
 *   - DELETE+INSERT de prereqs no escopo da macro_area
 *   - RAISE WARNING para temas órfãos (existem no DB, não no JSON)
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TaxonomiaSchema, type Taxonomia, type Tema } from './schema.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const OUTPUT_DIR = resolve(REPO_ROOT, 'supabase', 'seed', 'papiro');

// ---------------------------------------------------------------------------
// 1. Parse + validate
// ---------------------------------------------------------------------------

function loadAndValidate(jsonPath: string): Taxonomia {
  const raw = readFileSync(jsonPath, 'utf-8');
  const parsed = JSON.parse(raw);
  const result = TaxonomiaSchema.safeParse(parsed);

  if (!result.success) {
    console.error('❌ JSON não bate com o schema do Arquiteto:');
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// 2. Validate invariantes semânticas
// ---------------------------------------------------------------------------

function validateInvariants(tax: Taxonomia): void {
  const errors: string[] = [];
  const { materia, temas_papiro } = tax;

  // 2.1 materia.id tem exatamente 2 segmentos (disciplina.macro_area)
  const materiaSegments = materia.id.split('.');
  if (materiaSegments.length !== 2) {
    errors.push(
      `materia.id "${materia.id}" deve ter exatamente 2 segmentos (disciplina.macro_area)`,
    );
  }

  // 2.2 Cada tema.id começa com materia.id + "."
  const prefix = materia.id + '.';
  for (const t of temas_papiro) {
    if (!t.id.startsWith(prefix)) {
      errors.push(`tema "${t.id}" não começa com "${prefix}" (invariante de prefixo)`);
    }
  }

  // 2.3 ordem_curricular sem duplicata
  const ordens = new Map<number, string[]>();
  for (const t of temas_papiro) {
    const slot = ordens.get(t.ordem_curricular) ?? [];
    slot.push(t.id);
    ordens.set(t.ordem_curricular, slot);
  }
  for (const [ordem, ids] of ordens) {
    if (ids.length > 1) {
      errors.push(`ordem_curricular ${ordem} duplicada em: ${ids.join(', ')}`);
    }
  }

  // 2.4 prereqs referenciam temas que existem no mesmo JSON
  const idSet = new Set(temas_papiro.map((t) => t.id));
  for (const t of temas_papiro) {
    for (const pr of t.pre_requisitos) {
      if (!idSet.has(pr)) {
        errors.push(`tema "${t.id}" tem prereq "${pr}" que não existe no JSON`);
      }
      if (pr === t.id) {
        errors.push(`tema "${t.id}" tem ele mesmo como prereq (auto-prereq)`);
      }
    }
  }

  // 2.5 Sem ciclos (DFS com white/gray/black)
  const adj = new Map<string, string[]>();
  for (const t of temas_papiro) adj.set(t.id, t.pre_requisitos);

  const WHITE = 0,
    GRAY = 1,
    BLACK = 2;
  const color = new Map<string, number>();
  for (const id of idSet) color.set(id, WHITE);

  function dfs(node: string, path: string[]): string[] | null {
    color.set(node, GRAY);
    for (const next of adj.get(node) ?? []) {
      const c = color.get(next);
      if (c === GRAY) {
        return [...path, node, next]; // ciclo encontrado
      }
      if (c === WHITE) {
        const cycle = dfs(next, [...path, node]);
        if (cycle) return cycle;
      }
    }
    color.set(node, BLACK);
    return null;
  }

  for (const id of idSet) {
    if (color.get(id) === WHITE) {
      const cycle = dfs(id, []);
      if (cycle) {
        errors.push(`ciclo de prereqs detectado: ${cycle.join(' → ')}`);
        break;
      }
    }
  }

  if (errors.length > 0) {
    console.error('❌ Invariantes violadas:');
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// 3. Topological sort (defensivo — pra emitir UPSERTs em ordem legível)
// ---------------------------------------------------------------------------

function topoSort(temas: Tema[]): Tema[] {
  // Já temos ordem_curricular validada (sem duplicata). Ordena por ela.
  return [...temas].sort((a, b) => a.ordem_curricular - b.ordem_curricular);
}

// ---------------------------------------------------------------------------
// 4. SQL emitter
// ---------------------------------------------------------------------------

/** Escapa string PostgreSQL: aspas simples → duas aspas simples. */
function sqlString(v: string | null | undefined): string {
  if (v === null || v === undefined) return 'NULL';
  return `'${v.replace(/'/g, "''")}'`;
}

/** Embute um valor JSONB como literal. */
function sqlJsonb(v: unknown): string {
  const json = JSON.stringify(v);
  return `${sqlString(json)}::jsonb`;
}

/** Lista de literais SQL string, separada por vírgula. Vazia → NULL. */
function sqlSlugList(slugs: string[]): string {
  if (slugs.length === 0) return 'NULL';
  return slugs.map((s) => sqlString(s)).join(', ');
}

function emitSql(tax: Taxonomia): string {
  const { materia, temas_papiro } = tax;
  const sortedTemas = topoSort(temas_papiro);
  const disciplinaSlug = materia.id.split('.')[0];
  const macroAreaSlug = materia.id;

  const lines: string[] = [];

  // ----- header -----
  lines.push('-- =====================================================================');
  lines.push(`-- PAPIRO seed — ${materia.disciplina} → ${materia.macro_area}`);
  lines.push(`-- Gerado por scripts/papiro/generate-seed.ts a partir de:`);
  lines.push(`-- ${materia.nome} (versao_taxonomia: ${materia.versao_taxonomia ?? '?'})`);
  lines.push(`-- Total de temas: ${sortedTemas.length}`);
  lines.push('-- Idempotente: rodar 2× = mesmo resultado.');
  lines.push('-- =====================================================================');
  lines.push('');
  lines.push('BEGIN;');
  lines.push('');

  // ----- 1. UPSERT disciplina -----
  lines.push('-- ---------- 1. UPSERT disciplina ----------');
  lines.push(`INSERT INTO papiro.disciplina (nome, slug, ordem)`);
  lines.push(`VALUES (${sqlString(materia.disciplina)}, ${sqlString(disciplinaSlug)}, 0)`);
  lines.push(`ON CONFLICT (slug) DO UPDATE SET`);
  lines.push(`  nome = EXCLUDED.nome;`);
  lines.push('');

  // ----- 2. UPSERT macro_area -----
  lines.push('-- ---------- 2. UPSERT macro_area ----------');
  lines.push(`INSERT INTO papiro.macro_area (disciplina_id, nome, slug, ordem)`);
  lines.push(`SELECT d.id, ${sqlString(materia.macro_area)}, ${sqlString(macroAreaSlug)}, 0`);
  lines.push(`FROM papiro.disciplina d WHERE d.slug = ${sqlString(disciplinaSlug)}`);
  lines.push(`ON CONFLICT (slug) DO UPDATE SET`);
  lines.push(`  nome = EXCLUDED.nome;`);
  lines.push('');

  // ----- 3. UPSERT temas -----
  lines.push('-- ---------- 3. UPSERT temas (ordenados por ordem_curricular) ----------');
  for (const t of sortedTemas) {
    const mapeamentoPaginas = {
      estrategia: t.mapeamento_fontes.estrategia.paginas,
      gran: t.mapeamento_fontes.gran.paginas,
    };
    lines.push(`-- [${t.ordem_curricular}] ${t.nome}`);
    lines.push(`INSERT INTO papiro.tema (`);
    lines.push(`  macro_area_id, slug_hierarquico, nome, descricao_breve,`);
    lines.push(`  objetivo_pedagogico, ordem_curricular, tempo_estudo_min,`);
    lines.push(`  profundidade_estrat, profundidade_gran,`);
    lines.push(`  conceitos_principais, mapeamento_paginas`);
    lines.push(`)`);
    lines.push(`SELECT m.id,`);
    lines.push(`  ${sqlString(t.id)},`);
    lines.push(`  ${sqlString(t.nome)},`);
    lines.push(`  ${sqlString(t.descricao_breve)},`);
    lines.push(`  ${sqlString(t.objetivo_pedagogico)},`);
    lines.push(`  ${t.ordem_curricular}, ${t.tempo_estudo_estimado_minutos},`);
    lines.push(
      `  ${sqlString(t.mapeamento_fontes.estrategia.profundidade)}, ${sqlString(t.mapeamento_fontes.gran.profundidade)},`,
    );
    lines.push(`  ${sqlJsonb(t.conceitos_principais)},`);
    lines.push(`  ${sqlJsonb(mapeamentoPaginas)}`);
    lines.push(`FROM papiro.macro_area m WHERE m.slug = ${sqlString(macroAreaSlug)}`);
    lines.push(`ON CONFLICT (slug_hierarquico) DO UPDATE SET`);
    lines.push(`  nome = EXCLUDED.nome,`);
    lines.push(`  descricao_breve = EXCLUDED.descricao_breve,`);
    lines.push(`  objetivo_pedagogico = EXCLUDED.objetivo_pedagogico,`);
    lines.push(`  ordem_curricular = EXCLUDED.ordem_curricular,`);
    lines.push(`  tempo_estudo_min = EXCLUDED.tempo_estudo_min,`);
    lines.push(`  profundidade_estrat = EXCLUDED.profundidade_estrat,`);
    lines.push(`  profundidade_gran = EXCLUDED.profundidade_gran,`);
    lines.push(`  conceitos_principais = EXCLUDED.conceitos_principais,`);
    lines.push(`  mapeamento_paginas = EXCLUDED.mapeamento_paginas;`);
    lines.push('');
  }

  // ----- 4. DELETE+INSERT prereqs -----
  lines.push('-- ---------- 4. Prereqs: DELETE da macro_area, INSERT do estado atual ----------');
  lines.push(`DELETE FROM papiro.tema_prereq`);
  lines.push(`WHERE tema_id IN (`);
  lines.push(`  SELECT id FROM papiro.tema`);
  lines.push(`  WHERE macro_area_id = (SELECT id FROM papiro.macro_area WHERE slug = ${sqlString(macroAreaSlug)})`);
  lines.push(`);`);
  lines.push('');

  let prereqCount = 0;
  for (const t of sortedTemas) {
    for (const pr of t.pre_requisitos) {
      lines.push(`INSERT INTO papiro.tema_prereq (tema_id, prereq_tema_id)`);
      lines.push(`SELECT t1.id, t2.id FROM papiro.tema t1, papiro.tema t2`);
      lines.push(`WHERE t1.slug_hierarquico = ${sqlString(t.id)} AND t2.slug_hierarquico = ${sqlString(pr)};`);
      prereqCount++;
    }
  }
  lines.push('');
  lines.push(`-- Total de pares prereq emitidos: ${prereqCount}`);
  lines.push('');

  // ----- 5. Warning de órfãos -----
  lines.push('-- ---------- 5. RAISE WARNING para temas órfãos (DB sem JSON) ----------');
  lines.push(`DO $$`);
  lines.push(`DECLARE orfaos TEXT[];`);
  lines.push(`BEGIN`);
  lines.push(`  SELECT array_agg(slug_hierarquico) INTO orfaos`);
  lines.push(`  FROM papiro.tema`);
  lines.push(`  WHERE macro_area_id = (SELECT id FROM papiro.macro_area WHERE slug = ${sqlString(macroAreaSlug)})`);
  lines.push(`    AND slug_hierarquico NOT IN (${sqlSlugList(sortedTemas.map((t) => t.id))});`);
  lines.push(`  IF array_length(orfaos, 1) > 0 THEN`);
  lines.push(`    RAISE WARNING 'PAPIRO: % temas órfãos no DB (não no JSON atual): %',`);
  lines.push(`      array_length(orfaos, 1), orfaos;`);
  lines.push(`  END IF;`);
  lines.push(`END $$;`);
  lines.push('');

  lines.push('COMMIT;');
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function deriveOutputFilename(materiaId: string): string {
  // ex: "informatica.redes_internet" → "informatica_redes.sql"
  // Convenção: substitui pontos por underscores no nome do arquivo
  return materiaId.replace(/\./g, '_') + '.sql';
}

function main() {
  const [, , jsonPathArg] = process.argv;
  if (!jsonPathArg) {
    console.error('Uso: npx tsx scripts/papiro/generate-seed.ts <caminho-do-json>');
    process.exit(2);
  }

  const jsonPath = resolve(process.cwd(), jsonPathArg);
  console.log(`📖 Lendo: ${jsonPath}`);

  const tax = loadAndValidate(jsonPath);
  console.log(
    `   ✓ JSON válido: ${tax.materia.disciplina} → ${tax.materia.macro_area} (${tax.temas_papiro.length} temas)`,
  );

  validateInvariants(tax);
  console.log(`   ✓ Invariantes ok (prefixo, ordem única, prereqs, sem ciclos, slug pattern)`);

  const sql = emitSql(tax);

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const outFile = resolve(OUTPUT_DIR, deriveOutputFilename(tax.materia.id));
  writeFileSync(outFile, sql, 'utf-8');

  console.log(`📝 Seed escrito em: ${outFile}`);
  console.log(`   ${sql.split('\n').length} linhas`);
  console.log(`\nRevise o arquivo e depois cole no SQL Editor do Supabase Studio.`);
}

main();
