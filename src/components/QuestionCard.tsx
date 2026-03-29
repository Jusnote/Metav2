import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { TextHighlighter } from 'lisere';
import 'lisere/dist/style.css';
import {
  Bookmark,
  GraduationCap,
  Check,
  X,
  PenLine,
  BarChart3,
  MessageCircle,
  Flag,
  BookOpen,
  Sparkles,
  Loader2,
  Scissors,
  Highlighter,
  Strikethrough,
} from 'lucide-react';

// ============================================================
// TYPES
// ============================================================

interface AlternativeStats {
  letter: string;
  percentage: number;
}

interface RespostaAPI {
  questao_id: number;
  alternativa_escolhida: number;
  alternativa_correta: number;
  texto_alternativa_correta: string;
  acertou: boolean;
  stats_globais_atualizadas: {
    total_tentativas: number;
    total_acertos: number;
    taxa_acerto_global: number;
    distribuicao_alternativas?: AlternativeStats[];
  };
}

interface QuestaoCaracteristicasProps {
  anulada?: boolean;
  desatualizada?: boolean;
}

interface QuestionCardProps {
  id: string;
  questaoId: number;
  year: string;
  institution: string;
  exam: string;
  subject: string;
  subtopic: string;
  questionNumber: number;
  totalQuestions: number;
  questionText: string;
  alternatives: { letter: string; text: string }[];
  commentsCount: number;
  // Future-ready optional props
  caracteristicas?: QuestaoCaracteristicasProps;
  taxaAcertoGlobal?: number;
  gabaritoComentado?: string | null;
  onBookmark?: (questaoId: number, saved: boolean) => void;
  onSaveNote?: (questaoId: number, note: string) => void;
  onReportError?: (questaoId: number) => void;
  initialBookmarked?: boolean;
}

// ============================================================
// CONSTANTS
// ============================================================

const SANITIZE_CONFIG = {
  ADD_TAGS: ['table', 'tr', 'td', 'th', 'tbody', 'thead', 'b', 'strong', 'i', 'em', 'u', 'span', 'div', 'p', 'br', 'img', 'ul', 'ol', 'li', 'center', 'font', 'hr', 'blockquote', 'pre', 'code', 'article', 'a', 'sup', 'sub', 'section', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
  ADD_ATTR: ['style', 'align', 'class', 'id', 'href', 'target', 'src', 'width', 'height', 'border', 'cellpadding', 'cellspacing', 'bgcolor', 'color', 'valign', 'data-toggle', 'aria-controls', 'aria-expanded', 'contenteditable'],
  FORCE_BODY: true,
};

function sanitizeHtml(html: string) {
  return { __html: DOMPurify.sanitize(html, SANITIZE_CONFIG) };
}

const bookmarkKey = (id: number) => `questao_bookmark_${id}`;
const noteKey = (id: number) => `questao_note_${id}`;

type HighlightMode = 'highlight' | 'strike';

const HIGHLIGHT_STYLES: Record<HighlightMode, { className: string }> = {
  highlight: { className: 'qc-highlight-mark' },
  strike:    { className: 'qc-strike-mark' },
};

type ExpandableTab = 'gabarito' | 'anotacoes' | 'estatisticas' | null;

// ============================================================
// HELPERS
// ============================================================

function getDifficulty(taxa: number | undefined): { label: string; color: string; dot: string } | null {
  if (taxa === undefined || taxa === null) return null;
  if (taxa > 70) return { label: 'Facil', color: 'text-green-600 dark:text-green-400', dot: 'bg-green-500' };
  if (taxa >= 40) return { label: 'Medio', color: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' };
  return { label: 'Dificil', color: 'text-red-600 dark:text-red-400', dot: 'bg-red-500' };
}

function staggerDelay(index: number): string {
  return `${index * 50}ms`;
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

/** Post-answer stats bar with global accuracy + animated bar */
function StatsBar({ resposta }: { resposta: RespostaAPI }) {
  const taxa = resposta.stats_globais_atualizadas.taxa_acerto_global;
  const total = resposta.stats_globais_atualizadas.total_tentativas;
  const acertos = resposta.stats_globais_atualizadas.total_acertos;

  return (
    <div className="px-5 pb-2.5 qc-stats-enter">
      <div className="flex items-center gap-3 px-3 py-2 bg-zinc-50 dark:bg-zinc-800/30 rounded-lg">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Taxa de acerto global
            </span>
            <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
              {Math.round(taxa)}%
            </span>
          </div>
          <div className="h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
            <div
              className="qc-stat-bar h-full rounded-full"
              style={{
                '--stat-width': `${taxa}%`,
                backgroundColor: taxa > 50 ? 'rgb(34 197 94)' : taxa > 30 ? 'rgb(234 179 8)' : 'rgb(239 68 68)',
              } as React.CSSProperties}
            />
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
            {acertos.toLocaleString('pt-BR')} / {total.toLocaleString('pt-BR')}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Gabarito comentado expandable section */
function GabaritoComentadoSection({ html }: { html?: string | null }) {
  if (html) {
    return (
      <div className="px-5 py-3">
        <div
          className="prose prose-sm prose-zinc dark:prose-invert max-w-none text-[13px]"
          dangerouslySetInnerHTML={sanitizeHtml(html)}
        />
      </div>
    );
  }
  return (
    <div className="px-5 py-4 text-center">
      <BookOpen className="w-6 h-6 text-zinc-300 dark:text-zinc-600 mb-1 mx-auto" />
      <p className="text-xs text-zinc-400 dark:text-zinc-500">
        Gabarito comentado ainda nao disponivel para esta questao.
      </p>
    </div>
  );
}

/** Personal notes with localStorage persistence */
function AnotacoesSection({ questaoId, onSaveNote }: { questaoId: number; onSaveNote?: (id: number, note: string) => void }) {
  const [note, setNote] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(noteKey(questaoId)) || '';
  });
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback(() => {
    localStorage.setItem(noteKey(questaoId), note);
    setSaved(true);
    onSaveNote?.(questaoId, note);
    setTimeout(() => setSaved(false), 1500);
  }, [note, questaoId, onSaveNote]);

  return (
    <div className="px-5 py-3">
      <textarea
        value={note}
        onChange={(e) => { setNote(e.target.value); setSaved(false); }}
        placeholder="Escreva suas anotacoes sobre esta questao..."
        className="w-full min-h-[80px] p-2.5 text-xs text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg resize-y focus:outline-none focus:ring-1 focus:ring-amber-500/30 placeholder:text-zinc-400"
        rows={3}
      />
      <div className="flex items-center justify-end gap-2 mt-1.5">
        {saved && <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">Salvo!</span>}
        <button
          onClick={handleSave}
          className="px-3 py-1 text-[11px] font-medium text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
        >
          Salvar
        </button>
      </div>
    </div>
  );
}

/** Detailed stats grid */
function EstatisticasSection({ resposta, taxaAcertoGlobal }: { resposta: RespostaAPI | null; taxaAcertoGlobal?: number }) {
  const taxa = resposta?.stats_globais_atualizadas.taxa_acerto_global ?? taxaAcertoGlobal;
  const total = resposta?.stats_globais_atualizadas.total_tentativas;
  const acertos = resposta?.stats_globais_atualizadas.total_acertos;
  const difficulty = getDifficulty(taxa);

  return (
    <div className="px-5 py-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="flex flex-col items-center p-2.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
          <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">Taxa Global</span>
          <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{taxa !== undefined ? `${Math.round(taxa)}%` : '--'}</span>
        </div>
        <div className="flex flex-col items-center p-2.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
          <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">Respostas</span>
          <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{total?.toLocaleString('pt-BR') ?? '--'}</span>
        </div>
        <div className="flex flex-col items-center p-2.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
          <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">Acertos</span>
          <span className="text-lg font-bold text-green-600 dark:text-green-400">{acertos?.toLocaleString('pt-BR') ?? '--'}</span>
        </div>
        <div className="flex flex-col items-center p-2.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
          <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">Dificuldade</span>
          {difficulty ? (
            <span className={`text-lg font-bold ${difficulty.color}`}>{difficulty.label}</span>
          ) : (
            <span className="text-lg font-bold text-zinc-300">--</span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Inline AI explanation for a single alternative */
function AIExplanation({ text, isLoading }: { text: string; isLoading: boolean }) {
  if (!text && isLoading) {
    return (
      <div className="mt-1.5 pl-3 border-l-2 border-amber-400/30 dark:border-amber-500/25 flex items-center gap-1.5 qc-ai-enter">
        <Loader2 className="w-3 h-3 animate-spin text-amber-500/60" />
        <span className="text-[12px] text-zinc-400 dark:text-zinc-500">Analisando...</span>
      </div>
    );
  }

  if (!text.trim()) return null;

  return (
    <div className="mt-1.5 pl-3 border-l-2 border-amber-400/30 dark:border-amber-500/25 qc-ai-enter">
      <p className="text-[12px] leading-[1.65] text-zinc-600 dark:text-zinc-400 whitespace-pre-line">
        {text.trim()}
        {isLoading && <span className="qc-ai-cursor" />}
      </p>
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export const QuestionCard = React.memo(function QuestionCard({
  id,
  questaoId,
  year,
  institution,
  exam,
  subject,
  subtopic,
  questionNumber,
  totalQuestions,
  questionText,
  alternatives,
  commentsCount,
  caracteristicas,
  taxaAcertoGlobal,
  gabaritoComentado,
  onBookmark,
  onSaveNote,
  onReportError,
  initialBookmarked,
}: QuestionCardProps) {
  const [selectedAlternative, setSelectedAlternative] = useState<string | null>(null);
  const [resposta, setResposta] = useState<RespostaAPI | null>(null);
  const [loading, setLoading] = useState(false);
  const [respondido, setRespondido] = useState(false);
  const [revealAnimating, setRevealAnimating] = useState(false);
  const [eliminatedAlts, setEliminatedAlts] = useState<Set<string>>(new Set());
  const [highlightMode, setHighlightMode] = useState<HighlightMode>('highlight');

  // Bookmark state (localStorage fallback)
  const [bookmarked, setBookmarked] = useState(() => {
    if (initialBookmarked !== undefined) return initialBookmarked;
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(bookmarkKey(questaoId)) === '1';
  });

  // Expandable tabs
  const [activeTab, setActiveTab] = useState<ExpandableTab>(null);
  const toggleTab = useCallback((tab: ExpandableTab) => {
    setActiveTab(prev => prev === tab ? null : tab);
  }, []);

  // AI explanations per alternative
  const [explanations, setExplanations] = useState<Map<string, string>>(new Map());
  const [loadingExplanations, setLoadingExplanations] = useState<Set<string>>(new Set());
  const activeRequestsRef = useRef<Set<string>>(new Set());
  const explanationsRef = useRef<Map<string, string>>(new Map());

  // Keep ref in sync with state
  useEffect(() => { explanationsRef.current = explanations; }, [explanations]);

  const fetchExplanation = useCallback(async (letter: string) => {
    // Guard via refs to avoid stale closure issues
    if (activeRequestsRef.current.has(letter) || !resposta) return;
    if (explanationsRef.current.has(letter)) return;

    activeRequestsRef.current.add(letter);

    const altIndex = letter.charCodeAt(0) - 65;
    const altText = alternatives[altIndex]?.text || '';
    const isCorrect = letter === String.fromCharCode(65 + resposta.alternativa_correta);

    setLoadingExplanations(prev => new Set(prev).add(letter));

    try {
      const res = await fetch('/api/ai/explain-alternative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionText: questionText.slice(0, 1000),
          alternativeText: altText.replace(/<[^>]*>/g, '').slice(0, 500),
          alternativeLetter: letter,
          isCorrect,
          subject,
          subtopic,
        }),
      });

      if (!res.ok) throw new Error('Failed');

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader');

      const decoder = new TextDecoder();
      let accumulated = '';

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // Flush remaining bytes
          const remaining = decoder.decode();
          if (remaining) {
            accumulated += remaining;
            setExplanations(prev => new Map(prev).set(letter, accumulated));
          }
          break;
        }
        accumulated += decoder.decode(value, { stream: true });
        setExplanations(prev => new Map(prev).set(letter, accumulated));
      }
    } catch {
      setExplanations(prev => {
        if (prev.has(letter) && prev.get(letter)!.length > 0) return prev;
        return new Map(prev).set(letter, 'Erro ao gerar explicacao.');
      });
    } finally {
      activeRequestsRef.current.delete(letter);
      setLoadingExplanations(prev => {
        const next = new Set(prev);
        next.delete(letter);
        return next;
      });
    }
  // Stable deps only — no state in deps to avoid closure recreation mid-stream
  }, [resposta, alternatives, questionText, subject, subtopic]);

  const fetchAllExplanations = useCallback(() => {
    if (!resposta) return;
    alternatives.forEach(alt => {
      if (!activeRequestsRef.current.has(alt.letter)) {
        fetchExplanation(alt.letter);
      }
    });
  }, [resposta, alternatives, fetchExplanation]);

  const articleRef = useRef<HTMLElement>(null);
  const questionBodyRef = useRef<HTMLDivElement>(null);

  // Derived difficulty
  const effectiveTaxa = resposta?.stats_globais_atualizadas.taxa_acerto_global ?? taxaAcertoGlobal;
  const difficulty = getDifficulty(effectiveTaxa);

  // Memoized sanitized HTML
  const sanitizedQuestion = useMemo(() => sanitizeHtml(questionText), [questionText]);
  const sanitizedAlternatives = useMemo(
    () => alternatives.map(alt => ({ letter: alt.letter, html: sanitizeHtml(alt.text) })),
    [alternatives]
  );

  const letraCorreta = useMemo(() => {
    if (!resposta) return '';
    return String.fromCharCode(65 + resposta.alternativa_correta);
  }, [resposta]);

  // Per-alternative % for inline display
  const altPercentages = useMemo(() => {
    if (!resposta) return null;
    const dist = resposta.stats_globais_atualizadas.distribuicao_alternativas;
    if (dist && dist.length > 0) {
      const map = new Map<string, number>();
      dist.forEach(d => map.set(d.letter, d.percentage));
      return map;
    }
    const taxa = resposta.stats_globais_atualizadas.taxa_acerto_global;
    const correctPct = Math.round(taxa);
    const wrongCount = alternatives.length - 1;
    const eachWrong = wrongCount > 0 ? Math.round((100 - correctPct) / wrongCount) : 0;
    const map = new Map<string, number>();
    alternatives.forEach(alt => {
      map.set(alt.letter, alt.letter === letraCorreta ? correctPct : eachWrong);
    });
    return map;
  }, [resposta, alternatives, letraCorreta]);

  // Handlers
  const toggleBookmark = useCallback(() => {
    const next = !bookmarked;
    setBookmarked(next);
    localStorage.setItem(bookmarkKey(questaoId), next ? '1' : '0');
    onBookmark?.(questaoId, next);
  }, [bookmarked, questaoId, onBookmark]);

  const handleAlternativeClick = useCallback((letter: string) => {
    // Don't select alternative if user is highlighting text
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) return;

    if (respondido || eliminatedAlts.has(letter)) return;
    setSelectedAlternative(prev => prev === letter ? null : letter);
  }, [respondido, eliminatedAlts]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, letter: string) => {
    if (respondido) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelectedAlternative(prev => prev === letter ? null : letter);
    }
  }, [respondido]);

  const toggleEliminate = useCallback((letter: string) => {
    if (respondido) return;
    setEliminatedAlts(prev => {
      const next = new Set(prev);
      if (next.has(letter)) {
        next.delete(letter);
      } else {
        next.add(letter);
        // If eliminated the currently selected, deselect it
        if (selectedAlternative === letter) setSelectedAlternative(null);
      }
      return next;
    });
  }, [respondido, selectedAlternative]);

  const handleResponder = useCallback(async () => {
    if (!selectedAlternative || respondido) return;
    const indice = selectedAlternative.charCodeAt(0) - 65;

    setLoading(true);
    try {
      const response = await fetch(
        `https://api.projetopapiro.com.br/api/v1/questoes/${questaoId}/responder`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ resposta_usuario: indice }),
        }
      );
      if (!response.ok) throw new Error('Erro ao enviar resposta');
      const data: RespostaAPI = await response.json();
      setResposta(data);
      setRespondido(true);
      setTimeout(() => setRevealAnimating(true), 150);
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedAlternative, respondido, questaoId]);

  // Global Enter shortcut when card is focused
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (!articleRef.current?.contains(document.activeElement)) return;
      if (e.key === 'Enter' && selectedAlternative && !respondido && !loading) {
        e.preventDefault();
        handleResponder();
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [selectedAlternative, respondido, loading, handleResponder]);

  // Bootstrap collapse toggle (texto associado)
  useEffect(() => {
    const container = questionBodyRef.current;
    if (!container) return;

    const collapseEls = container.querySelectorAll<HTMLElement>('.collapse');
    if (collapseEls.length === 0) return;

    collapseEls.forEach(el => {
      el.style.display = 'none';
      el.style.visibility = 'visible'; // Override Tailwind's .collapse utility
    });

    const cleanups: (() => void)[] = [];

    container.querySelectorAll<HTMLAnchorElement>('a[href^="."]').forEach(link => {
      const targetClass = link.getAttribute('href')!.slice(1);
      const target = container.querySelector<HTMLElement>(`.${targetClass}.collapse`);
      if (!target) return;

      link.style.cursor = 'pointer';
      link.style.color = 'rgb(37 99 235)';

      const handler = (e: Event) => {
        e.preventDefault();
        const isHidden = target.style.display === 'none';
        target.style.display = isHidden ? 'block' : 'none';
      };

      link.addEventListener('click', handler);
      cleanups.push(() => link.removeEventListener('click', handler));
    });

    return () => cleanups.forEach(fn => fn());
  }, [sanitizedQuestion]);

  // Alternative class builder
  const getAltClasses = (letter: string, index: number) => {
    const isSelected = selectedAlternative === letter;
    const isCorrect = letter === letraCorreta;

    const isEliminated = eliminatedAlts.has(letter);

    if (!respondido || !revealAnimating) {
      if (isEliminated) {
        return {
          row: 'qc-alt-row qc-alt-eliminated',
          circle: 'qc-alt-circle qc-circle-eliminated',
          text: 'text-zinc-300 dark:text-zinc-600',
          icon: null as string | null,
          stagger: '',
        };
      }
      return {
        row: `qc-alt-row ${isSelected ? 'qc-alt-selected' : 'qc-alt-default'}`,
        circle: `qc-alt-circle ${isSelected ? 'qc-circle-selected' : 'qc-circle-default'}`,
        text: isSelected ? 'text-zinc-900 dark:text-zinc-100 font-medium' : 'text-zinc-700 dark:text-zinc-300',
        icon: null as string | null,
        stagger: '',
      };
    }

    if (isCorrect) {
      return {
        row: 'qc-alt-row qc-alt-correct qc-reveal-correct',
        circle: 'qc-alt-circle qc-circle-correct',
        text: 'text-zinc-900 dark:text-zinc-100 font-semibold',
        icon: 'check',
        stagger: staggerDelay(index),
      };
    }

    if (isSelected && !isCorrect) {
      return {
        row: 'qc-alt-row qc-alt-wrong qc-reveal-wrong',
        circle: 'qc-alt-circle qc-circle-wrong',
        text: 'text-zinc-400 dark:text-zinc-500 opacity-60',
        icon: 'close',
        stagger: staggerDelay(index),
      };
    }

    return {
      row: 'qc-alt-row qc-alt-dimmed',
      circle: 'qc-alt-circle qc-circle-default',
      text: 'text-zinc-500 dark:text-zinc-500',
      icon: null,
      stagger: staggerDelay(index),
    };
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <article ref={articleRef} className="qc-card-enter text-left">

      {/* ── BANNER / HEADER ── */}
      <header className="qc-banner px-4 py-2">

        {/* Row 1: Materia / Assunto inside highlighted box */}
        <div className="flex items-center gap-2 mb-1.5">
          <div className="qc-prova-box flex items-center gap-3 min-w-0 flex-1 px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800/30 rounded-md border-l-2 border-l-amber-400/40 dark:border-l-amber-500/30">
            {/* Icon */}
            <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-zinc-100 dark:bg-zinc-700/40 rounded-full">
              <GraduationCap className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
            </div>

            {/* Materia */}
            <div className="flex-shrink-0">
              <p className="text-[8px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest leading-none mb-0.5">Materia</p>
              <p className="text-[12px] font-semibold text-zinc-800 dark:text-zinc-200 leading-none">{subject}</p>
            </div>

            {/* Separator */}
            <div className="w-px self-stretch my-1 bg-zinc-200 dark:bg-zinc-700" />

            {/* Assunto */}
            <div className="min-w-0 flex-1">
              <p className="text-[8px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest leading-none mb-0.5">Assunto</p>
              <p className="text-[12px] font-medium text-zinc-800 dark:text-zinc-200 truncate leading-none" title={subtopic}>{subtopic}</p>
            </div>

            {caracteristicas?.anulada && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[8px] font-bold uppercase tracking-[0.08em] border border-red-300/40 text-red-500/70 shrink-0">
                Anulada
              </span>
            )}
            {caracteristicas?.desatualizada && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[8px] font-bold uppercase tracking-[0.08em] border border-amber-300/40 text-amber-500/70 shrink-0">
                Desatualizada
              </span>
            )}
          </div>
        </div>

        {/* Row 2: Banca · Ano · Prova (plain text) + counter + ID + bookmark + difficulty + tools */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 shrink-0">{institution}</span>
            <span className="text-zinc-300 dark:text-zinc-600 text-[11px] shrink-0">·</span>
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0">{year}</span>
            <span className="text-zinc-300 dark:text-zinc-600 text-[11px] shrink-0">·</span>
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate" title={exam}>{exam}</span>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Counter + ID */}
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
              Q <span className="font-semibold text-zinc-800 dark:text-zinc-200">{questionNumber}</span>
              <span className="text-zinc-400 dark:text-zinc-500">/{totalQuestions}</span>
            </span>
            <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
              {id}
            </span>

            {/* Bookmark */}
            <button
              onClick={toggleBookmark}
              className="p-0.5 rounded hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
              aria-label={bookmarked ? 'Remover marcacao' : 'Salvar questao'}
            >
              <Bookmark
                className={`w-[18px] h-[18px] transition-colors ${
                  bookmarked ? 'text-amber-500 dark:text-amber-400 fill-amber-500 dark:fill-amber-400' : 'text-zinc-400 dark:text-zinc-500 hover:text-amber-500'
                }`}
              />
            </button>

            {/* Difficulty */}
            {difficulty && (
              <div className="flex items-center gap-1 ml-1" title={`Dificuldade: ${difficulty.label}`}>
                <span className={`w-2 h-2 rounded-full ${difficulty.dot}`} />
                <span className={`text-[10px] font-semibold ${difficulty.color}`}>{difficulty.label}</span>
              </div>
            )}

            {/* Highlight tools */}
            <button
              type="button"
              onClick={() => setHighlightMode('highlight')}
              className={`p-1 rounded transition-colors ${
                highlightMode === 'highlight'
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                  : 'text-zinc-400 dark:text-zinc-500 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'
              }`}
              title="Modo destaque"
            >
              <Highlighter className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => setHighlightMode('strike')}
              className={`p-1 rounded transition-colors ${
                highlightMode === 'strike'
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                  : 'text-zinc-400 dark:text-zinc-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
              }`}
              title="Modo riscar"
            >
              <Strikethrough className="w-3 h-3" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Thin separator between header and body ── */}
      <div className="mx-4 h-px bg-zinc-100 dark:bg-zinc-800" />

      {/* ── QUESTION BODY ── */}
      <div className="px-5 pt-3 pb-5" ref={questionBodyRef}>
        <TextHighlighter
          highlightStyle={HIGHLIGHT_STYLES[highlightMode]}
          selectionBoundary="word"
          allowCrossElementSelection={false}
          removeHighlightOnClick={true}
        >
          <div
            className="prose prose-sm prose-zinc dark:prose-invert max-w-none text-[#374151] dark:text-zinc-100 leading-[1.8] text-[15.5px] [&_p]:text-[15.5px] [&_p]:leading-[1.8] [&_p]:my-1 text-left"
            style={{ fontFamily: "'Nunito', sans-serif" }}
            dangerouslySetInnerHTML={sanitizedQuestion}
          />
        </TextHighlighter>
      </div>

      {/* ── ALTERNATIVES ── */}
      <div className="px-10 pb-4 space-y-px" role="radiogroup" aria-label="Alternativas">
        {sanitizedAlternatives.map((alt, index) => {
          const classes = getAltClasses(alt.letter, index);
          const pct = altPercentages?.get(alt.letter);
          const explanation = explanations.get(alt.letter);
          const isExplaining = loadingExplanations.has(alt.letter);
          const showExplainBtn = respondido && revealAnimating && !explanation && !isExplaining;
          const isEliminated = eliminatedAlts.has(alt.letter);

          return (
            <div key={alt.letter}>
              <div className="group/alt flex items-center">
                {/* Eliminate button — always subtly visible, accented on hover */}
                {!respondido && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleEliminate(alt.letter); }}
                    className={`w-7 h-7 -mr-1 flex items-center justify-center rounded-md flex-shrink-0 transition-all duration-200 ${
                      isEliminated
                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                        : 'opacity-0 group-hover/alt:opacity-100 text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-500 dark:hover:text-zinc-400'
                    }`}
                    title={isEliminated ? 'Restaurar alternativa' : 'Eliminar alternativa'}
                  >
                    <Scissors className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  onClick={() => handleAlternativeClick(alt.letter)}
                  onKeyDown={(e) => handleKeyDown(e, alt.letter)}
                  disabled={respondido || isEliminated}
                  role="radio"
                  aria-checked={selectedAlternative === alt.letter}
                  tabIndex={isEliminated ? -1 : 0}
                  className={`${classes.row} flex-1 transition-opacity duration-200 ${isEliminated && !respondido ? 'opacity-40' : ''}`}
                  style={classes.stagger ? { animationDelay: classes.stagger } : undefined}
                >
                  {/* Letter circle */}
                  <span className={`${classes.circle} relative`}>
                    {classes.icon ? (
                      classes.icon === 'check'
                        ? <Check className="w-3 h-3 qc-icon-reveal" />
                        : <X className="w-3 h-3 qc-icon-reveal" />
                    ) : (
                      <>
                        {alt.letter}
                        {/* Diagonal strike on eliminated circle */}
                        {isEliminated && !respondido && (
                          <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="block w-[120%] h-[1.5px] bg-zinc-400 dark:bg-zinc-500 rotate-[-45deg] rounded-full" />
                          </span>
                        )}
                      </>
                    )}
                  </span>

                  {/* Alternative text */}
                  <TextHighlighter
                    highlightStyle={HIGHLIGHT_STYLES[highlightMode]}
                    selectionBoundary="word"
                    allowCrossElementSelection={false}
                    removeHighlightOnClick={true}
                    className="pt-px leading-[1.5] flex-1"
                  >
                    <div
                      className={`prose prose-sm dark:prose-invert max-w-none text-[14px] [&_p]:text-[14px] [&_p]:my-0.5 leading-[1.7] [&_p]:leading-[1.7] transition-colors duration-200 ${classes.text}`}
                      style={{ fontFamily: "'Nunito', sans-serif" }}
                      dangerouslySetInnerHTML={alt.html}
                    />
                  </TextHighlighter>
                </button>

                {/* Post-answer: % + explain (outside disabled button, same row) */}
                {respondido && revealAnimating && (
                  <span className="flex items-center gap-1 flex-shrink-0 pr-3">
                    {pct !== undefined && (
                      <span className={`text-[11px] font-semibold tabular-nums qc-icon-reveal ${
                        alt.letter === letraCorreta ? 'text-green-600 dark:text-green-400' : 'text-zinc-400 dark:text-zinc-500'
                      }`}>
                        {pct}%
                      </span>
                    )}
                    {showExplainBtn && (
                      <button
                        onClick={() => fetchExplanation(alt.letter)}
                        className="p-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer qc-icon-reveal"
                        title="Explicar com IA"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors" />
                      </button>
                    )}
                  </span>
                )}
              </div>

              {/* AI explanation inline */}
              {(explanation || isExplaining) && (
                <div className="ml-[2.125rem] mr-3 mb-1">
                  <AIExplanation text={explanation || ''} isLoading={isExplaining} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── STATS BAR (post-answer) ── */}
      {respondido && resposta && revealAnimating && (
        <StatsBar resposta={resposta} />
      )}

      {/* ── FOOTER ── */}
      <footer className="border-t border-zinc-100 dark:border-zinc-800/50">
        <div className="px-4 py-1.5 flex items-center justify-between gap-2">

          {/* Left: tab toggles + actions */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => toggleTab('gabarito')}
              className={`qc-footer-btn inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium rounded-md transition-all duration-200 ${
                activeTab === 'gabarito' ? 'text-zinc-900 bg-zinc-100 dark:text-zinc-100 dark:bg-zinc-800' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:text-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              <GraduationCap className="w-[15px] h-[15px]" />
              <span className="hidden sm:inline">Gabarito</span>
            </button>

            <button
              onClick={() => toggleTab('anotacoes')}
              className={`qc-footer-btn inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium rounded-md transition-all duration-200 ${
                activeTab === 'anotacoes' ? 'text-zinc-900 bg-zinc-100 dark:text-zinc-100 dark:bg-zinc-800' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:text-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              <PenLine className="w-[15px] h-[15px]" />
              <span className="hidden sm:inline">Anotacoes</span>
            </button>

            <button
              onClick={() => toggleTab('estatisticas')}
              className={`qc-footer-btn inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium rounded-md transition-all duration-200 ${
                activeTab === 'estatisticas' ? 'text-zinc-900 bg-zinc-100 dark:text-zinc-100 dark:bg-zinc-800' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:text-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              <BarChart3 className="w-[15px] h-[15px]" />
              <span className="hidden sm:inline">Estatisticas</span>
            </button>

            <span className="w-0.5 h-3 bg-zinc-200 dark:bg-zinc-700 mx-1 rounded-full" />

            <button className="qc-footer-btn inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-all duration-200">
              <MessageCircle className="w-[15px] h-[15px]" />
              <span>{commentsCount}</span>
            </button>

            <button
              onClick={() => onReportError?.(questaoId)}
              className="qc-footer-btn inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:text-amber-400 dark:hover:bg-amber-900/20 rounded-md transition-all duration-200"
              title="Reportar erro"
            >
              <Flag className="w-[15px] h-[15px]" />
            </button>

            {respondido && revealAnimating && (
              <>
                <span className="w-0.5 h-3 bg-zinc-200 dark:bg-zinc-700 mx-1 rounded-full" />
                <button
                  onClick={fetchAllExplanations}
                  disabled={loadingExplanations.size > 0 && explanations.size === alternatives.length}
                  className="qc-footer-btn inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-all duration-200"
                  title="Explicar todas as alternativas com IA"
                >
                  <Sparkles className="w-[15px] h-[15px]" />
                  <span className="hidden sm:inline">Explicar todas</span>
                </button>
              </>
            )}
          </div>

          {/* Right: Answer button or result badge */}
          {respondido && resposta ? (
            <div className={`px-3 py-1 font-semibold rounded-md flex items-center gap-1.5 text-xs ${
              resposta.acertou
                ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border border-green-200/60 dark:border-green-800/40'
                : 'bg-zinc-50 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 border border-zinc-200/60 dark:border-zinc-700/40'
            } ${revealAnimating ? 'qc-badge-enter' : 'opacity-0'}`}>
              {resposta.acertou ? (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                  <path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="qc-check-draw" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                  <path d="M4 8H10.5M10.5 8L8 5.5M10.5 8L8 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="qc-arrow-draw" />
                </svg>
              )}
              {resposta.acertou ? 'Correto' : `Gabarito: ${letraCorreta}`}
            </div>
          ) : (
            <button
              onClick={handleResponder}
              disabled={!selectedAlternative || loading}
              className="qc-submit-btn px-5 py-2 text-[13px] font-semibold text-white rounded-lg bg-[#E8930C] hover:bg-[#D4860B] active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/30 focus-visible:ring-offset-2 shadow-[0_1px_4px_rgba(232,147,12,0.25)] hover:shadow-[0_2px_8px_rgba(232,147,12,0.30)] transition-all duration-200"
            >
              {loading ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="qc-spinner w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" />
                  Enviando...
                </span>
              ) : (
                'Responder'
              )}
            </button>
          )}
        </div>

        {/* Expandable sections */}
        {activeTab && (
          <div className="border-t border-zinc-100 dark:border-zinc-800/50 qc-stats-enter">
            {activeTab === 'gabarito' && <GabaritoComentadoSection html={gabaritoComentado} />}
            {activeTab === 'anotacoes' && <AnotacoesSection questaoId={questaoId} onSaveNote={onSaveNote} />}
            {activeTab === 'estatisticas' && <EstatisticasSection resposta={resposta} taxaAcertoGlobal={taxaAcertoGlobal} />}
          </div>
        )}
      </footer>
    </article>
  );
});
