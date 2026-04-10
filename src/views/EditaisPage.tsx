"use client"

import { useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { IconSearch, IconChevronRight, IconLoader2 } from "@tabler/icons-react"
import { motion, AnimatePresence } from "motion/react"
import { cn } from "@/lib/utils"
import { useEditais } from "@/hooks/useEditais"
import { usePlanosEstudo } from "@/hooks/usePlanosEstudo"
import type { EditalResumo, EsferaFilter } from "@/types/editais"

// --- Esfera badge colors ---
const esferaColors: Record<string, { bg: string; text: string }> = {
  federal: { bg: "bg-[#eeecfb]", text: "text-[#6c63ff]" },
  estadual: { bg: "bg-[#e8f1fd]", text: "text-[#4a8fe7]" },
  municipal: { bg: "bg-[#e4f8f0]", text: "text-[#2da87a]" },
}

function getEsferaStyle(esfera: string | null) {
  if (!esfera) return esferaColors.federal
  const key = esfera.toLowerCase()
  return esferaColors[key] ?? esferaColors.federal
}

// --- Format large numbers ---
function formatTopicos(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2).replace(".", ",") + "M"
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1).replace(".", ",")
  return String(n)
}

// --- Segmented control ---
const esferaOptions: { value: EsferaFilter; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "federal", label: "Federal" },
  { value: "estadual", label: "Estadual" },
  { value: "municipal", label: "Municipal" },
]

export default function EditaisPage() {
  const navigate = useNavigate()
  const {
    busca, esfera, openEditalId, loadingDetailId, detailError,
    editais, paginacao, isLoading, error, expandedEdital,
    setBusca, setEsfera, setPagina, toggleEdital,
  } = useEditais()
  const { findPlanoByEdital } = usePlanosEstudo()

  const handleGoToCargo = useCallback((editalId: number, cargoId: number) => {
    navigate(`/documents-organization?editalId=${editalId}&cargoId=${cargoId}`)
  }, [navigate])

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="max-w-[900px] w-full mx-auto px-6 py-9 pb-20">

        {/* ---- Hero ---- */}
        <div className="flex justify-between items-end mb-7">
          <div>
            <h1 className="text-[26px] font-extrabold tracking-tight mb-1.5">
              Editais{" "}
              <span className="bg-gradient-to-r from-[#6c63ff] to-[#9b8afb] bg-clip-text text-transparent">
                verticalizados
              </span>
            </h1>
            <p className="text-sm text-[#9994a8] max-w-[400px] leading-relaxed">
              Selecione um concurso, escolha seu cargo e estude o conteúdo programático completo.
            </p>
          </div>
          {paginacao && (
            <div className="flex gap-5">
              <HeroStat value={paginacao.total} label="Editais" />
            </div>
          )}
        </div>

        {/* ---- Search + Filter ---- */}
        <div className="flex gap-3 mb-5">
          <div className="flex-1 relative">
            <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[15px] w-[15px] text-[#c4c0ce]" />
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por nome, sigla ou órgão..."
              className="w-full bg-white border-[1.5px] border-[#eae8ee] rounded-xl py-[11px] pl-10 pr-4 text-sm text-[#1a1a1a] outline-none transition-all font-[inherit] placeholder:text-[#c4c0ce] focus:border-[#6c63ff] focus:shadow-[0_0_0_4px_rgba(108,99,255,0.06)]"
            />
          </div>
          <div className="inline-flex bg-[#f0eff2] rounded-[10px] p-[3px]">
            {esferaOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setEsfera(opt.value)}
                className={cn(
                  "px-[15px] py-[7px] rounded-lg text-xs font-medium cursor-pointer transition-all select-none",
                  esfera === opt.value
                    ? "bg-white text-[#1a1a1a] shadow-[0_1px_3px_rgba(0,0,0,0.06)] font-semibold"
                    : "text-[#9994a8] hover:text-[#6c63ff]"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ---- Section title ---- */}
        <div className="text-xs font-bold text-[#b0adb8] uppercase tracking-wider mb-3">
          {esfera === "todos" ? "Todos os editais" : `Editais — ${esfera}`}
        </div>

        {/* ---- Loading ---- */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <IconLoader2 className="h-6 w-6 text-[#6c63ff] animate-spin" />
          </div>
        )}

        {/* ---- Error ---- */}
        {error && !isLoading && (
          <div className="text-center py-20 text-sm text-red-400">
            Erro ao carregar editais: {error}
          </div>
        )}

        {/* ---- Empty ---- */}
        {!isLoading && !error && editais.length === 0 && (
          <div className="text-center py-20 text-sm text-[#b0adb8]">
            Nenhum edital encontrado.
          </div>
        )}

        {/* ---- Card list ---- */}
        {!isLoading && !error && editais.length > 0 && (
          <div className="flex flex-col gap-2">
            {editais.map(ed => (
              <EditalCard
                key={ed.id}
                edital={ed}
                isOpen={openEditalId === ed.id}
                onToggle={() => toggleEdital(ed.id)}
                expandedCargos={openEditalId === ed.id ? expandedEdital?.cargos ?? null : null}
                loadingCargos={openEditalId === ed.id && loadingDetailId === ed.id}
                detailError={openEditalId === ed.id ? detailError : null}
                onGoToCargo={(cargoId) => handleGoToCargo(ed.id, cargoId)}
                findPlanoByEdital={findPlanoByEdital}
              />
            ))}
          </div>
        )}

        {/* ---- Pagination ---- */}
        {paginacao && paginacao.totalPaginas > 1 && (
          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              disabled={paginacao.pagina <= 1}
              onClick={() => setPagina(paginacao.pagina - 1)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[#6c63ff] hover:bg-[#f5f3ff] disabled:opacity-30 disabled:cursor-default transition-colors"
            >
              ← Anterior
            </button>
            <span className="text-xs text-[#b0adb8] tabular-nums">
              {paginacao.pagina} / {paginacao.totalPaginas}
            </span>
            <button
              disabled={paginacao.pagina >= paginacao.totalPaginas}
              onClick={() => setPagina(paginacao.pagina + 1)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[#6c63ff] hover:bg-[#f5f3ff] disabled:opacity-30 disabled:cursor-default transition-colors"
            >
              Próxima →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// --- Sub-components ---

function HeroStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-right">
      <div className="text-[22px] font-extrabold tabular-nums tracking-tight">
        {value.toLocaleString("pt-BR")}
      </div>
      <div className="text-[11px] text-[#b0adb8]">{label}</div>
    </div>
  )
}

interface EditalCardProps {
  edital: EditalResumo
  isOpen: boolean
  onToggle: () => void
  expandedCargos: { id: number; nome: string; qtdDisciplinas: number | null; qtdTopicos: number | null }[] | null
  loadingCargos: boolean
  detailError: string | null
  onGoToCargo: (cargoId: number) => void
  findPlanoByEdital?: (editalId: number, cargoId: number) => any
}

function EditalCard({ edital, isOpen, onToggle, expandedCargos, loadingCargos, detailError, onGoToCargo, findPlanoByEdital }: EditalCardProps) {
  const esferaStyle = getEsferaStyle(edital.esfera)

  return (
    <div
      className={cn(
        "bg-white border-[1.5px] rounded-[13px] transition-all overflow-hidden",
        isOpen
          ? "border-[#6c63ff] shadow-[0_4px_20px_rgba(108,99,255,0.08)]"
          : "border-[#eae8ee] hover:border-[#d4d0f0] hover:shadow-[0_2px_10px_rgba(108,99,255,0.05)] cursor-pointer"
      )}
    >
      {/* Main row */}
      <div
        className="flex items-center px-5 py-3.5 gap-4"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === "Enter" && onToggle()}
      >
        {/* Avatar */}
        <div className={cn(
          "w-[38px] h-[38px] rounded-[9px] flex items-center justify-center text-[11px] font-bold shrink-0",
          esferaStyle.bg, esferaStyle.text
        )}>
          {edital.sigla ?? "?"}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] font-semibold text-[#1a1a1a] truncate">
            {edital.nome}
          </div>
          <div className="text-[11.5px] text-[#b0adb8]">
            {edital.esfera ?? "—"}
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-5 shrink-0">
          <CardStat value={edital.totalCargos} label="Cargos" />
          <CardStat value={edital.totalDisciplinas} label="Disc" />
          <CardStat value={formatTopicos(edital.totalTopicos)} label="Tópicos" />
        </div>

        {/* Arrow */}
        <IconChevronRight
          className={cn(
            "h-4 w-4 shrink-0 transition-transform text-[#d4d0de]",
            isOpen && "rotate-90 text-[#6c63ff]"
          )}
        />
      </div>

      {/* Cargos accordion */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 pl-[74px]">
              <div className="h-px bg-[#f0eff2] mb-3" />

              {loadingCargos && !expandedCargos && (
                <div className="flex items-center gap-2 py-3 text-xs text-[#b0adb8]">
                  <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
                  Carregando cargos...
                </div>
              )}

              {detailError && !expandedCargos && (
                <div className="py-3 text-xs text-red-400">
                  Erro ao carregar cargos: {detailError}
                </div>
              )}

              {expandedCargos?.map(cargo => {
                const hasPlano = findPlanoByEdital ? findPlanoByEdital(edital.id, cargo.id) : null
                return (
                  <div
                    key={cargo.id}
                    onClick={() => onGoToCargo(cargo.id)}
                    className="flex items-center py-[9px] px-3.5 rounded-[9px] cursor-pointer transition-colors gap-3 group hover:bg-[#f8f7fd]"
                  >
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${hasPlano ? 'bg-green-400 group-hover:bg-green-500' : 'bg-[#d4d0de] group-hover:bg-[#6c63ff]'}`} />
                    <div className="text-[13px] font-[550] text-[#1a1a1a] flex-1">
                      {cargo.nome}
                    </div>
                    <div className="text-[11px] text-[#b0adb8] shrink-0">
                      {cargo.qtdDisciplinas ?? 0} disc · {cargo.qtdTopicos ?? 0} tóp
                    </div>
                    <div className={`text-[11px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ${hasPlano ? 'text-green-600' : 'text-[#6c63ff]'}`}>
                      {hasPlano ? 'Continuar →' : 'Ver edital →'}
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function CardStat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="text-center min-w-[50px]">
      <div className="text-sm font-bold text-[#1a1a1a] tabular-nums">
        {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
      </div>
      <div className="text-[9px] text-[#c4c0ce] uppercase tracking-wide">{label}</div>
    </div>
  )
}
