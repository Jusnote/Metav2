'use client';

import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutGrid,
  Flag,
  Users,
  HelpCircle,
  BookOpen,
  CreditCard,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/moderation/useUserRole';
import { useQuestionReportCount } from '@/hooks/moderation/useQuestionReports';
import { useLawReportCount } from '@/hooks/moderation/useLawReports';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
  disabled?: boolean;
}

export function ModerationSidebar({ pendingCount = 0 }: { pendingCount?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { role } = useUserRole();
  const questionReportCount = useQuestionReportCount();
  const lawReportCount = useLawReportCount();

  const navItems: NavItem[] = [
    {
      label: 'Overview',
      href: '/moderacao',
      icon: <LayoutGrid className="h-[15px] w-[15px]" />,
    },
    {
      label: 'Reports',
      href: '/moderacao/reports',
      icon: <Flag className="h-[15px] w-[15px]" />,
      badge: pendingCount,
    },
    {
      label: 'Usuários',
      href: '/moderacao/usuarios',
      icon: <Users className="h-[15px] w-[15px]" />,
    },
    {
      label: 'Questões',
      href: '/moderacao/questoes',
      icon: <HelpCircle className="h-[15px] w-[15px]" />,
      badge: questionReportCount,
    },
    {
      label: 'Lei Seca',
      href: '/moderacao/lei-seca',
      icon: <BookOpen className="h-[15px] w-[15px]" />,
      badge: lawReportCount,
    },
  ];

  const futureItems: NavItem[] = [
    {
      label: 'Billing',
      href: '/moderacao/billing',
      icon: <CreditCard className="h-[15px] w-[15px]" />,
      disabled: true,
    },
  ];

  const isActive = (href: string) =>
    href === '/moderacao'
      ? location.pathname === '/moderacao'
      : location.pathname.startsWith(href);

  const userName = user?.user_metadata?.name ?? user?.email?.split('@')[0] ?? 'Usuário';
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <div className="flex h-full w-[210px] shrink-0 flex-col border-r border-violet-100 bg-[#faf8ff]">
      {/* Logo */}
      <div className="px-5 pb-6 pt-5">
        <div className="flex items-center gap-[9px]">
          <div className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] bg-gradient-to-br from-violet-600 to-violet-400 text-[13px] font-bold text-white">
            M
          </div>
          <span className="text-[14px] font-bold tracking-tight text-violet-950">
            Moderação
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-2">
        {navItems.map((item) => (
          <button
            key={item.href}
            onClick={() => !item.disabled && navigate(item.href)}
            disabled={item.disabled}
            className={cn(
              'flex w-full items-center gap-2 rounded-[7px] px-3 py-[7px] text-[13px] transition-all',
              isActive(item.href)
                ? 'bg-white font-semibold text-violet-600 shadow-[0_1px_3px_rgba(124,58,237,0.08)]'
                : item.disabled
                  ? 'cursor-default text-violet-300'
                  : 'text-zinc-500 hover:bg-white/60 hover:text-zinc-700',
            )}
          >
            <span className={cn(
              isActive(item.href) ? 'text-violet-600' : item.disabled ? 'text-violet-300' : 'text-zinc-400',
            )}>
              {item.icon}
            </span>
            <span className="flex-1 text-left">{item.label}</span>
            {item.disabled && (
              <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-400">
                Em breve
              </span>
            )}
            {!!item.badge && item.badge > 0 && (
              <span className="min-w-[18px] rounded-full bg-violet-600 px-[7px] py-[2px] text-center text-[11px] font-semibold tabular-nums text-white">
                {item.badge}
              </span>
            )}
          </button>
        ))}

        <div className="mx-3 my-3 h-px bg-violet-100" />

        {futureItems.map((item) => (
          <button
            key={item.href}
            disabled
            className="flex w-full items-center gap-2 rounded-[7px] px-3 py-[7px] text-[12px] text-violet-300 cursor-default"
          >
            <span className="text-violet-300">{item.icon}</span>
            <span className="flex-1 text-left">{item.label}</span>
            <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-400">
              Em breve
            </span>
          </button>
        ))}
      </nav>

      {/* User card */}
      <div className="mx-2 mb-3 rounded-lg bg-white p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-violet-400 text-[11px] font-bold text-white">
            {userInitial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-semibold text-zinc-900">
              {userName}
            </div>
            <div className="text-[11px] font-medium capitalize text-violet-600">
              {role}
            </div>
          </div>
          <button
            onClick={() => navigate('/')}
            className="text-zinc-400 transition-colors hover:text-zinc-600"
            title="Voltar ao app"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
