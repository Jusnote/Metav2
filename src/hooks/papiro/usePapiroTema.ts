import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  PapiroTemaData,
  PapiroPrereqResolvido,
  PapiroTema,
  PapiroResumo,
  PapiroTemaSibling,
} from '@/lib/papiro/types';

interface RawTema extends PapiroTema {
  macro_area: {
    id: string;
    nome: string;
    slug: string;
    disciplina: { slug: string; nome: string } | null;
    tema: Array<{ id: string; slug_hierarquico: string; nome: string; ordem_curricular: number }>;
  } | null;
  resumo: PapiroResumo[];
}

interface RawPrereqTema {
  prereq: { slug_hierarquico: string; nome: string } | null;
}

export function usePapiroTema(temaSlug: string | undefined) {
  return useQuery<PapiroTemaData | null>({
    queryKey: ['papiro', 'tema', temaSlug],
    staleTime: 5 * 60 * 1000,
    enabled: !!temaSlug,
    queryFn: async () => {
      // Q1: tema + resumo + macro_area + disciplina + irmãos (pra prev/next)
      const { data: rawTema, error: e1 } = await supabase
        .schema('papiro')
        .from('tema')
        .select(`
          *,
          macro_area:macro_area!macro_area_id (
            id, nome, slug,
            disciplina:disciplina!disciplina_id ( slug, nome ),
            tema:tema!macro_area_id ( id, slug_hierarquico, nome, ordem_curricular )
          ),
          resumo:resumo!tema_id ( id, tema_id, conteudo_md, conteudo_plate, status, versao, atualizado_em )
        `)
        .eq('slug_hierarquico', temaSlug!)
        .maybeSingle();

      if (e1) throw e1;
      if (!rawTema) return null;
      const tema = rawTema as unknown as RawTema;

      // Q2: prereqs deste tema
      const { data: rawPrereqs, error: e2 } = await supabase
        .schema('papiro')
        .from('tema_prereq')
        .select(`prereq:tema!prereq_tema_id ( slug_hierarquico, nome )`)
        .eq('tema_id', tema.id);
      if (e2) throw e2;
      const prereqs: PapiroPrereqResolvido[] = ((rawPrereqs ?? []) as unknown as RawPrereqTema[])
        .filter((p) => p.prereq !== null)
        .map((p) => ({ slug_hierarquico: p.prereq!.slug_hierarquico, nome: p.prereq!.nome }));

      // Prev/Next pela ordem_curricular dos irmãos
      const irmaos = (tema.macro_area?.tema ?? [])
        .slice()
        .sort((a, b) => a.ordem_curricular - b.ordem_curricular);
      const idx = irmaos.findIndex((t) => t.id === tema.id);
      const prev: PapiroTemaSibling | null = idx > 0 ? irmaos[idx - 1] : null;
      const next: PapiroTemaSibling | null = idx >= 0 && idx < irmaos.length - 1 ? irmaos[idx + 1] : null;

      const resumo: PapiroResumo | null = tema.resumo.length > 0 ? tema.resumo[0] : null;
      const macroAreaSlug = tema.macro_area?.slug ?? '';
      const macroAreaTail = macroAreaSlug.includes('.') ? macroAreaSlug.split('.').slice(1).join('.') : macroAreaSlug;

      // Strip nested arrays do tema "puro"
      const { macro_area: _, resumo: __, ...puro } = tema;

      return {
        tema: puro as PapiroTema,
        resumo,
        prev,
        next,
        prereqs,
        indice: { atual: idx + 1, total: irmaos.length },
        macroAreaNome: tema.macro_area?.nome ?? '',
        macroAreaSlug,
        macroAreaTail,
        disciplinaNome: tema.macro_area?.disciplina?.nome ?? '',
        disciplinaSlug: tema.macro_area?.disciplina?.slug ?? '',
      };
    },
  });
}
