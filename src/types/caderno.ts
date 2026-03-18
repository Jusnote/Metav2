// ============ Caderno Temático Types ============

export interface Caderno {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  color: string;
  icon: string;
  created_at: string | null;
  updated_at: string | null;
}

// Parent provisions for hierarchical context display
export interface ContextChainItem {
  role: string;
  slug: string;
  text: string;
}

export interface CadernoItem {
  id: string;
  caderno_id: string;
  user_id: string;
  lei_id: string;
  artigo_numero: string;
  provision_slug: string;
  provision_role: string;
  provision_text: string;
  lei_sigla: string | null;
  lei_nome: string | null;
  artigo_contexto: string | null;
  context_chain: ContextChainItem[];
  markers: string[];
  position: number;
  note: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export type CadernoInsert = Omit<Caderno, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
export type CadernoUpdate = Partial<CadernoInsert>;

export type CadernoItemInsert = Omit<CadernoItem, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
export type CadernoItemUpdate = Partial<Pick<CadernoItem, 'note' | 'position'>>;

// ============ Saved Views ("Ilusão dos Múltiplos Cadernos") ============

export interface CadernoFilters {
  lei_ids?: string[];
  markers?: string[];
}

export interface CadernoSavedView {
  id: string;
  user_id: string;
  title: string;
  color: string;
  icon: string;
  filters: CadernoFilters;
  position: number;
  created_at: string | null;
}

// Colors available for cadernos
export const CADERNO_COLORS = [
  '#8b5cf6', // violet
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
  '#14b8a6', // teal
  '#a855f7', // purple
] as const;

// Role labels for display
export const PROVISION_ROLE_LABELS: Record<string, string> = {
  artigo: 'Art.',
  paragrafo: '§',
  paragrafo_unico: '§ único',
  inciso: 'Inc.',
  alinea: 'Al.',
  item: 'Item',
  pena: 'Pena',
  epigrafe: 'Epígrafe',
};
