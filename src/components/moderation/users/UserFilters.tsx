'use client';

import { cn } from '@/lib/utils';

interface UserFiltersProps {
  roleFilter: string | undefined;
  onRoleChange: (role: string | undefined) => void;
  search: string;
  onSearchChange: (search: string) => void;
}

const ROLES = [
  { value: undefined, label: 'Todos' },
  { value: 'admin', label: 'Admin' },
  { value: 'moderator', label: 'Moderador' },
  { value: 'teacher', label: 'Professor' },
  { value: 'user', label: 'Usuário' },
];

export function UserFilters({ roleFilter, onRoleChange, search, onSearchChange }: UserFiltersProps) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Buscar por nome ou email..."
        className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-[12px] text-zinc-700 placeholder:text-zinc-400 focus:border-violet-300 focus:outline-none focus:ring-1 focus:ring-violet-300"
      />
      <div className="flex gap-1">
        {ROLES.map((r) => (
          <button
            key={r.label}
            onClick={() => onRoleChange(r.value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors',
              roleFilter === r.value
                ? 'bg-violet-100 text-violet-700'
                : 'text-zinc-500 hover:bg-zinc-100',
            )}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}
