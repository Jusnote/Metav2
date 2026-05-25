import { describe, it, expect } from 'vitest';
import { deriveEstrutura, findCurrentNodeId } from './derive-estrutura';
import type { Dispositivo, HierarquiaNode } from '@/types/lei-api';
import type { DispositivoStatus } from '@/hooks/useDispositivoUserStatus';

function disp(partial: Partial<Dispositivo> & { id: string; tipo: string; posicao: number; path?: string | null }): Dispositivo {
  return {
    numero: null,
    texto: '',
    epigrafe: null,
    pena: null,
    anotacoes: null,
    links: null,
    revogado: false,
    path: partial.path ?? null,
    ...partial,
  };
}

describe('deriveEstrutura', () => {
  it('hierarquia vazia → []', () => {
    expect(deriveEstrutura([], [], undefined)).toEqual([]);
  });

  it('1 TÍTULO com artigos diretos (sem capítulos) — soma artigos pelo path', () => {
    const hierarquia: HierarquiaNode[] = [
      { tipo: 'TITULO', descricao: 'TÍTULO I', subtitulo: 'Da Aplicação da Lei Penal', path: 'tit-i', filhos: [] },
    ];
    const dispositivos = [
      disp({ id: 'a1', tipo: 'ARTIGO', numero: '1', posicao: 1, path: 'tit-i' }),
      disp({ id: 'a2', tipo: 'ARTIGO', numero: '2', posicao: 2, path: 'tit-i' }),
    ];
    const result = deriveEstrutura(hierarquia, dispositivos, undefined);
    expect(result).toHaveLength(1);
    expect(result[0].tipo).toBe('TITULO');
    expect(result[0].descricao).toBe('TÍTULO I');
    expect(result[0].subtitulo).toBe('Da Aplicação da Lei Penal');
    expect(result[0].totalArtigos).toBe(2);
    expect(result[0].rangeLabel).toBe('Arts. 1 a 2');
    expect(result[0].primeiroArtigoId).toBe('a1');
    expect(result[0].depth).toBe(0);
  });

  it('PARTE → TÍTULO com CAPÍTULO (3 níveis) — depth correto + agregação recursiva', () => {
    const hierarquia: HierarquiaNode[] = [
      {
        tipo: 'PARTE',
        descricao: 'PARTE GERAL',
        path: 'pg',
        filhos: [
          {
            tipo: 'TITULO',
            descricao: 'TÍTULO IV',
            subtitulo: 'Das Penas',
            path: 'tit-iv',
            filhos: [
              { tipo: 'CAPITULO', descricao: 'CAPÍTULO I', subtitulo: 'Espécies', path: 'cap-i', filhos: [] },
              { tipo: 'CAPITULO', descricao: 'CAPÍTULO II', subtitulo: 'Cominação', path: 'cap-ii', filhos: [] },
            ],
          },
        ],
      },
    ];
    const dispositivos = [
      disp({ id: 'a32', tipo: 'ARTIGO', numero: '32', posicao: 1, path: 'pg/tit-iv/cap-i' }),
      disp({ id: 'a33', tipo: 'ARTIGO', numero: '33', posicao: 2, path: 'pg/tit-iv/cap-i' }),
      disp({ id: 'a53', tipo: 'ARTIGO', numero: '53', posicao: 3, path: 'pg/tit-iv/cap-ii' }),
    ];
    const result = deriveEstrutura(hierarquia, dispositivos, undefined);
    expect(result).toHaveLength(4);
    expect(result[0]).toMatchObject({ tipo: 'PARTE', depth: 0, totalArtigos: 3, artigosDiretos: 0 });
    expect(result[1]).toMatchObject({ tipo: 'TITULO', depth: 1, totalArtigos: 3, artigosDiretos: 0 });
    expect(result[2]).toMatchObject({ tipo: 'CAPITULO', depth: 2, totalArtigos: 2, artigosDiretos: 2, rangeLabel: 'Arts. 32 a 33' });
    expect(result[3]).toMatchObject({ tipo: 'CAPITULO', depth: 2, totalArtigos: 1, artigosDiretos: 1, rangeLabel: 'Art. 53' });
  });

  it('% estudado conta só "estudado" (revisar/decorar fora)', () => {
    const hierarquia: HierarquiaNode[] = [
      { tipo: 'CAPITULO', descricao: 'Cap I', path: 'cap-i', filhos: [] },
    ];
    const dispositivos = [
      disp({ id: 'a1', tipo: 'ARTIGO', numero: '1', posicao: 1, path: 'cap-i' }),
      disp({ id: 'a2', tipo: 'ARTIGO', numero: '2', posicao: 2, path: 'cap-i' }),
      disp({ id: 'a3', tipo: 'ARTIGO', numero: '3', posicao: 3, path: 'cap-i' }),
      disp({ id: 'a4', tipo: 'ARTIGO', numero: '4', posicao: 4, path: 'cap-i' }),
    ];
    const status = new Map<string, DispositivoStatus>([
      ['a1', 'estudado'],
      ['a2', 'estudado'],
      ['a3', 'revisar'],
      ['a4', 'decorar'],
    ]);
    const result = deriveEstrutura(hierarquia, dispositivos, status);
    expect(result[0].estudados).toBe(2);
    expect(result[0].pctEstudado).toBe(50);
  });

  it('SECAO/SUBSECAO entram na lista (são contêineres legítimos)', () => {
    const hierarquia: HierarquiaNode[] = [
      {
        tipo: 'CAPITULO',
        descricao: 'CAPÍTULO I',
        path: 'cap-i',
        filhos: [
          {
            tipo: 'SECAO',
            descricao: 'SEÇÃO I',
            path: 'sec-i',
            filhos: [
              { tipo: 'SUBSECAO', descricao: 'SUBSEÇÃO I', path: 'sub-i', filhos: [] },
            ],
          },
        ],
      },
    ];
    const dispositivos = [
      disp({ id: 'a1', tipo: 'ARTIGO', numero: '1', posicao: 1, path: 'cap-i/sec-i/sub-i' }),
    ];
    const result = deriveEstrutura(hierarquia, dispositivos, undefined);
    expect(result.map((n) => n.tipo)).toEqual(['CAPITULO', 'SECAO', 'SUBSECAO']);
    expect(result.map((n) => n.depth)).toEqual([0, 1, 2]);
    // Todos devem agregar o mesmo artigo (1)
    expect(result.every((n) => n.totalArtigos === 1)).toBe(true);
  });

  it('artigosDiretos distingue nó com artigos próprios de nó só-contêiner', () => {
    const hierarquia: HierarquiaNode[] = [
      {
        tipo: 'TITULO',
        descricao: 'TÍTULO I',
        path: 'tit-i',
        filhos: [], // sem capítulos — tem só artigos diretos
      },
      {
        tipo: 'TITULO',
        descricao: 'TÍTULO IV',
        path: 'tit-iv',
        filhos: [
          { tipo: 'CAPITULO', descricao: 'CAPÍTULO I', path: 'cap-i', filhos: [] },
        ],
      },
    ];
    const dispositivos = [
      // TÍTULO I com artigos diretos
      disp({ id: 'a1', tipo: 'ARTIGO', numero: '1', posicao: 1, path: 'tit-i' }),
      disp({ id: 'a2', tipo: 'ARTIGO', numero: '2', posicao: 2, path: 'tit-i' }),
      // TÍTULO IV sem artigos diretos — só dentro do CAPÍTULO
      disp({ id: 'a32', tipo: 'ARTIGO', numero: '32', posicao: 3, path: 'tit-iv/cap-i' }),
    ];
    const result = deriveEstrutura(hierarquia, dispositivos, undefined);
    expect(result[0]).toMatchObject({ tipo: 'TITULO', artigosDiretos: 2, totalArtigos: 2 });
    expect(result[1]).toMatchObject({ tipo: 'TITULO', artigosDiretos: 0, totalArtigos: 1 });
    expect(result[2]).toMatchObject({ tipo: 'CAPITULO', artigosDiretos: 1, totalArtigos: 1 });
  });

  it('rangeLabel "—" quando nó não tem nenhum artigo', () => {
    const hierarquia: HierarquiaNode[] = [
      { tipo: 'TITULO', descricao: 'Tit vazio', path: 'tit-x', filhos: [] },
    ];
    const result = deriveEstrutura(hierarquia, [], undefined);
    expect(result[0].rangeLabel).toBe('—');
    expect(result[0].totalArtigos).toBe(0);
    expect(result[0].pctEstudado).toBe(0);
    expect(result[0].primeiroArtigoId).toBeNull();
  });
});

describe('findCurrentNodeId', () => {
  const estrutura = [
    { id: 'pg', path: 'pg', depth: 0 } as any,
    { id: 'pg/tit-iv', path: 'pg/tit-iv', depth: 1 } as any,
    { id: 'pg/tit-iv/cap-i', path: 'pg/tit-iv/cap-i', depth: 2 } as any,
  ];

  it('retorna null quando artigo é undefined', () => {
    expect(findCurrentNodeId(estrutura, undefined)).toBeNull();
  });

  it('retorna null quando artigo não tem path', () => {
    const a = { id: 'a1', path: null } as any;
    expect(findCurrentNodeId(estrutura, a)).toBeNull();
  });

  it('retorna o nó MAIS específico (maior depth) que contém o artigo', () => {
    const a = { id: 'a32', path: 'pg/tit-iv/cap-i' } as any;
    expect(findCurrentNodeId(estrutura, a)).toBe('pg/tit-iv/cap-i');
  });

  it('artigo direto em TÍTULO (sem cap) → casa no TÍTULO, não no CAPÍTULO', () => {
    const a = { id: 'a1', path: 'pg/tit-iv' } as any;
    expect(findCurrentNodeId(estrutura, a)).toBe('pg/tit-iv');
  });
});
