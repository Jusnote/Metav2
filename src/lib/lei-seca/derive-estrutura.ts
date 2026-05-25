import type { Dispositivo, HierarquiaNode } from '@/types/lei-api';
import type { DispositivoStatus } from '@/hooks/useDispositivoUserStatus';

export interface EstruturaNode {
  id: string;                 // = path completo
  path: string;
  tipo: string;               // 'PARTE' | 'LIVRO' | 'TITULO' | 'CAPITULO' | 'SECAO' | 'SUBSECAO' | 'SUBTITULO' | ...
  depth: number;              // 0 = raiz da árvore
  descricao: string;          // ex.: "TÍTULO I"
  subtitulo: string | null;   // ex.: "Da Aplicação da Lei Penal"
  totalArtigos: number;       // soma recursiva (inclui artigos de filhos)
  artigosDiretos: number;     // só artigos cujo path === este nó (sem descendentes)
  estudados: number;
  pctEstudado: number;
  rangeLabel: string;
  primeiroArtigoId: string | null;
}

/**
 * Constrói lista flat (com `depth`) a partir da árvore `hierarquia` da API.
 * Pra cada nó estrutural, agrega total/% de artigos (recursivamente) cruzando
 * com os dispositivos fetchados.
 *
 * Usa o convenant: `dispositivo.path` começa com o `fullPath` do ancestor.
 */
export function deriveEstrutura(
  hierarquia: HierarquiaNode[],
  dispositivos: Dispositivo[],
  statusMap: Map<string, DispositivoStatus> | undefined,
): EstruturaNode[] {
  // Index: path-ancestor → artigos sob ele. Construído 1x.
  const artigosPorPath = new Map<string, Dispositivo[]>();
  for (const d of dispositivos) {
    if (d.tipo !== 'ARTIGO' || !d.path) continue;
    const parts = d.path.split('/');
    for (let i = 1; i <= parts.length; i++) {
      const ancestor = parts.slice(0, i).join('/');
      let arr = artigosPorPath.get(ancestor);
      if (!arr) {
        arr = [];
        artigosPorPath.set(ancestor, arr);
      }
      arr.push(d);
    }
  }

  const result: EstruturaNode[] = [];

  const walk = (nodes: HierarquiaNode[], parentPath: string, depth: number) => {
    for (const node of nodes) {
      const fullPath = parentPath ? `${parentPath}/${node.path}` : node.path;

      const artigosDoNo = artigosPorPath.get(fullPath) ?? [];
      const totalArtigos = artigosDoNo.length;
      const artigosDiretos = artigosDoNo.filter((a) => a.path === fullPath).length;
      const estudados = artigosDoNo.filter(
        (a) => statusMap?.get(String(a.id)) === 'estudado',
      ).length;
      const pctEstudado =
        totalArtigos === 0 ? 0 : Math.round((estudados / totalArtigos) * 100);

      const numeros = artigosDoNo
        .map((a) => a.numero)
        .filter((n): n is string => Boolean(n));
      const rangeLabel =
        numeros.length === 0
          ? '—'
          : numeros.length === 1
            ? `Art. ${numeros[0]}`
            : `Arts. ${numeros[0]} a ${numeros[numeros.length - 1]}`;

      result.push({
        id: fullPath,
        path: fullPath,
        tipo: node.tipo,
        depth,
        descricao: node.descricao,
        subtitulo: node.subtitulo ?? null,
        totalArtigos,
        artigosDiretos,
        estudados,
        pctEstudado,
        rangeLabel,
        primeiroArtigoId: artigosDoNo[0]?.id ?? null,
      });

      if (node.filhos?.length) {
        walk(node.filhos, fullPath, depth + 1);
      }
    }
  };

  walk(hierarquia, '', 0);
  return result;
}

/**
 * Encontra o id do nó estrutural (mais específico) que contém o artigo focado.
 * Retorna o de MAIOR depth (mais profundo).
 */
export function findCurrentNodeId(
  estrutura: EstruturaNode[],
  activeArtigo: Dispositivo | undefined,
): string | null {
  if (!activeArtigo?.path) return null;
  const path = activeArtigo.path;
  let melhor: EstruturaNode | null = null;
  for (const n of estrutura) {
    if (path === n.path || path.startsWith(n.path + '/')) {
      if (!melhor || n.depth > melhor.depth) melhor = n;
    }
  }
  return melhor?.id ?? null;
}
