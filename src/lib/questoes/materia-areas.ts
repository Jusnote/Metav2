/**
 * Mapeamento canônico de matérias → áreas para agrupar a lista do picker
 * "Disciplina → Assunto". Substitui o agrupamento por inicial do alfabeto.
 *
 * Regras:
 * - Toda matéria do dicionário do app deve estar em exatamente uma área.
 * - "Direito e Legislação" tem 2 sub-grupos visíveis (Direito | Legislação).
 * - Matérias sem mapeamento caem na área genérica "Outros" (defensivo —
 *   não deveria acontecer; é fallback caso o backend introduza nova matéria).
 */

export interface MateriaSubGroup {
  name: string;
  materias: string[];
}

export interface MateriaArea {
  name: string;
  subgroups?: MateriaSubGroup[];
  materias?: string[];
}

export const MATERIA_AREAS: MateriaArea[] = [
  {
    name: 'Direito e Legislação',
    subgroups: [
      {
        name: 'Direito',
        materias: [
          'Criminalística e Medicina Legal',
          'Direito Administrativo',
          'Direito Administrativo Municipal',
          'Direito Agrário',
          'Direito Ambiental',
          'Direito Civil',
          'Direito Constitucional',
          'Direito Constitucional Municipal',
          'Direito Cultural, Desportivo e da Comunicação',
          'Direito da Criança e do Adolescente',
          'Direito Digital',
          'Direito do Consumidor',
          'Direito do Trabalho',
          'Direito Econômico',
          'Direito Educacional',
          'Direito Eleitoral',
          'Direito Empresarial (Comercial)',
          'Direito Internacional Público e Privado',
          'Direito Marítimo, Portuário e Aeronáutico',
          'Direito Notarial e Registral',
          'Direito Penal',
          'Direito Penal Militar',
          'Direito Previdenciário',
          'Direito Processual Civil',
          'Direito Processual do Trabalho',
          'Direito Processual Penal',
          'Direito Processual Penal Militar',
          'Direito Sanitário e Saúde',
          'Direito Tributário',
          'Direito Urbanístico',
          'Direitos Humanos',
          'Teoria Geral, Filosofia e Sociologia Jurídica',
        ],
      },
      {
        name: 'Legislação',
        materias: [
          'Legislação Aduaneira',
          'Legislação Civil e Processual Civil Especial',
          'Legislação das Casas Legislativas',
          'Legislação de Trânsito e Transportes',
          'Legislação e Ética Profissional',
          'Legislação Específica das Agências Reguladoras',
          'Legislação Específica das Defensorias Públicas',
          'Legislação Específica das Procuradorias (Advocacias Públicas)',
          'Legislação Específica dos Ministérios Públicos',
          'Legislação Específica dos Tribunais Estaduais',
          'Legislação Específica dos Tribunais Federais',
          'Legislação Geral Estadual e do DF',
          'Legislação Geral Federal',
          'Legislação Geral Municipal',
          'Legislação Militar',
          'Legislação Penal e Processual Penal Especial',
          'Legislação Tributária dos Estados e do Distrito Federal',
          'Legislação Tributária dos Municípios',
          'Legislação Tributária Federal',
        ],
      },
    ],
  },
  {
    name: 'Linguagens',
    materias: [
      'Libras e Inclusão',
      'Língua Inglesa (Inglês)',
      'Língua Portuguesa (Português)',
    ],
  },
  {
    name: 'Informática e Tecnologia',
    materias: [
      'Informática',
      'TI - Banco de Dados',
      'TI - Desenvolvimento de Sistemas',
      'TI - Engenharia de Software',
      'TI - Organização e Arquitetura dos Computadores',
      'TI - Redes de Computadores',
      'TI - Segurança da Informação',
      'TI - Sistemas Operacionais',
    ],
  },
  {
    name: 'Exatas',
    materias: [
      'Estatística',
      'Física',
      'Matemática',
      'Matemática Financeira',
      'Raciocínio Lógico',
    ],
  },
  {
    name: 'Contabilidade, Auditoria e Economia',
    materias: [
      'AFO, Direito Financeiro e Contabilidade Pública',
      'Auditoria Governamental e Controle',
      'Contabilidade Geral',
      'Economia e Finanças Públicas',
    ],
  },
  {
    name: 'Engenharias e Arquitetura',
    materias: [
      'Arquitetura',
      'Desenho Técnico e Artes Gráficas',
      'Engenharia Agronômica e Agrícola',
      'Engenharia Ambiental, Florestal e Sanitária',
      'Engenharia Civil e Auditoria de Obras',
      'Engenharia Elétrica e Eletrônica',
      'Engenharia Mecânica',
      'Química e Engenharia Química',
    ],
  },
  {
    name: 'Administração e Gestão',
    materias: [
      'Administração de Recursos Materiais',
      'Administração Geral e Pública',
      'Segurança Privada e Transportes',
    ],
  },
  {
    name: 'Humanas e Sociais',
    materias: [
      'Arquivologia',
      'Artes e Música',
      'Atualidades e Conhecimentos Gerais',
      'Biblioteconomia',
      'Comunicação Social',
      'Filosofia e Teologia',
      'Geografia',
      'História',
      'Pedagogia',
      'Serviço Social',
    ],
  },
  {
    name: 'Saúde',
    materias: [
      'Biologia e Biomedicina',
      'Educação Física',
      'Enfermagem',
      'Farmácia',
      'Fisioterapia',
      'Fonoaudiologia',
      'Medicina',
      'Nutrição, Gastronomia e Engenharia de Alimentos',
      'Odontologia',
      'Psicologia',
      'Segurança e Saúde no Trabalho (SST)',
      'Veterinária e Zootecnia',
    ],
  },
];

const FALLBACK_AREA = 'Outros';

interface MateriaInfo {
  area: string;
  subgroup?: string;
  /** Posição canônica da área (índice em MATERIA_AREAS). */
  areaIndex: number;
  /** Posição canônica do sub-grupo (índice dentro da área). 0 se sem sub-grupo. */
  subgroupIndex: number;
}

const lookupCache = (() => {
  const map = new Map<string, MateriaInfo>();
  MATERIA_AREAS.forEach((area, areaIndex) => {
    if (area.subgroups) {
      area.subgroups.forEach((sg, subgroupIndex) => {
        for (const m of sg.materias) {
          map.set(m, { area: area.name, subgroup: sg.name, areaIndex, subgroupIndex });
        }
      });
    } else if (area.materias) {
      for (const m of area.materias) {
        map.set(m, { area: area.name, areaIndex, subgroupIndex: 0 });
      }
    }
  });
  return map;
})();

/** Retorna área (e sub-grupo) de uma matéria, ou fallback "Outros" se desconhecida. */
export function getAreaForMateria(materia: string): MateriaInfo {
  return (
    lookupCache.get(materia) ?? {
      area: FALLBACK_AREA,
      areaIndex: Number.MAX_SAFE_INTEGER,
      subgroupIndex: 0,
    }
  );
}

export interface AreaGroup<T> {
  area: string;
  subgroup?: string;
  items: T[];
}

/**
 * Agrupa items (com .id sendo o nome da matéria) por área canônica.
 * Retorna lista plana de tuples `(área, sub-grupo?, items)` na ordem
 * definida em MATERIA_AREAS. Items dentro de cada grupo ordenados
 * alfabeticamente por id.
 */
export function groupMateriasByArea<T extends { id: string }>(
  items: T[],
): AreaGroup<T>[] {
  const buckets = new Map<string, AreaGroup<T> & { _areaIdx: number; _subIdx: number }>();
  for (const item of items) {
    const info = getAreaForMateria(item.id);
    const key = `${info.areaIndex}|${info.subgroupIndex}|${info.area}|${info.subgroup ?? ''}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        area: info.area,
        subgroup: info.subgroup,
        items: [],
        _areaIdx: info.areaIndex,
        _subIdx: info.subgroupIndex,
      };
      buckets.set(key, bucket);
    }
    bucket.items.push(item);
  }
  return Array.from(buckets.values())
    .sort((a, b) => {
      if (a._areaIdx !== b._areaIdx) return a._areaIdx - b._areaIdx;
      return a._subIdx - b._subIdx;
    })
    .map(({ area, subgroup, items }) => ({
      area,
      subgroup,
      items: [...items].sort((x, y) => x.id.localeCompare(y.id, 'pt-BR')),
    }));
}
