'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLeis, useLei, useDispositivos } from '@/hooks/useLeiApi';
import { useDispositivoUserStatus } from '@/hooks/useDispositivoUserStatus';
import { deriveEstrutura, type EstruturaNode } from '@/lib/lei-seca/derive-estrutura';
import { SearchColumn } from './megamenu/SearchColumn';
import { LawsColumn } from './megamenu/LawsColumn';
import { EstruturaColumn } from './megamenu/EstruturaColumn';

interface Props {
  open: boolean;
  onClose: () => void;
  currentLeiId: string;
  currentNodeId: string | null;
  currentTotalArtigos: number;
  currentPctEstudado: number;
}

export function MegaMenu({
  open,
  onClose,
  currentLeiId,
  currentNodeId,
  currentTotalArtigos,
  currentPctEstudado,
}: Props) {
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [selectedLawId, setSelectedLawId] = useState(currentLeiId);

  const { leis } = useLeis();
  const { lei: selectedLei, isLoading: leiLoading } = useLei(open ? selectedLawId : null);
  const { dispositivos: selectedDispositivos, isLoading: dispLoading } = useDispositivos(
    open ? selectedLawId : null,
  );
  const { data: selectedStatusMap } = useDispositivoUserStatus(
    open && selectedLawId === currentLeiId ? selectedLawId : undefined,
  );

  // Reset selection toda vez que abre
  useEffect(() => {
    if (open) {
      setSelectedLawId(currentLeiId);
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [open, currentLeiId]);

  // Esc fecha
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Trava scroll do body
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Estrutura derivada da hierarquia da lei selecionada
  const estrutura = useMemo(
    () =>
      selectedLei
        ? deriveEstrutura(selectedLei.hierarquia, selectedDispositivos, selectedStatusMap)
        : [],
    [selectedLei, selectedDispositivos, selectedStatusMap],
  );

  // totalArtigos por lei: real só pra lei aberta (props) e pra selecionada (após fetch)
  const totalArtigosByLei = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    map[currentLeiId] = currentTotalArtigos;
    if (selectedLawId !== currentLeiId && selectedDispositivos.length > 0) {
      map[selectedLawId] = selectedDispositivos.filter((d) => d.tipo === 'ARTIGO').length;
    }
    return map;
  }, [currentLeiId, currentTotalArtigos, selectedLawId, selectedDispositivos]);

  const pctByLei = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    map[currentLeiId] = currentPctEstudado;
    return map;
  }, [currentLeiId, currentPctEstudado]);

  if (!open) return null;

  const selectedShortName = selectedLei?.apelido ?? selectedLei?.titulo ?? '—';

  const handleSelectNode = (node: EstruturaNode) => {
    if (selectedLawId === currentLeiId) {
      // Mesma lei aberta → scroll inline pro 1º artigo do nó
      if (node.primeiroArtigoId) {
        const el = document.querySelector(`[data-id="${node.primeiroArtigoId}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      // Outra lei → navega pra rota dela (sem fragment de artigo)
      navigate(`/lei-seca/${selectedLawId}`);
    }
    onClose();
  };

  return (
    <>
      <div
        className="fixed inset-x-0 top-[56px] bottom-0 z-40 bg-[rgba(14,16,20,0.18)] backdrop-blur-[2px] animate-in fade-in duration-150"
        onClick={onClose}
        aria-hidden
      />
      <div
        id="lei-seca-megamenu"
        role="dialog"
        aria-label="Navegar"
        className="fixed inset-x-0 top-[56px] z-50 grid gap-10 bg-n-surface border-b border-n-rule shadow-[0_18px_40px_rgba(14,16,20,.08)] px-16 pt-8 pb-7 animate-in slide-in-from-top-2 duration-150 overflow-hidden"
        style={{
          gridTemplateColumns: '300px 1fr 1fr',
          gridTemplateRows: 'minmax(0, 1fr)',
          height: 'min(560px, calc(100dvh - 56px - 24px))',
        }}
      >
        <div className="h-full min-h-0 overflow-y-auto nordic-scroll pr-1">
          <SearchColumn ref={searchInputRef} />
        </div>
        <div className="h-full min-h-0 overflow-y-auto nordic-scroll pr-1">
          <LawsColumn
            leis={leis}
            selectedLawId={selectedLawId}
            currentLeiId={currentLeiId}
            totalArtigosByLei={totalArtigosByLei}
            pctByLei={pctByLei}
            onSelect={setSelectedLawId}
          />
        </div>
        <div className="h-full min-h-0 overflow-y-auto nordic-scroll pr-1">
          <EstruturaColumn
            shortName={selectedShortName}
            estrutura={estrutura}
            loading={leiLoading || dispLoading}
            activeNodeId={selectedLawId === currentLeiId ? currentNodeId : null}
            onSelect={handleSelectNode}
          />
        </div>
      </div>
    </>
  );
}
