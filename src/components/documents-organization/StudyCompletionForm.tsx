import React, { useCallback, useEffect, useState } from 'react';
import { X, ChevronRight, CheckCircle2 } from 'lucide-react';

// ============ Types ============

export interface CompletionData {
  autoAvaliacao: 'facil' | 'medio' | 'dificil';
  tempoReal?: number;
  questoesAcertos?: number;
  questoesErros?: number;
  leisLidas?: string;
  teoriaFinalizada?: boolean;
  comentarios?: string;
}

interface StudyCompletionFormProps {
  topicoNome: string;
  disciplinaNome: string;
  sessionType?: 'estudo' | 'revisao' | 'questoes' | 'lei-seca';
  estimatedMinutes?: number;
  onSave: (data: CompletionData) => void;
  onCancel: () => void;
}

// ============ Constants ============

const AVALIACAO_OPTIONS = [
  {
    value: 'facil' as const,
    label: 'Facil',
    emoji: '\u{1F60E}',
    color: '#059669',
    bgSelected: '#ecfdf5',
    borderSelected: '#059669',
  },
  {
    value: 'medio' as const,
    label: 'Medio',
    emoji: '\u{1F914}',
    color: '#d97706',
    bgSelected: '#fffbeb',
    borderSelected: '#d97706',
  },
  {
    value: 'dificil' as const,
    label: 'Dificil',
    emoji: '\u{1F975}',
    color: '#dc2626',
    bgSelected: '#fef2f2',
    borderSelected: '#dc2626',
  },
] as const;

const SESSION_LABELS: Record<string, string> = {
  estudo: 'Estudo',
  revisao: 'Revisao',
  questoes: 'Questoes',
  'lei-seca': 'Lei Seca',
};

// ============ Helpers ============

function estimateNextReview(acertos: number, erros: number): string {
  const total = acertos + erros;
  if (total === 0) return '---';
  const accuracy = acertos / total;
  if (accuracy >= 0.9) return '~7 dias';
  if (accuracy >= 0.7) return '~4 dias';
  if (accuracy >= 0.5) return '~2 dias';
  return '~1 dia';
}

// ============ Component ============

export const StudyCompletionForm: React.FC<StudyCompletionFormProps> = ({
  topicoNome,
  disciplinaNome,
  sessionType = 'estudo',
  estimatedMinutes,
  onSave,
  onCancel,
}) => {
  const [avaliacao, setAvaliacao] = useState<CompletionData['autoAvaliacao'] | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [tempoReal, setTempoReal] = useState<string>(
    estimatedMinutes != null ? String(estimatedMinutes) : ''
  );
  const [questoesAcertos, setQuestoesAcertos] = useState<string>('');
  const [questoesErros, setQuestoesErros] = useState<string>('');
  const [leisLidas, setLeisLidas] = useState('');
  const [teoriaFinalizada, setTeoriaFinalizada] = useState(false);
  const [comentarios, setComentarios] = useState('');

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onCancel();
    },
    [onCancel]
  );

  const handleConfirm = useCallback(() => {
    if (!avaliacao) return;

    const data: CompletionData = {
      autoAvaliacao: avaliacao,
    };

    if (showDetails) {
      const tempo = parseInt(tempoReal, 10);
      if (!isNaN(tempo) && tempo > 0) data.tempoReal = tempo;

      const acertos = parseInt(questoesAcertos, 10);
      if (!isNaN(acertos)) data.questoesAcertos = acertos;

      const erros = parseInt(questoesErros, 10);
      if (!isNaN(erros)) data.questoesErros = erros;

      if (leisLidas.trim()) data.leisLidas = leisLidas.trim();
      if (teoriaFinalizada) data.teoriaFinalizada = true;
      if (comentarios.trim()) data.comentarios = comentarios.trim();
    }

    onSave(data);
  }, [
    avaliacao,
    showDetails,
    tempoReal,
    questoesAcertos,
    questoesErros,
    leisLidas,
    teoriaFinalizada,
    comentarios,
    onSave,
  ]);

  // FSRS preview data
  const acertosNum = parseInt(questoesAcertos, 10);
  const errosNum = parseInt(questoesErros, 10);
  const showFsrsPreview =
    showDetails &&
    !isNaN(acertosNum) &&
    !isNaN(errosNum) &&
    (acertosNum + errosNum) > 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* ---- Header ---- */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4">
          <div className="min-w-0 pr-4">
            <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#9e99ae]">
              {disciplinaNome}
              {sessionType !== 'estudo' && (
                <> &middot; {SESSION_LABELS[sessionType]}</>
              )}
            </span>
            <h2 className="text-base font-bold text-[#1a1625] leading-snug mt-0.5 truncate">
              {topicoNome}
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#f5f3ff] transition-colors"
          >
            <X className="w-4 h-4 text-[#9e99ae]" />
          </button>
        </div>

        {/* ---- Avaliacao ---- */}
        <div className="px-6 pb-4">
          <label className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#9e99ae] block mb-2.5">
            Como foi?
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            {AVALIACAO_OPTIONS.map((opt) => {
              const isSelected = avaliacao === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setAvaliacao(opt.value)}
                  className="flex flex-col items-center gap-1 py-3.5 px-2 rounded-xl border-2 transition-all duration-150"
                  style={{
                    borderColor: isSelected ? opt.borderSelected : '#f0eef5',
                    backgroundColor: isSelected ? opt.bgSelected : 'transparent',
                    transform: isSelected ? 'scale(1.04)' : 'scale(1)',
                    boxShadow: isSelected
                      ? `0 0 0 3px ${opt.borderSelected}20`
                      : 'none',
                  }}
                >
                  <span className="text-2xl leading-none">{opt.emoji}</span>
                  <span
                    className="text-xs font-semibold"
                    style={{ color: isSelected ? opt.color : '#6b667a' }}
                  >
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ---- Expand toggle ---- */}
        {!showDetails && (
          <div className="px-6 pb-3">
            <button
              onClick={() => setShowDetails(true)}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#6c63ff] hover:text-[#9b8afb] transition-colors"
            >
              Adicionar detalhes
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ---- Detailed Fields ---- */}
        {showDetails && (
          <div className="px-6 pb-4 space-y-3.5 border-t border-[#f0eef5] pt-4 mt-1">
            {/* Tempo real */}
            <div>
              <label className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#9e99ae] block mb-1.5">
                Tempo real gasto (min)
              </label>
              <input
                type="number"
                min={0}
                value={tempoReal}
                onChange={(e) => setTempoReal(e.target.value)}
                placeholder="Ex: 45"
                className="w-full px-3 py-2 border border-[#f0eef5] rounded-lg text-sm text-[#1a1625] placeholder:text-[#9e99ae] focus:outline-none focus:ring-2 focus:ring-[#6c63ff]/25 focus:border-[#6c63ff] transition-colors"
              />
            </div>

            {/* Questoes */}
            <div>
              <label className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#9e99ae] block mb-1.5">
                Questoes
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  type="number"
                  min={0}
                  value={questoesAcertos}
                  onChange={(e) => setQuestoesAcertos(e.target.value)}
                  placeholder="Acertos"
                  className="w-full px-3 py-2 border border-[#f0eef5] rounded-lg text-sm text-[#1a1625] placeholder:text-[#9e99ae] focus:outline-none focus:ring-2 focus:ring-[#059669]/25 focus:border-[#059669] transition-colors"
                />
                <input
                  type="number"
                  min={0}
                  value={questoesErros}
                  onChange={(e) => setQuestoesErros(e.target.value)}
                  placeholder="Erros"
                  className="w-full px-3 py-2 border border-[#f0eef5] rounded-lg text-sm text-[#1a1625] placeholder:text-[#9e99ae] focus:outline-none focus:ring-2 focus:ring-[#dc2626]/25 focus:border-[#dc2626] transition-colors"
                />
              </div>
            </div>

            {/* FSRS preview */}
            {showFsrsPreview && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#f5f3ff] border border-[#eeecfb]">
                <CheckCircle2 className="w-4 h-4 text-[#6c63ff] shrink-0" />
                <span className="text-xs text-[#6b667a]">
                  Baseado no desempenho, proxima revisao em{' '}
                  <strong className="text-[#6c63ff]">
                    {estimateNextReview(acertosNum, errosNum)}
                  </strong>
                </span>
              </div>
            )}

            {/* Artigos lidos */}
            <div>
              <label className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#9e99ae] block mb-1.5">
                Artigos lidos
              </label>
              <input
                type="text"
                value={leisLidas}
                onChange={(e) => setLeisLidas(e.target.value)}
                placeholder="Ex: Art. 121-129"
                className="w-full px-3 py-2 border border-[#f0eef5] rounded-lg text-sm text-[#1a1625] placeholder:text-[#9e99ae] focus:outline-none focus:ring-2 focus:ring-[#6c63ff]/25 focus:border-[#6c63ff] transition-colors"
              />
            </div>

            {/* Teoria finalizada */}
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={teoriaFinalizada}
                  onChange={(e) => setTeoriaFinalizada(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="w-[18px] h-[18px] rounded-[5px] border-2 border-[#f0eef5] peer-checked:border-[#6c63ff] peer-checked:bg-[#6c63ff] transition-all flex items-center justify-center group-hover:border-[#9b8afb]">
                  {teoriaFinalizada && (
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-sm text-[#6b667a] group-hover:text-[#1a1625] transition-colors">
                Teoria finalizada
              </span>
            </label>

            {/* Comentarios */}
            <div>
              <label className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#9e99ae] block mb-1.5">
                Comentarios
              </label>
              <textarea
                rows={2}
                value={comentarios}
                onChange={(e) => setComentarios(e.target.value)}
                placeholder="Observacoes sobre a sessao..."
                className="w-full px-3 py-2 border border-[#f0eef5] rounded-lg text-sm text-[#1a1625] placeholder:text-[#9e99ae] resize-none focus:outline-none focus:ring-2 focus:ring-[#6c63ff]/25 focus:border-[#6c63ff] transition-colors"
              />
            </div>
          </div>
        )}

        {/* ---- Footer Buttons ---- */}
        <div className="flex items-center gap-3 px-6 pb-6 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-[#6b667a] hover:bg-[#f5f3ff] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!avaliacao}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundColor: avaliacao ? '#6c63ff' : '#6c63ff',
            }}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};
