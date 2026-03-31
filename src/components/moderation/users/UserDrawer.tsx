'use client';

import { useState } from 'react';
import { ModerationDrawer } from '../shared/ModerationDrawer';
import { ActionBar } from '../shared/ActionBar';
import { Timeline } from '../shared/Timeline';
import { useUserMutations } from '@/hooks/moderation/useModerationUsers';
import { useModerationLog } from '@/hooks/moderation/useModerationLog';
import { useUserRole } from '@/hooks/moderation/useUserRole';
import type { ModerationUser, UserRole } from '@/types/moderation';
import { toast } from 'sonner';

const ROLE_OPTIONS: UserRole[] = ['user', 'teacher', 'moderator', 'admin'];

interface UserDrawerProps {
  user: ModerationUser;
  open: boolean;
  onClose: () => void;
}

export function UserDrawer({ user, open, onClose }: UserDrawerProps) {
  const { isAdmin } = useUserRole();
  const { changeRole, toggleShadowban, banUser, unbanUser, isChangingRole, isBanning } = useUserMutations();
  const { data: logEntries } = useModerationLog('user', user.user_id);
  const [banReason, setBanReason] = useState('');

  const isBanned = user.timeout_until && new Date(user.timeout_until) > new Date();
  const displayName = user.name ?? user.email?.split('@')[0] ?? 'Anônimo';

  const handleRoleChange = async (newRole: UserRole) => {
    try {
      await changeRole({ userId: user.user_id, newRole });
      toast.success(`Role alterada para ${newRole}`);
    } catch {
      toast.error('Erro ao alterar role. Tente novamente.');
    }
  };

  const handleToggleShadowban = async () => {
    const action = user.is_shadowbanned ? 'remover o shadowban' : 'aplicar shadowban';
    if (!window.confirm(`Tem certeza que deseja ${action} neste usuário?`)) return;
    try {
      await toggleShadowban({ userId: user.user_id, shadowban: !user.is_shadowbanned });
      toast.success(user.is_shadowbanned ? 'Shadowban removido' : 'Shadowban aplicado');
    } catch {
      toast.error('Erro ao alterar shadowban. Tente novamente.');
    }
  };

  const handleBan = async () => {
    if (!banReason.trim()) {
      toast.error('Motivo obrigatório para banimento');
      return;
    }
    if (!window.confirm(`Tem certeza que deseja banir "${displayName}"? Motivo: ${banReason}`)) return;
    try {
      await banUser({ userId: user.user_id, reason: banReason });
      toast.success('Usuário banido');
      setBanReason('');
      onClose();
    } catch {
      toast.error('Erro ao banir usuário. Tente novamente.');
    }
  };

  const handleUnban = async () => {
    if (!window.confirm(`Tem certeza que deseja desbanir "${displayName}"?`)) return;
    try {
      await unbanUser({ userId: user.user_id });
      toast.success('Banimento removido');
    } catch {
      toast.error('Erro ao desbanir usuário. Tente novamente.');
    }
  };

  return (
    <ModerationDrawer
      open={open}
      onClose={onClose}
      title={displayName}
      subtitle={user.email}
      footer={
        <ActionBar>
          <button
            onClick={handleToggleShadowban}
            className="rounded-md bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-700 transition-colors hover:bg-amber-100"
          >
            {user.is_shadowbanned ? 'Remover Shadowban' : 'Shadowban'}
          </button>
          {isBanned ? (
            <button
              onClick={handleUnban}
              className="rounded-md bg-emerald-50 px-3 py-2 text-[12px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
            >
              Desbanir
            </button>
          ) : (
            <button
              onClick={handleBan}
              disabled={isBanning}
              className="rounded-md bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
            >
              Banir
            </button>
          )}
        </ActionBar>
      }
    >
      {/* Avatar + Role */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-violet-400 text-lg font-bold text-white">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-[15px] font-bold text-zinc-900">{displayName}</p>
          {isAdmin ? (
            <select
              value={user.role}
              onChange={(e) => handleRoleChange(e.target.value as UserRole)}
              disabled={isChangingRole}
              className="mt-0.5 rounded border border-violet-200 bg-violet-50 px-2 py-0.5 text-[12px] font-medium text-violet-700 focus:outline-none"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          ) : (
            <span className="text-[12px] font-medium capitalize text-violet-600">
              {user.role}
            </span>
          )}
        </div>
      </div>

      {/* Activity stats */}
      <div className="mb-5">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.5px] text-zinc-400">
          Atividade
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Comentários', value: user.comment_count },
            { label: 'Reports recebidos', value: user.report_count_received },
            { label: 'Reports feitos', value: user.report_count_made },
          ].map((stat) => (
            <div key={stat.label} className="rounded-lg border border-zinc-100 bg-[#fafafa] p-3">
              <p className="text-[11px] text-zinc-400">{stat.label}</p>
              <p className="text-[18px] font-bold tabular-nums text-zinc-900">
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Ban reason input */}
      {!isBanned && (
        <div className="mb-5">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.5px] text-zinc-400">
            Motivo do banimento
          </h3>
          <input
            type="text"
            value={banReason}
            onChange={(e) => setBanReason(e.target.value)}
            placeholder="Obrigatório para banir..."
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-[13px] text-zinc-700 placeholder:text-zinc-400 focus:border-violet-300 focus:outline-none focus:ring-1 focus:ring-violet-300"
          />
        </div>
      )}

      {/* Timeline */}
      <div>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.5px] text-zinc-400">
          Histórico de moderação
        </h3>
        <Timeline entries={logEntries ?? []} />
      </div>
    </ModerationDrawer>
  );
}
