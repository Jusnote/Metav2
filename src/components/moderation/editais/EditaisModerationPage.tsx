// src/components/moderation/editais/EditaisModerationPage.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronRight, Plus, Search, ClipboardList } from 'lucide-react'
import { ModerationDataTable } from '@/components/moderation/shared/ModerationDataTable'
import { EditaisDrawer } from './EditaisDrawer'
import { EditaisBulkBar } from './EditaisBulkBar'
import { getEditalColumns, getCargoColumns, getDisciplinaColumns, getTopicoColumns } from './columns'
import { useEditaisAdmin, type HierarchyLevel, type BreadcrumbItem } from '@/hooks/moderation/useEditaisAdmin'
import { useUserRole } from '@/hooks/moderation/useUserRole'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const LEVEL_CHILD_LABEL: Record<HierarchyLevel, string | null> = {
  editais: 'Cargos', cargos: 'Disciplinas', disciplinas: 'Tópicos', topicos: null,
}
const LEVEL_SINGULAR: Record<HierarchyLevel, string> = {
  editais: 'edital', cargos: 'cargo', disciplinas: 'disciplina', topicos: 'topico',
}

export function EditaisModerationPage() {
  const { isAdmin } = useUserRole()
  const admin = useEditaisAdmin()

  // Navigation state
  const [level, setLevel] = useState<HierarchyLevel>('editais')
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([])
  const [parentId, setParentId] = useState<number | null>(null)
  const [parentInactive, setParentInactive] = useState(false)

  // Data state
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<'edit' | 'create'>('edit')
  const [drawerItem, setDrawerItem] = useState<Record<string, any> | null>(null)
  const [logEntries, setLogEntries] = useState<any[]>([])

  // Filters (level 1 only)
  const [esferaFilter, setEsferaFilter] = useState<string>('')
  const [tipoFilter, setTipoFilter] = useState<string>('')
  const [ativoFilter, setAtivoFilter] = useState<string>('')

  // Fetch data for current level
  const fetchData = useCallback(async () => {
    setLoading(true)
    setSelectedIds(new Set())
    try {
      if (level === 'editais') {
        const filtro: Record<string, unknown> = {}
        if (esferaFilter) filtro.esfera = esferaFilter
        if (tipoFilter) filtro.tipo = tipoFilter
        if (ativoFilter === 'ativo') filtro.ativo = true
        if (ativoFilter === 'inativo') filtro.ativo = false
        if (search) filtro.busca = search
        const result = await admin.fetchEditais(filtro, 1, 100)
        setData(result.dados ?? [])
      } else if (level === 'cargos' && parentId) {
        const cargos = await admin.fetchCargos(parentId)
        setData(cargos)
      } else if (level === 'disciplinas' && parentId) {
        const disc = await admin.fetchDisciplinas(parentId)
        setData(disc)
      } else if (level === 'topicos' && parentId) {
        const tops = await admin.fetchTopicos(parentId)
        setData(tops)
      }
    } catch (err) {
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }, [level, parentId, esferaFilter, tipoFilter, ativoFilter, search, admin.refreshKey])

  useEffect(() => { fetchData() }, [fetchData])

  // Filter data by search (client-side for sub-levels)
  const filteredData = search && level !== 'editais'
    ? data.filter((item: any) => item.nome?.toLowerCase().includes(search.toLowerCase()))
    : data

  // Navigate to child level
  const drillDown = (item: any, nextLevel: HierarchyLevel) => {
    const count = nextLevel === 'cargos' ? item.totalCargos ?? data.length
      : nextLevel === 'disciplinas' ? item.qtdDisciplinas ?? data.length
      : nextLevel === 'topicos' ? item.totalTopicos ?? data.length : 0
    setBreadcrumb(prev => [...prev, { id: item.id, nome: `${item.sigla ?? item.nome} (${count})`, tipo: level }])
    setParentId(item.id)
    setParentInactive(parentInactive || item.ativo === false)
    setLevel(nextLevel)
    setSearch('')
    setDrawerOpen(false)
  }

  // Navigate back via breadcrumb
  const navigateTo = (index: number) => {
    if (index < 0) {
      setLevel('editais')
      setBreadcrumb([])
      setParentId(null)
      setParentInactive(false)
    } else {
      const target = breadcrumb[index]
      const levels: HierarchyLevel[] = ['editais', 'cargos', 'disciplinas', 'topicos']
      const targetLevelIdx = levels.indexOf(target.tipo)
      setLevel(levels[targetLevelIdx + 1])
      setBreadcrumb(breadcrumb.slice(0, index + 1))
      setParentId(target.id)
      // Recalculate parentInactive
      setParentInactive(false) // simplified — will refetch
    }
    setSearch('')
    setDrawerOpen(false)
  }

  // Open drawer
  const openEdit = async (item: any) => {
    setDrawerItem(item)
    setDrawerMode('edit')
    setDrawerOpen(true)
    // Fetch log
    const log = await admin.fetchAdminLog(LEVEL_SINGULAR[level], item.id)
    setLogEntries(log)
  }

  const openCreate = () => {
    setDrawerItem(null)
    setDrawerMode('create')
    setDrawerOpen(true)
    setLogEntries([])
  }

  // Save handler
  const handleSave = async (formData: Record<string, unknown>) => {
    if (drawerMode === 'create') {
      if (level === 'editais') return admin.criarEdital(formData)
      if (level === 'cargos' && parentId) return admin.criarCargo(parentId, formData)
      if (level === 'disciplinas' && parentId) return admin.criarDisciplina(parentId, formData)
      if (level === 'topicos' && parentId) return admin.criarTopico(parentId, formData)
    } else {
      const id = drawerItem?.id
      if (!id) return { success: false, message: 'ID nao encontrado' }
      if (level === 'editais') return admin.atualizarEdital(id, formData)
      if (level === 'cargos') return admin.atualizarCargo(id, formData)
      if (level === 'disciplinas') return admin.atualizarDisciplina(id, formData)
      if (level === 'topicos') return admin.atualizarTopico(id, formData)
    }
    return { success: false, message: 'Nivel desconhecido', id: null }
  }

  // Delete handler
  const handleDelete = async (id: number) => {
    if (level === 'editais') return admin.deletarEdital(id)
    if (level === 'cargos') return admin.deletarCargo(id)
    if (level === 'disciplinas') return admin.deletarDisciplina(id)
    if (level === 'topicos') return admin.deletarTopico(id)
    return { success: false, message: 'Nivel desconhecido', id: null }
  }

  // Manage children from drawer
  const handleManageChildren = () => {
    if (!drawerItem) return
    const childLevel: Record<string, HierarchyLevel> = { editais: 'cargos', cargos: 'disciplinas', disciplinas: 'topicos' }
    const next = childLevel[level]
    if (next) drillDown(drawerItem, next)
  }

  // Selection helpers
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const toggleAll = () => {
    if (selectedIds.size === filteredData.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredData.map((d: any) => d.id)))
    }
  }

  // Bulk handlers
  const bulkActivate = async () => {
    await admin.bulkAtivar(LEVEL_SINGULAR[level], [...selectedIds], true)
    toast.success(`${selectedIds.size} itens ativados`)
    setSelectedIds(new Set())
  }
  const bulkDeactivate = async () => {
    await admin.bulkAtivar(LEVEL_SINGULAR[level], [...selectedIds], false)
    toast.success(`${selectedIds.size} itens inativados`)
    setSelectedIds(new Set())
  }
  const bulkDelete = async () => {
    await admin.bulkDeletar(LEVEL_SINGULAR[level], [...selectedIds])
    toast.success(`${selectedIds.size} itens excluidos`)
    setSelectedIds(new Set())
  }

  // Topico reorder
  const moveTopico = async (topicoId: number, direction: 'up' | 'down') => {
    const idx = data.findIndex((t: any) => t.id === topicoId)
    if (idx < 0) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= data.length) return
    const newOrder = [...data]
    ;[newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]]
    setData(newOrder)
    if (parentId) {
      await admin.reordenarTopicos(parentId, newOrder.map((t: any) => t.id))
    }
  }

  // Build columns for current level
  const columns = level === 'editais'
    ? getEditalColumns(selectedIds, toggleSelect, toggleAll, selectedIds.size === filteredData.length)
    : level === 'cargos'
    ? getCargoColumns(selectedIds, toggleSelect, parentInactive)
    : level === 'disciplinas'
    ? getDisciplinaColumns(selectedIds, toggleSelect, parentInactive)
    : getTopicoColumns(
        selectedIds, toggleSelect, parentInactive,
        (id) => moveTopico(id, 'up'), (id) => moveTopico(id, 'down'),
        (id) => filteredData[0]?.id === id, (id) => filteredData[filteredData.length - 1]?.id === id,
      )

  return (
    <>
      {/* Header */}
      <div className="border-b border-zinc-100 bg-white px-8 pb-5 pt-6">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-zinc-900">Editais</h1>
            <p className="text-[13px] text-zinc-400">Gerencie editais, cargos, disciplinas e topicos.</p>
          </div>
          {isAdmin && (
            <button onClick={openCreate}
              className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-violet-700">
              <Plus className="h-4 w-4" />
              Novo {level === 'editais' ? 'Edital' : level === 'cargos' ? 'Cargo' : level === 'disciplinas' ? 'Disciplina' : 'Topico'}
            </button>
          )}
        </div>

        {/* Breadcrumb */}
        {breadcrumb.length > 0 && (
          <div className="flex items-center gap-1 mt-3 text-[13px]">
            <button onClick={() => navigateTo(-1)} className="text-violet-600 hover:text-violet-800 font-medium">
              Editais
            </button>
            {breadcrumb.map((item, i) => (
              <span key={i} className="flex items-center gap-1">
                <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
                <button onClick={() => navigateTo(i)} className={cn(
                  i === breadcrumb.length - 1 ? "text-zinc-700 font-semibold" : "text-violet-600 hover:text-violet-800 font-medium"
                )}>
                  {item.nome}
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Search + Filters */}
        <div className="flex items-center gap-3 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome..."
              className="w-full rounded-lg border border-zinc-200 py-2 pl-9 pr-4 text-[13px] outline-none focus:border-violet-400" />
          </div>
          {level === 'editais' && <>
            <select value={esferaFilter} onChange={e => setEsferaFilter(e.target.value)}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-[12px] text-zinc-600 outline-none">
              <option value="">Esfera</option>
              <option value="federal">Federal</option>
              <option value="estadual">Estadual</option>
              <option value="municipal">Municipal</option>
            </select>
            <select value={ativoFilter} onChange={e => setAtivoFilter(e.target.value)}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-[12px] text-zinc-600 outline-none">
              <option value="">Status</option>
              <option value="ativo">Ativos</option>
              <option value="inativo">Inativos</option>
            </select>
          </>}
        </div>
      </div>

      {/* Content */}
      <div className="p-8">
        {isAdmin && (
          <EditaisBulkBar
            count={selectedIds.size}
            onActivate={bulkActivate}
            onDeactivate={bulkDeactivate}
            onDelete={bulkDelete}
            onClear={() => setSelectedIds(new Set())}
          />
        )}

        <ModerationDataTable
          columns={columns as any}
          data={filteredData}
          onRowClick={isAdmin ? openEdit : undefined}
          rowKey={(row: any) => String(row.id)}
          emptyMessage="Nenhum item encontrado"
          emptyIcon={<ClipboardList className="h-10 w-10 text-zinc-300" />}
          pageSize={20}
        />
      </div>

      {/* Drawer */}
      <EditaisDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        mode={drawerMode}
        level={level}
        item={drawerItem}
        parentInactive={parentInactive}
        parentId={parentId ?? undefined}
        onSave={handleSave}
        onDelete={isAdmin ? handleDelete : undefined}
        onManageChildren={LEVEL_CHILD_LABEL[level] ? handleManageChildren : undefined}
        childLabel={LEVEL_CHILD_LABEL[level] ?? undefined}
        logEntries={logEntries}
      />
    </>
  )
}
