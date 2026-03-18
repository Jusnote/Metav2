'use client';

import * as React from 'react';

import type { PlateElementProps } from 'platejs/react';

import { IS_APPLE } from 'platejs';
import {
  PlateElement,
  useFocused,
  useSelected,
} from 'platejs/react';

import { cn } from '@/lib/utils';
import { useMounted } from '@/hooks/use-mounted';

// Filter type → visual
type FilterType = 'banca' | 'ano' | 'orgao' | 'cargo' | 'materia' | 'assunto';

const STYLES: Record<FilterType, { bg: string; text: string; border: string; icon: string }> = {
  banca:   { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800', icon: '🏛️' },
  ano:     { bg: 'bg-orange-100 dark:bg-orange-900/40',   text: 'text-orange-700 dark:text-orange-300',   border: 'border-orange-200 dark:border-orange-800',   icon: '📅' },
  orgao:   { bg: 'bg-blue-100 dark:bg-blue-900/40',       text: 'text-blue-700 dark:text-blue-300',       border: 'border-blue-200 dark:border-blue-800',       icon: '🏢' },
  cargo:   { bg: 'bg-purple-100 dark:bg-purple-900/40',   text: 'text-purple-700 dark:text-purple-300',   border: 'border-purple-200 dark:border-purple-800',   icon: '👤' },
  materia: { bg: 'bg-teal-100 dark:bg-teal-900/40',       text: 'text-teal-700 dark:text-teal-300',       border: 'border-teal-200 dark:border-teal-800',       icon: '📚' },
  assunto: { bg: 'bg-indigo-100 dark:bg-indigo-900/40',   text: 'text-indigo-700 dark:text-indigo-300',   border: 'border-indigo-200 dark:border-indigo-800',   icon: '📝' },
};

const DEFAULT_STYLE = STYLES.banca;

export function SearchFilterTagElement(props: PlateElementProps) {
  const { element } = props;
  const selected = useSelected();
  const focused = useFocused();
  const mounted = useMounted();

  const filterType = ((element as any).filterType || 'banca') as FilterType;
  const value = (element as any).value || '';
  const style = STYLES[filterType] || DEFAULT_STYLE;

  const badge = (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors',
        style.bg,
        style.text,
        style.border,
        selected && focused && 'ring-2 ring-ring ring-offset-1 ring-offset-background',
      )}
    >
      <span className="text-[10px]">{style.icon}</span>
      <span className="opacity-60 text-[10px] uppercase tracking-wider">{filterType}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );

  return (
    <PlateElement
      {...props}
      className="m-0.5 inline-flex cursor-pointer select-none align-baseline"
      attributes={{
        ...props.attributes,
        contentEditable: false,
        draggable: false,
      }}
    >
      {mounted && IS_APPLE ? (
        <React.Fragment>
          {props.children}
          {badge}
        </React.Fragment>
      ) : (
        <React.Fragment>
          {badge}
          {props.children}
        </React.Fragment>
      )}
    </PlateElement>
  );
}
