'use client'

import { useState } from 'react'
import { useUserRole } from '@/hooks/moderation/useUserRole'
import { CargoListSidebar } from '@/components/moderation/curadoria/CargoListSidebar'
import { CuradoriaTreeMain } from '@/components/moderation/curadoria/CuradoriaTreeMain'
import { CuradoriaEmptyState } from '@/components/moderation/curadoria/CuradoriaEmptyState'

export default function CuradoriaEditaisPage() {
  const { isAdmin, isLoading } = useUserRole()
  const [selected, setSelected] = useState<{
    cargoId: number
    editalId: number
    cargoNome: string
    editalNome: string
  } | null>(null)

  if (isLoading) return <div className="p-8 text-sm text-slate-500">Carregando…</div>
  if (!isAdmin) {
    return (
      <div className="p-8 text-sm text-rose-600">
        Acesso restrito. Você precisa de role admin.
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-64px)] flex bg-slate-50">
      <aside className="w-[340px] border-r border-slate-200 bg-white overflow-y-auto">
        <CargoListSidebar
          selectedKey={selected ? `${selected.cargoId}-${selected.editalId}` : null}
          onSelect={(c) => setSelected(c)}
        />
      </aside>
      <main className="flex-1 overflow-y-auto">
        {selected ? (
          <CuradoriaTreeMain
            cargoId={selected.cargoId}
            editalId={selected.editalId}
            cargoNome={selected.cargoNome}
            editalNome={selected.editalNome}
          />
        ) : (
          <CuradoriaEmptyState />
        )}
      </main>
    </div>
  )
}
