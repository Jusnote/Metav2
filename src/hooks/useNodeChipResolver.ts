import { useTaxonomia, flattenTree, TaxonomiaNode } from './useTaxonomia';
import { useMemo } from 'react';

export type NodeInfo = {
  nome: string;
  path: string[];
  isVirtual: boolean;
};

export function useNodeChipResolver(slug: string | null) {
  const { data } = useTaxonomia(slug);

  return useMemo(() => {
    if (!data) return (id: number | string) => null as NodeInfo | null;

    // Constrói mapa id → path
    const pathMap = new Map<number | string, string[]>();
    const walk = (nodes: TaxonomiaNode[], parentPath: string[]) => {
      for (const n of nodes) {
        const path = [...parentPath, n.nome];
        pathMap.set(n.id, path);
        if (n.children) walk(n.children, path);
      }
    };
    walk(data.tree, []);

    return (id: number | string): NodeInfo | null => {
      const path = pathMap.get(id);
      if (!path) return null;
      const nodes = flattenTree(data.tree);
      const node = nodes.find(n => n.id === id);
      return {
        nome: path[path.length - 1],
        path,
        isVirtual: !!node?.is_virtual,
      };
    };
  }, [data]);
}
