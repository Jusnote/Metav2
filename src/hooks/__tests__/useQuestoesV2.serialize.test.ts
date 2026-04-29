import { describe, it, expect } from 'vitest';
import { buildSearchURL } from '../useQuestoesV2';

// Guard against the bug from the abandoned GRAN attempt:
// fetchQuestoes was missing nodeIds serialization — the picker updated the URL
// state but the actual API call ignored it entirely, so results never changed.

describe('buildSearchURL', () => {
  it('serializa nodeIds como múltiplos ?node=', () => {
    const url = buildSearchURL({
      filters: {
        materias: ['Direito Administrativo'],
        nodeIds: [101, 102, 'outros'],
      } as any,
      page: 1,
      limit: 20,
    });
    expect(url).toContain('node=101');
    expect(url).toContain('node=102');
    expect(url).toContain('node=outros');
  });

  it('omite ?node= quando nodeIds está vazio', () => {
    const url = buildSearchURL({
      filters: { materias: ['Direito Administrativo'], nodeIds: [] } as any,
      page: 1,
      limit: 20,
    });
    expect(url).not.toContain('node=');
  });

  it('serializa todos os filtros existentes sem regressão', () => {
    const url = buildSearchURL({
      filters: {
        materias: ['Direito Penal'],
        assuntos: ['Crimes contra a pessoa'],
        bancas: ['CESPE'],
        anos: [2022, 2023],
        orgaos: ['PF'],
        cargos: ['Agente'],
        excluirAnuladas: true,
        excluirDesatualizadas: false,
        excluirResolvidas: true,
        nodeIds: [],
      },
      query: 'habeas corpus',
      tab: 'nao_resolvidas',
      sortBy: 'dificuldade',
      page: 2,
      limit: 10,
    });
    expect(url).toContain('materias=Direito+Penal');
    expect(url).toContain('bancas=CESPE');
    expect(url).toContain('anos=2022');
    expect(url).toContain('anos=2023');
    expect(url).toContain('excluir_anuladas=1');
    expect(url).toContain('excluir_resolvidas=1');
    expect(url).not.toContain('excluir_desatualizadas');
    expect(url).toContain('q=habeas');
    expect(url).toContain('status=nao_resolvidas');
    expect(url).toContain('order_by=dificuldade');
    expect(url).toContain('page=2');
    expect(url).toContain('limit=10');
    expect(url).not.toContain('node=');
  });
});
