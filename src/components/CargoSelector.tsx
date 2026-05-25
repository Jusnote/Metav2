'use client';

import { useEffect, useMemo, useState } from 'react';
import { AREA_LABELS, AREAS, type Area, type Carreira } from '@/types/carreira';
import { useAreaCounts, useCarreiras } from '@/hooks/useCarreiras';
import { useCargoAtivo } from '@/hooks/useCargoAtivo';

/**
 * Botão na navbar que mostra o cargo ativo + expansion panel abaixo da topbar.
 *
 * UX: padrão "draft → confirm". Ao abrir, draft = applied. Usuário muda áreas e
 * carreiras (só marca visualmente). Botão "Atualizar ecossistema" só fica
 * habilitado se draft ≠ applied. Aplicar atualiza o cargo global (localStorage).
 *
 * O componente exporta dois subcomponentes (`CargoSelector.Card` e
 * `CargoSelector.Expansion`) pra serem renderizados em pontos diferentes do
 * AppTopNav (card no topo, expansion entre topbar e navbar dark).
 */

interface CargoSelectorContext {
  open: boolean;
  setOpen: (v: boolean) => void;
  cargo: Carreira | null;
  setCargo: (c: Carreira | null) => void;
}

// Hook compartilhado entre Card e Expansion. Ambos chamam — React tracker garante
// que ambos rerenderizam quando localStorage muda.
function useCargoSelectorState(): CargoSelectorContext {
  const [open, setOpen] = useState(false);
  const { cargo, setCargo } = useCargoAtivo();
  return { open, setOpen, cargo, setCargo };
}

/* ------------------------------------------------------------------------- */
/* CARD                                                                      */
/* ------------------------------------------------------------------------- */

interface CardProps {
  open: boolean;
  cargo: Carreira | null;
  onToggle: () => void;
  pulsing?: boolean;
}

function Card({ open, cargo, onToggle, pulsing }: CardProps) {
  const isEmpty = !cargo;
  const hasFoto = !!cargo?.foto_url;
  const sigla = cargo ? siglaFromNome(cargo.nome) : '+';
  const label = cargo?.nome ?? 'Selecione carreira';

  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        'flex items-center gap-[11px] py-1 pr-2.5 pl-1 rounded-[10px] cursor-pointer select-none',
        'transition-[background,border-color,transform] duration-200',
        'border border-transparent',
        open ? 'bg-blue-900/[0.06]' : 'hover:bg-slate-900/[0.035]',
        pulsing ? 'animate-cargo-card-pulse' : '',
      ].join(' ')}
    >
      {/* Mini-card thumb — usa foto real quando disponível */}
      <span
        className={[
          'relative flex-shrink-0 overflow-hidden flex h-10 w-10 rounded-lg',
          'transition-[transform,box-shadow] duration-200',
          isEmpty
            ? 'bg-blue-50 text-blue-500 border border-dashed border-blue-300 items-center justify-center text-base font-normal'
            : 'items-end justify-start text-white text-[8.5px] font-bold uppercase tracking-[0.05em] leading-none',
        ].join(' ')}
        style={
          isEmpty
            ? undefined
            : {
                background: hasFoto
                  ? '#1e3a5f'
                  : 'linear-gradient(180deg, rgba(15,23,42,0.05) 35%, rgba(15,23,42,0.88) 100%), ' +
                    'linear-gradient(135deg, #1e3a5f 0%, #2c5282 50%, #2a4365 100%)',
                boxShadow:
                  'inset 0 1px 0 rgba(255,255,255,0.14), 0 1px 3px rgba(15,23,42,0.18), 0 0 0 1px rgba(15,23,42,0.06)',
              }
        }
      >
        {!isEmpty && hasFoto && (
          <img
            src={cargo!.foto_url!}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
        )}
        {!isEmpty && (
          <span
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background: hasFoto
                ? 'linear-gradient(180deg, rgba(15,23,42,0.05) 30%, rgba(15,23,42,0.85) 100%)'
                : 'radial-gradient(circle at 30% 25%, rgba(96,165,250,0.22), transparent 55%), ' +
                  'radial-gradient(circle at 75% 75%, rgba(167,139,250,0.16), transparent 55%)',
            }}
          />
        )}
        {!isEmpty && !hasFoto && (
          <span
            key={sigla}
            className="relative inline-block animate-cargo-sigla-in px-[5px] py-[3px]"
          >
            {sigla}
          </span>
        )}
        {isEmpty && (
          <span key="empty" className="relative inline-block animate-cargo-sigla-in">
            {sigla}
          </span>
        )}
      </span>

      {/* Eyebrow + título */}
      <span className="flex flex-col min-w-0 max-w-[150px] items-start">
        <span
          className={[
            'text-[8.5px] font-semibold leading-none uppercase',
            'tracking-[0.16em]',
            isEmpty ? 'text-blue-600/70' : 'text-slate-400',
          ].join(' ')}
        >
          Estudando para
        </span>
        <span
          key={label}
          className={[
            'text-[13px] font-semibold leading-tight mt-1',
            'whitespace-nowrap overflow-hidden text-ellipsis max-w-full',
            'tracking-[-0.01em]',
            'animate-cargo-title-in',
            open ? 'text-blue-900' : isEmpty ? 'text-blue-600' : 'text-slate-900',
          ].join(' ')}
        >
          {label}
        </span>
      </span>

      {/* Chevron */}
      <span
        className={[
          'text-[9px] ml-0.5 transition-[transform,color] duration-300',
          open ? 'rotate-180 text-blue-900' : 'text-slate-300',
        ].join(' ')}
        style={{ transitionTimingFunction: 'cubic-bezier(.22,1,.36,1)' }}
        aria-hidden
      >
        ⌄
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------------- */
/* EXPANSION                                                                 */
/* ------------------------------------------------------------------------- */

interface ExpansionProps {
  open: boolean;
  cargo: Carreira | null;
  onApply: (next: Carreira | null) => void;
  onClose: () => void;
}

function Expansion({ open, cargo, onApply, onClose }: ExpansionProps) {
  const [draftCargo, setDraftCargo] = useState<Carreira | null>(cargo);
  const [area, setArea] = useState<Area>(cargo?.area ?? 'advocacia');

  // Sync draft com applied quando abre/fecha
  useEffect(() => {
    if (open) {
      setDraftCargo(cargo);
      setArea(cargo?.area ?? 'advocacia');
    }
  }, [open, cargo]);

  // Body scroll lock + Esc handler enquanto aberto
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.documentElement.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const { data: counts = {} } = useAreaCounts();
  const { data: carreirasArea = [] } = useCarreiras(area);

  const isDirty = useMemo(() => {
    return (cargo?.id ?? null) !== (draftCargo?.id ?? null);
  }, [cargo, draftCargo]);

  return (
    <div
      className="overflow-hidden bg-[#FBFAFD] border-b border-slate-100/80 relative"
      style={{
        maxHeight: open ? 360 : 0,
        transition: 'max-height .35s cubic-bezier(.22,1,.36,1)',
      }}
    >
      <div className="max-w-[1200px] mx-auto px-8 py-3.5 pb-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-2.5">
          <div className="flex items-baseline gap-3 min-w-0">
            <h2
              className="text-[17px] font-semibold m-0 whitespace-nowrap"
              style={{
                fontFamily: "'Source Serif 4', Georgia, serif",
                letterSpacing: '-0.015em',
                color: '#0f172a',
              }}
            >
              Selecione sua carreira<span style={{ color: '#2563eb' }}>.</span>
            </h2>
            <p className="text-xs text-slate-400 overflow-hidden text-ellipsis whitespace-nowrap">
              Tudo no app se adapta — questões, lei seca, cronograma.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isDirty && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold text-amber-700 bg-amber-500/10 border border-amber-500/25">
                <span className="w-[5px] h-[5px] rounded-full bg-amber-500 animate-pulse" />
                Mudança pendente
              </span>
            )}
            <button
              type="button"
              onClick={() => setDraftCargo(null)}
              className="text-[11px] font-medium text-slate-500 hover:text-slate-900 hover:underline px-1.5 py-1"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-[11px] font-medium text-slate-600 hover:bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!isDirty}
              onClick={() => onApply(draftCargo)}
              className={[
                'text-xs font-semibold px-4 py-1.5 rounded-md inline-flex items-center gap-1.5',
                'transition-[transform,box-shadow,opacity] duration-200',
                isDirty
                  ? 'text-white cursor-pointer hover:-translate-y-px'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed',
              ].join(' ')}
              style={
                isDirty
                  ? {
                      background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                      boxShadow:
                        '0 4px 10px -2px rgba(30,58,138,0.30), inset 0 1px 0 rgba(255,255,255,0.14)',
                      letterSpacing: '0.01em',
                    }
                  : undefined
              }
            >
              Atualizar ecossistema
              <span className="text-[11px] opacity-85">→</span>
            </button>
          </div>
        </div>

        {/* Area tabs */}
        <nav className="flex gap-0.5 overflow-x-auto pb-2 mb-2.5 border-b border-slate-100 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {AREAS.map((a) => {
            const active = a === area;
            const count = counts[a] ?? 0;
            return (
              <button
                key={a}
                type="button"
                onClick={() => setArea(a)}
                className={[
                  'inline-flex items-center gap-1 whitespace-nowrap rounded-full',
                  'px-2.5 py-1 text-[11px] font-medium border',
                  'transition-colors',
                  active
                    ? 'text-slate-900 font-bold bg-white border-slate-300 shadow-[0_1px_2px_rgba(15,23,42,0.04)]'
                    : 'text-slate-500 border-transparent hover:text-slate-900',
                ].join(' ')}
              >
                {AREA_LABELS[a]}
                <span
                  className={[
                    'text-[9px] font-semibold',
                    active ? 'text-blue-600' : 'text-slate-400',
                  ].join(' ')}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Carreira grid */}
        <div
          className="grid gap-2.5"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(86px, 1fr))' }}
        >
          {/* Card "Todas" */}
          <CarreiraCardMini
            type="todas"
            nome={`Todas · ${AREA_LABELS[area]}`}
            active={draftCargo?.id === `todas-${area}`}
            onClick={() => {
              const todasCargo: Carreira = {
                id: `todas-${area}`,
                area,
                nome: `Todas · ${AREA_LABELS[area]}`,
                slug: `todas-${area}`,
                foto_url: null,
                ordem: 0,
                ativa: true,
                created_at: '',
                updated_at: '',
              };
              setDraftCargo(todasCargo);
            }}
          />

          {carreirasArea.map((c) => (
            <CarreiraCardMini
              key={c.id}
              type="real"
              nome={c.nome}
              fotoUrl={c.foto_url}
              active={draftCargo?.id === c.id}
              onClick={() => setDraftCargo(c)}
            />
          ))}

          {carreirasArea.length === 0 && (
            <div
              className="px-4 py-5 text-center text-xs text-slate-400 italic"
              style={{ gridColumn: '2 / -1' }}
            >
              Nenhuma carreira nessa área ainda. Em breve!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* MINI CARD                                                                 */
/* ------------------------------------------------------------------------- */

interface CarreiraCardMiniProps {
  type: 'real' | 'todas';
  nome: string;
  fotoUrl?: string | null;
  active: boolean;
  onClick: () => void;
}

function CarreiraCardMini({ type, nome, fotoUrl, active, onClick }: CarreiraCardMiniProps) {
  const isTodas = type === 'todas';
  const hasFoto = !!fotoUrl;

  if (isTodas) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={nome}
        className={[
          'relative aspect-square rounded-[10px] overflow-hidden cursor-pointer select-none',
          'border-[1.5px] transition-[transform,box-shadow,opacity] duration-200',
          'flex flex-col items-center justify-center gap-1',
          active
            ? 'border-blue-900 bg-blue-50 text-blue-900'
            : 'border-slate-200 bg-white text-slate-500 opacity-80 hover:-translate-y-px hover:opacity-100',
        ].join(' ')}
      >
        <span className="text-2xl leading-none">✔</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.04em]">Todas</span>
        {active && (
          <span className="absolute top-1.5 right-1.5 w-[18px] h-[18px] rounded-full bg-blue-900 text-white flex items-center justify-center text-[10px] font-black shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
            ✓
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={nome}
      className={[
        'relative aspect-square rounded-[10px] overflow-hidden cursor-pointer select-none',
        'border-2 transition-[transform,box-shadow,filter,opacity] duration-200',
        active
          ? 'border-blue-900 opacity-100 shadow-[0_0_0_3px_rgba(30,58,138,0.10)]'
          : 'border-transparent opacity-78 hover:-translate-y-px hover:opacity-100',
      ].join(' ')}
      style={{
        opacity: active ? 1 : 0.78,
        filter: active ? undefined : 'grayscale(0.35) brightness(0.97)',
        boxShadow: active
          ? '0 0 0 3px rgba(30,58,138,0.10)'
          : '0 1px 2px rgba(15,23,42,0.08)',
      }}
    >
      {hasFoto ? (
        <img
          src={fotoUrl!}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <FallbackBg nome={nome} />
      )}

      {/* Gradient escurecedor pra texto */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(15,23,42,0.10) 40%, rgba(15,23,42,0.88) 100%)',
        }}
      />

      {active && (
        <span className="absolute top-1.5 right-1.5 inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-blue-900 text-white shadow-[0_1px_3px_rgba(0,0,0,0.3)] text-[10px] font-black z-10">
          ✓
        </span>
      )}

      {/* Nome no rodapé (full nome, não sigla) */}
      <div className="absolute bottom-0 left-0 right-0 px-2 pb-1.5 pt-1.5 text-white z-10">
        <div
          className="text-[9.5px] font-bold uppercase tracking-[0.03em] leading-[1.15]"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {nome}
        </div>
      </div>
    </button>
  );
}

function FallbackBg({ nome }: { nome: string }) {
  const sigla = siglaFromNome(nome);
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{
        background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 50%, #2a4365 100%)',
      }}
    >
      <span
        className="text-white/40 font-serif font-bold"
        style={{ fontSize: '20px', letterSpacing: '0.05em' }}
      >
        {sigla}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* HELPERS                                                                   */
/* ------------------------------------------------------------------------- */

function siglaFromNome(nome: string): string {
  // Tenta extrair palavra antes do · ou primeiras 3 letras
  const beforeDot = nome.split(/[·\-:]/)[0]?.trim() ?? nome;
  // Se for tipo "PF" mantém; senão pega primeiras 3 letras
  if (beforeDot.length <= 4) return beforeDot.toUpperCase();
  // Multi-palavra: iniciais até 3
  const words = beforeDot.split(/\s+/);
  if (words.length >= 2) {
    return words
      .slice(0, 3)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }
  return beforeDot.slice(0, 3).toUpperCase();
}

/* ------------------------------------------------------------------------- */
/* PUBLIC API                                                                */
/* ------------------------------------------------------------------------- */

interface CargoSelectorProps {
  state: CargoSelectorContext;
}

interface CargoSelectorExpansionProps extends CargoSelectorProps {
  /** Hook chamado depois de setCargo + close. Recebe (next, prev) pro AppTopNav
   *  conseguir fazer cross-fade do cargo anterior pro novo na transição. */
  onAfterApply?: (next: Carreira | null, prev: Carreira | null) => void;
}

interface CargoSelectorCardProps extends CargoSelectorProps {
  /** Quando true, o card pulsa brevemente (scale 1.06 → 1). Usado pelo
   *  AppTopNav pra dar "anticipation feedback" depois da transição. */
  pulsing?: boolean;
}

export function CargoSelectorCard({ state, pulsing }: CargoSelectorCardProps) {
  return (
    <Card
      open={state.open}
      cargo={state.cargo}
      onToggle={() => state.setOpen(!state.open)}
      pulsing={pulsing}
    />
  );
}

export function CargoSelectorExpansion({ state, onAfterApply }: CargoSelectorExpansionProps) {
  return (
    <Expansion
      open={state.open}
      cargo={state.cargo}
      onApply={(next) => {
        const prev = state.cargo;
        state.setCargo(next);
        state.setOpen(false);
        onAfterApply?.(next, prev);
      }}
      onClose={() => state.setOpen(false)}
    />
  );
}

export { useCargoSelectorState };
export type { CargoSelectorContext };
