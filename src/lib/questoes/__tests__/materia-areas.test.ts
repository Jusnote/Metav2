import { describe, it, expect } from 'vitest';
import { MATERIA_AREAS, getAreaForMateria, groupMateriasByArea } from '../materia-areas';

const ALL_MATERIAS_FROM_BACKEND = [
  'AFO, Direito Financeiro e Contabilidade Pública',
  'Administração Geral e Pública',
  'Administração de Recursos Materiais',
  'Arquitetura',
  'Arquivologia',
  'Artes e Música',
  'Atualidades e Conhecimentos Gerais',
  'Auditoria Governamental e Controle',
  'Biblioteconomia',
  'Biologia e Biomedicina',
  'Comunicação Social',
  'Contabilidade Geral',
  'Criminalística e Medicina Legal',
  'Desenho Técnico e Artes Gráficas',
  'Direito Administrativo',
  'Direito Administrativo Municipal',
  'Direito Agrário',
  'Direito Ambiental',
  'Direito Civil',
  'Direito Constitucional',
  'Direito Constitucional Municipal',
  'Direito Cultural, Desportivo e da Comunicação',
  'Direito Digital',
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
  'Direito Processual Penal',
  'Direito Processual Penal Militar',
  'Direito Processual do Trabalho',
  'Direito Sanitário e Saúde',
  'Direito Tributário',
  'Direito Urbanístico',
  'Direito da Criança e do Adolescente',
  'Direito do Consumidor',
  'Direito do Trabalho',
  'Direitos Humanos',
  'Economia e Finanças Públicas',
  'Educação Física',
  'Enfermagem',
  'Engenharia Agronômica e Agrícola',
  'Engenharia Ambiental, Florestal e Sanitária',
  'Engenharia Civil e Auditoria de Obras',
  'Engenharia Elétrica e Eletrônica',
  'Engenharia Mecânica',
  'Estatística',
  'Farmácia',
  'Filosofia e Teologia',
  'Fisioterapia',
  'Fonoaudiologia',
  'Física',
  'Geografia',
  'História',
  'Informática',
  'Legislação Aduaneira',
  'Legislação Civil e Processual Civil Especial',
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
  'Legislação Tributária Federal',
  'Legislação Tributária dos Estados e do Distrito Federal',
  'Legislação Tributária dos Municípios',
  'Legislação das Casas Legislativas',
  'Legislação de Trânsito e Transportes',
  'Legislação e Ética Profissional',
  'Libras e Inclusão',
  'Língua Inglesa (Inglês)',
  'Língua Portuguesa (Português)',
  'Matemática',
  'Matemática Financeira',
  'Medicina',
  'Nutrição, Gastronomia e Engenharia de Alimentos',
  'Odontologia',
  'Pedagogia',
  'Psicologia',
  'Química e Engenharia Química',
  'Raciocínio Lógico',
  'Segurança Privada e Transportes',
  'Segurança e Saúde no Trabalho (SST)',
  'Serviço Social',
  'TI - Banco de Dados',
  'TI - Desenvolvimento de Sistemas',
  'TI - Engenharia de Software',
  'TI - Organização e Arquitetura dos Computadores',
  'TI - Redes de Computadores',
  'TI - Segurança da Informação',
  'TI - Sistemas Operacionais',
  'Teoria Geral, Filosofia e Sociologia Jurídica',
  'Veterinária e Zootecnia',
];

describe('materia-areas', () => {
  it('total de 104 matérias no backend (sanity)', () => {
    expect(ALL_MATERIAS_FROM_BACKEND).toHaveLength(104);
  });

  it('toda matéria do backend está mapeada (nenhuma cai em "Outros")', () => {
    const unmapped = ALL_MATERIAS_FROM_BACKEND.filter(
      (m) => getAreaForMateria(m).area === 'Outros',
    );
    expect(unmapped).toEqual([]);
  });

  it('matérias só aparecem em uma área', () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const area of MATERIA_AREAS) {
      const mats = area.subgroups
        ? area.subgroups.flatMap((sg) => sg.materias)
        : (area.materias ?? []);
      for (const m of mats) {
        if (seen.has(m)) dupes.push(m);
        seen.add(m);
      }
    }
    expect(dupes).toEqual([]);
  });

  it('soma de matérias mapeadas = 104', () => {
    const total = MATERIA_AREAS.reduce((sum, area) => {
      if (area.subgroups) {
        return sum + area.subgroups.reduce((s, sg) => s + sg.materias.length, 0);
      }
      return sum + (area.materias?.length ?? 0);
    }, 0);
    expect(total).toBe(104);
  });

  describe('getAreaForMateria', () => {
    it('Direito Administrativo → Direito e Legislação / Direito', () => {
      const r = getAreaForMateria('Direito Administrativo');
      expect(r.area).toBe('Direito e Legislação');
      expect(r.subgroup).toBe('Direito');
    });

    it('Legislação Federal → Direito e Legislação / Legislação', () => {
      const r = getAreaForMateria('Legislação Geral Federal');
      expect(r.area).toBe('Direito e Legislação');
      expect(r.subgroup).toBe('Legislação');
    });

    it('Medicina → Saúde (sem sub-grupo)', () => {
      const r = getAreaForMateria('Medicina');
      expect(r.area).toBe('Saúde');
      expect(r.subgroup).toBeUndefined();
    });

    it('Matéria desconhecida → Outros', () => {
      const r = getAreaForMateria('Esoterismo Aplicado');
      expect(r.area).toBe('Outros');
    });
  });

  describe('groupMateriasByArea', () => {
    it('agrupa items por área canônica', () => {
      const items = [
        { id: 'Medicina', label: 'Medicina' },
        { id: 'Direito Civil', label: 'Direito Civil' },
        { id: 'Língua Portuguesa (Português)', label: 'Língua Portuguesa (Português)' },
      ];
      const groups = groupMateriasByArea(items);
      expect(groups).toHaveLength(3);
      // Ordem canônica: Direito > Linguagens > Saúde
      expect(groups[0].area).toBe('Direito e Legislação');
      expect(groups[0].subgroup).toBe('Direito');
      expect(groups[1].area).toBe('Linguagens');
      expect(groups[2].area).toBe('Saúde');
    });

    it('separa Direito de Legislação dentro de "Direito e Legislação"', () => {
      const items = [
        { id: 'Direito Penal', label: 'Direito Penal' },
        { id: 'Legislação Aduaneira', label: 'Legislação Aduaneira' },
      ];
      const groups = groupMateriasByArea(items);
      expect(groups).toHaveLength(2);
      expect(groups[0].area).toBe('Direito e Legislação');
      expect(groups[0].subgroup).toBe('Direito');
      expect(groups[1].area).toBe('Direito e Legislação');
      expect(groups[1].subgroup).toBe('Legislação');
    });

    it('items dentro de cada grupo ficam em ordem alfabética', () => {
      const items = [
        { id: 'Medicina', label: 'Medicina' },
        { id: 'Enfermagem', label: 'Enfermagem' },
        { id: 'Farmácia', label: 'Farmácia' },
      ];
      const groups = groupMateriasByArea(items);
      expect(groups[0].items.map((i) => i.id)).toEqual([
        'Enfermagem',
        'Farmácia',
        'Medicina',
      ]);
    });
  });
});
