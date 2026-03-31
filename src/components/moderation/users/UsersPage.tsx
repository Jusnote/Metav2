'use client';

import { useState, useMemo } from 'react';
import { Users } from 'lucide-react';
import { useModerationUsers } from '@/hooks/moderation/useModerationUsers';
import { ModerationDataTable, type Column } from '../shared/ModerationDataTable';
import { UserDrawer } from './UserDrawer';
import { UserFilters } from './UserFilters';
import type { ModerationUser } from '@/types/moderation';

function getStatus(user: ModerationUser): string {
  if (user.timeout_until && new Date(user.timeout_until) > new Date()) return 'Banido';
  if (user.is_shadowbanned) return 'Shadowban';
  return 'Ativo';
}

const columns: Column<ModerationUser>[] = [
  {
    key: 'name',
    label: 'Usuário',
    width: '1fr',
    render: (row) => (
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-violet-600 text-[11px] font-bold text-white">
          {(row.name ?? row.email ?? '?').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-zinc-900">
            {row.name ?? row.email?.split('@')[0] ?? 'Anônimo'}
          </p>
          <p className="truncate text-[11px] text-zinc-400">{row.email}</p>
        </div>
      </div>
    ),
  },
  {
    key: 'role',
    label: 'Role',
    width: '90px',
    render: (row) => (
      <span className="text-[12px] capitalize text-zinc-500">{row.role}</span>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    width: '90px',
    render: (row) => {
      const status = getStatus(row);
      return (
        <span
          className={`text-[11px] font-semibold ${
            status === 'Ativo' ? 'text-zinc-500' : status === 'Banido' ? 'text-red-500' : 'text-amber-500'
          }`}
        >
          {status}
        </span>
      );
    },
  },
  {
    key: 'comments',
    label: 'Comentários',
    width: '80px',
    render: (row) => (
      <span className="text-[12px] tabular-nums text-zinc-500">
        {row.comment_count}
      </span>
    ),
  },
  {
    key: 'reports',
    label: 'Reports',
    width: '70px',
    render: (row) => (
      <span className="text-[12px] tabular-nums text-zinc-500">
        {row.report_count_received}
      </span>
    ),
  },
];

export function UsersPage() {
  const { data: users, isLoading } = useModerationUsers();
  const [selectedUser, setSelectedUser] = useState<ModerationUser | null>(null);
  const [roleFilter, setRoleFilter] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let list = users ?? [];
    if (roleFilter) {
      list = list.filter((u) => u.role === roleFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) =>
          (u.name?.toLowerCase().includes(q)) ||
          (u.email?.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [users, roleFilter, search]);

  return (
    <>
      <div className="border-b border-zinc-100 bg-white px-8 pb-5 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-bold tracking-[-0.5px] text-zinc-900">
              Usuários
            </h1>
            <p className="mt-1 text-[13px] text-zinc-400">
              Gestão de usuários e permissões
            </p>
          </div>
          <UserFilters
            roleFilter={roleFilter}
            onRoleChange={setRoleFilter}
            search={search}
            onSearchChange={setSearch}
          />
        </div>
      </div>

      <div className="p-8">
        {isLoading ? (
          <div className="overflow-hidden rounded-[10px] border border-zinc-100 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="border-b border-zinc-100 bg-[#fafafa] px-[18px] py-[10px]">
              <div className="h-3 w-40 animate-pulse rounded bg-zinc-200" />
            </div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 border-b border-[#fafafa] px-[18px] py-[15px]">
                <div className="h-7 w-7 animate-pulse rounded-full bg-zinc-200" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-32 animate-pulse rounded bg-zinc-100" />
                  <div className="h-2.5 w-48 animate-pulse rounded bg-zinc-50" />
                </div>
                <div className="h-3 w-16 animate-pulse rounded bg-zinc-100" />
                <div className="h-3 w-14 animate-pulse rounded bg-zinc-100" />
              </div>
            ))}
          </div>
        ) : (
          <ModerationDataTable
            columns={columns}
            data={filtered}
            onRowClick={setSelectedUser}
            rowKey={(u) => u.user_id}
            emptyMessage="Nenhum usuário encontrado"
            emptyIcon={<Users className="h-8 w-8" />}
          />
        )}
      </div>

      {selectedUser && (
        <UserDrawer
          user={selectedUser}
          open={!!selectedUser}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </>
  );
}
