/**
 * Estrutura oficial do Exame de Ordem (OAB) FGV — 1ª Fase.
 *
 * Substitui o agrupamento canônico por área quando a carreira "OAB" está
 * ativa. Mostra apenas as 20 matérias cobradas no exame, agrupadas em
 * Grupo A / B / C conforme regulamento da OAB.
 *
 * Total: 80 questões (38 + 24 + 18).
 */

export interface OABGrupo {
  name: string;
  materias: string[];
}

export const OAB_GRUPOS: OABGrupo[] = [
  {
    name: 'Grupo A',
    materias: [
      'Legislação e Ética Profissional',
      'Direito Civil',
      'Direito Processual Civil',
      'Direito Constitucional',
      'Direito Penal',
      'Direito Processual Penal',
    ],
  },
  {
    name: 'Grupo B',
    materias: [
      'Direito Administrativo',
      'Direito do Trabalho',
      'Direito Processual do Trabalho',
      'Direito Tributário',
      'Direito Empresarial (Comercial)',
    ],
  },
  {
    name: 'Grupo C',
    materias: [
      'Direitos Humanos',
      'Direito Internacional Público e Privado',
      'Direito da Criança e do Adolescente',
      'Direito Ambiental',
      'Direito do Consumidor',
      'Teoria Geral, Filosofia e Sociologia Jurídica',
      'Direito Previdenciário',
      'AFO, Direito Financeiro e Contabilidade Pública',
      'Direito Eleitoral',
    ],
  },
];

const oabLookup = (() => {
  const m = new Map<string, { grupo: string; grupoIdx: number }>();
  OAB_GRUPOS.forEach((g, i) => {
    for (const mat of g.materias) m.set(mat, { grupo: g.name, grupoIdx: i });
  });
  return m;
})();

export function isOABMateria(materia: string): boolean {
  return oabLookup.has(materia);
}

export interface OABAreaGroup<T> {
  area: string;
  items: T[];
}

/**
 * Agrupa items por Grupo OAB (A/B/C). Items com matéria fora da OAB são
 * ignorados (filtrados out).
 */
export function groupMateriasByOABGrupo<T extends { id: string }>(
  items: T[],
): OABAreaGroup<T>[] {
  const buckets = new Map<string, OABAreaGroup<T> & { _idx: number }>();
  for (const item of items) {
    const info = oabLookup.get(item.id);
    if (!info) continue;
    let bucket = buckets.get(info.grupo);
    if (!bucket) {
      bucket = { area: info.grupo, items: [], _idx: info.grupoIdx };
      buckets.set(info.grupo, bucket);
    }
    bucket.items.push(item);
  }
  return Array.from(buckets.values())
    .sort((a, b) => a._idx - b._idx)
    .map(({ area, items }) => ({
      area,
      items: [...items].sort((x, y) => {
        const ix = OAB_GRUPOS.find((g) => g.name === area)?.materias.indexOf(x.id) ?? 0;
        const iy = OAB_GRUPOS.find((g) => g.name === area)?.materias.indexOf(y.id) ?? 0;
        return ix - iy;
      }),
    }));
}
