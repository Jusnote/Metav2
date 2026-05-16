'use client'

import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import { useCargosCurados, type CargoCurado } from '@/hooks/moderation/useCargosCurados'
import { CargoListItem } from './CargoListItem'

type FiltroStatus = 'todos' | CargoCurado['status']

export function CargoListSidebar({
  selectedKey, onSelect,
}: {
  selectedKey: string | null
  onSelect: (c: { cargoId: number; editalId: number; cargoNome: string; editalNome: string }) => void
}) {
  const { items, isLoading } = useCargosCurados()
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<FiltroStatus>('todos')

  const filtered = useMemo(() => {
    const b = busca.toLowerCase().trim()
    return items
      .filter((c) => filtro === 'todos' || c.status === filtro)
      .filter((c) =>
        !b || c.cargoNome.toLowerCase().includes(b) || c.editalNome.toLowerCase().includes(b),
      )
      .sort((a, b) => {
        // Prioriza não-publicados (mais ação necessária)
        const order: Record<CargoCurado['status'], number> = { draft: 0, no_cache: 1, archived: 2, published: 3 }
        return order[a.status] - order[b.status] || a.cargoNome.localeCompare(b.cargoNome)
      })
  }, [items, busca, filtro])

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-slate-200 space-y-2 sticky top-0 bg-white z-10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cargo ou edital"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {(['todos', 'no_cache', 'draft', 'published', 'archived'] as FiltroStatus[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltro(f)}
              className={`text-[10px] uppercase font-semibold px-2 py-1 rounded-full transition ${
                filtro === f ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f === 'todos' ? 'Todos' : f === 'no_cache' ? 'Sem cache' : f === 'draft' ? 'Curadoria' : f === 'published' ? 'Publicado' : 'Arquivado'}
            </button>
          ))}
        </div>
        <div className="text-[10px] text-slate-400">{filtered.length} cargos</div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-sm text-slate-500">Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-sm text-slate-500">Nenhum cargo bate com o filtro.</div>
        ) : (
          filtered.map((c) => {
            const key = `${c.cargoId}-${c.editalId}`
            return (
              <CargoListItem
                key={key}
                cargo={c}
                selected={selectedKey === key}
                onClick={() => onSelect({ cargoId: c.cargoId, editalId: c.editalId, cargoNome: c.cargoNome, editalNome: c.editalNome })}
              />
            )
          })
        )}
      </div>
    </div>
  )
}
