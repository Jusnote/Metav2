'use client';

import { useMemo, type ReactNode } from 'react';
import type { Dispositivo } from '@/types/lei-api';
import type { Grifo } from '@/types/grifo';
import type { DispositivoStatus } from '@/hooks/useDispositivoUserStatus';
import { GrifoText } from '@/components/lei-seca/GrifoText';
import { stripDispositivoPrefix } from '@/lib/lei-seca/strip-dispositivo-prefix';
import { ActionPillRail } from './ActionPillRail';
import { NeArtigoRail } from './NeArtigoRail';

interface Props {
  item: Dispositivo;
  isActive: boolean;
  status: DispositivoStatus | undefined;
  bookmarked: boolean;
  commentCount: number;
  hasNote: boolean;
  grifos: Grifo[];
  onToggleStatus: (status: DispositivoStatus) => void;
  onToggleBookmark: () => void;
  onOpenNote: () => void;
  onOpenComments: () => void;
  children?: ReactNode;
}

function formatArtCode(numero: string | null): string {
  if (!numero) return 'Art. —';
  const digits = numero.match(/\d+/)?.[0];
  if (!digits) return `Art. ${numero}`;
  const suffix = numero.replace(/\d+/, '').replace(/[º°ª]/g, '').trim();
  // Padrão jurídico BR: ordinal (1º a 9º) até nove, cardinal (10, 11…) a partir de dez.
  const num = parseInt(digits, 10);
  const numeral = num < 10 ? `${num}º` : `${num}`;
  return suffix ? `Art. ${numeral}${suffix.toUpperCase()}` : `Art. ${numeral}`;
}

export function NordicArticle({
  item,
  isActive,
  status,
  bookmarked,
  commentCount,
  hasNote,
  grifos,
  onToggleStatus,
  onToggleBookmark,
  onOpenNote,
  onOpenComments,
  children,
}: Props) {
  const { texto, grifos: grifosAjustados } = useMemo(
    () => stripDispositivoPrefix(item.tipo, item.texto, grifos),
    [item.tipo, item.texto, grifos],
  );

  const artCode = formatArtCode(item.numero);
  const epigrafe = item.epigrafe?.trim();
  const hasTexto = texto.trim().length > 0;
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);

  return (
    <article
      data-id={item.id}
      data-posicao={item.posicao}
      data-tipo="ARTIGO"
      className={
        'relative grid grid-cols-[80px_1fr] gap-x-5 py-8 border-b border-n-rule-2 last:border-b-0 ' +
        (isActive ? 'bg-n-accent-soft/40 -mx-4 px-4 rounded-md' : '')
      }
    >
      {/* Gutter — Art. Nº mono pequeno, alinhado ao topo do conteúdo */}
      <div className="pt-[2px] text-right">
        <span className="font-n-mono text-[12px] text-n-ink-3 tracking-[0.04em] leading-[1.4]">
          {artCode}
        </span>
      </div>

      {/* Coluna principal — epígrafe (kicker) + caput + filhos + actions */}
      <div className="min-w-0">
        {epigrafe && (
          <h2 className="m-0 mb-2 text-[11px] uppercase tracking-[0.12em] text-n-ink-3 font-medium">
            {epigrafe}
          </h2>
        )}

        {hasTexto && (
          <div
            data-texto
            className="text-n-ink text-[16px] leading-[1.7] tracking-n-normal font-n-sans"
          >
            <GrifoText texto={texto} tipo={item.tipo} grifos={grifosAjustados} />
          </div>
        )}

        {item.pena && (
          <div className="mt-3 text-n-ink-2 text-[14px] italic leading-[1.65]">
            <span className="font-medium not-italic uppercase tracking-n-snug text-[11px] text-n-ink-3 mr-2">
              Pena
            </span>
            {item.pena}
          </div>
        )}

        {hasChildren && <div className={hasTexto ? 'mt-3' : ''}>{children}</div>}

        <ActionPillRail
          status={status}
          bookmarked={bookmarked}
          commentCount={commentCount}
          hasNote={hasNote}
          onToggleStatus={onToggleStatus}
          onToggleBookmark={onToggleBookmark}
          onOpenNote={onOpenNote}
          onOpenComments={onOpenComments}
        />

        <NeArtigoRail dispositivoId={String(item.id)} />
      </div>
    </article>
  );
}
