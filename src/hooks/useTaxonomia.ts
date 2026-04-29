import { useQuery } from '@tanstack/react-query';

export type TaxonomiaNode = {
  id: number | string;  // string='outros'
  nome: string;
  hierarquia: string | null;
  is_sintetico: boolean;
  is_virtual: boolean;
  fonte: string | null;
  children: TaxonomiaNode[];
};

export type TaxonomiaTree = {
  materia: string;
  fontes: string[];
  tree: TaxonomiaNode[];
};

export function useTaxonomia(slug: string | null) {
  return useQuery<TaxonomiaTree>({
    queryKey: ['taxonomia-tree', slug],
    queryFn: async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/taxonomia/${slug}`);
      if (!res.ok) throw new Error('Falha ao carregar árvore');
      return res.json();
    },
    enabled: !!slug,
    staleTime: 60 * 60 * 1000,
  });
}

export function flattenTree(nodes: TaxonomiaNode[]): TaxonomiaNode[] {
  const out: TaxonomiaNode[] = [];
  for (const n of nodes) {
    out.push(n);
    if (n.children?.length) out.push(...flattenTree(n.children));
  }
  return out;
}

export function descendantIds(node: TaxonomiaNode): (number | string)[] {
  const ids: (number | string)[] = [node.id];
  for (const c of node.children || []) ids.push(...descendantIds(c));
  return ids;
}
