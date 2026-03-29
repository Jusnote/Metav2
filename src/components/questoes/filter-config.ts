import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  BookOpen,
  Calendar,
  Landmark,
  Briefcase,
  BookMarked,
  Settings,
} from 'lucide-react';
import type { FiltrosDicionario } from '@/hooks/useFiltrosDicionario';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FilterCategoryConfig {
  /** Key matching QuestoesFilters (bancas, materias, anos, orgaos, cargos, assuntos) */
  key: string;
  /** Human-readable label shown on the pill */
  label: string;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Gradient start color */
  gradientFrom: string;
  /** Gradient end color */
  gradientTo: string;
  /** Text color for label and counts */
  textColor: string;
  /** Border color */
  borderColor: string;
  /** Background for the icon circle */
  iconBg: string;
  /** Stroke color for the icon */
  iconStroke: string;
}

export interface FilterItem {
  label: string;
  value: string;
}

// ---------------------------------------------------------------------------
// Category definitions (order = render order in the pill bar)
// ---------------------------------------------------------------------------

export const FILTER_CATEGORIES: FilterCategoryConfig[] = [
  {
    key: 'bancas',
    label: 'Bancas',
    icon: Building2,
    gradientFrom: '#F4F0FF',
    gradientTo: '#E9E3FF',
    textColor: '#5B21B6',
    borderColor: '#C4B5FD',
    iconBg: '#F4F0FF',
    iconStroke: '#7C3AED',
  },
  {
    key: 'materias',
    label: 'Matérias',
    icon: BookOpen,
    gradientFrom: '#FEF3C7',
    gradientTo: '#FDE68A',
    textColor: '#92400E',
    borderColor: '#F59E0B',
    iconBg: '#FEF3C7',
    iconStroke: '#D97706',
  },
  {
    key: 'anos',
    label: 'Anos',
    icon: Calendar,
    gradientFrom: '#DBEAFE',
    gradientTo: '#BFDBFE',
    textColor: '#1E40AF',
    borderColor: '#60A5FA',
    iconBg: '#DBEAFE',
    iconStroke: '#2563EB',
  },
  {
    key: 'orgaos',
    label: 'Órgãos',
    icon: Landmark,
    gradientFrom: '#F0FDF4',
    gradientTo: '#BBF7D0',
    textColor: '#166534',
    borderColor: '#4ADE80',
    iconBg: '#F0FDF4',
    iconStroke: '#16A34A',
  },
  {
    key: 'cargos',
    label: 'Cargos',
    icon: Briefcase,
    gradientFrom: '#FFF7ED',
    gradientTo: '#FFEDD5',
    textColor: '#9A3412',
    borderColor: '#FB923C',
    iconBg: '#FFF7ED',
    iconStroke: '#EA580C',
  },
  {
    key: 'assuntos',
    label: 'Assuntos',
    icon: BookMarked,
    gradientFrom: '#EEF2FF',
    gradientTo: '#E0E7FF',
    textColor: '#3730A3',
    borderColor: '#818CF8',
    iconBg: '#EEF2FF',
    iconStroke: '#4F46E5',
  },
];

// ---------------------------------------------------------------------------
// Advanced / toggle filters (excluir anuladas, desatualizadas, resolvidas)
// ---------------------------------------------------------------------------

export const ADVANCED_CATEGORY: FilterCategoryConfig = {
  key: 'advanced',
  label: 'Avançado',
  icon: Settings,
  gradientFrom: '#F0FDF4',
  gradientTo: '#DCFCE7',
  textColor: '#166534',
  borderColor: '#86EFAC',
  iconBg: '#F0FDF4',
  iconStroke: '#16A34A',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Maps a FiltrosDicionario to a flat {label, value}[] for a given category key.
 *
 * - bancas / orgaos / cargos: deduplicate canonical values from the alias map
 * - materias / assuntos: map string[] directly
 * - anos: generate descending year array from max → min
 */
export function getCategoryItems(
  categoryKey: string,
  dicionario: FiltrosDicionario | null,
): FilterItem[] {
  if (!dicionario) return [];

  switch (categoryKey) {
    case 'bancas':
    case 'orgaos':
    case 'cargos': {
      const aliasMap = dicionario[categoryKey];
      const unique = [...new Set(Object.values(aliasMap))].sort();
      return unique.map((v) => ({ label: v, value: v }));
    }

    case 'materias':
    case 'assuntos': {
      const items = dicionario[categoryKey];
      return items.map((v) => ({ label: v, value: v }));
    }

    case 'anos': {
      const { min, max } = dicionario.anos;
      const years: FilterItem[] = [];
      for (let y = max; y >= min; y--) {
        years.push({ label: String(y), value: String(y) });
      }
      return years;
    }

    default:
      return [];
  }
}
