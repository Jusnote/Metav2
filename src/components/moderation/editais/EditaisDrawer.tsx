// src/components/moderation/editais/EditaisDrawer.tsx
'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Trash2, ChevronRight, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { HierarchyLevel, AdminLogEntry } from '@/hooks/moderation/useEditaisAdmin'
import { toast } from 'sonner'

interface DrawerProps {
  open: boolean
  onClose: () => void
  mode: 'edit' | 'create'
  level: HierarchyLevel
  item?: Record<string, any> | null
  parentInactive?: boolean
  parentId?: number
  onSave: (data: Record<string, unknown>) => Promise<{ success: boolean; message: string | null }>
  onDelete?: (id: number) => Promise<{ success: boolean; message: string | null }>
  onManageChildren?: () => void
  childLabel?: string
  logEntries?: AdminLogEntry[]
}

const levelLabels: Record<HierarchyLevel, string> = {
  editais: 'Edital', cargos: 'Cargo', disciplinas: 'Disciplina', topicos: 'Tópico',
}

export function EditaisDrawer({
  open, onClose, mode, level, item, parentInactive, parentId,
  onSave, onDelete, onManageChildren, childLabel, logEntries,
}: DrawerProps) {
  const [form, setForm] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  const label = levelLabels[level]

  useEffect(() => {
    if (mode === 'edit' && item) {
      setForm({ ...item })
    } else {
      setForm({ ativo: true })
    }
    setDeleteStep(0)
    setDeleteConfirmText('')
  }, [mode, item, open])

  const set = (key: string, value: unknown) => setForm(prev => ({ ...prev, [key]: value }))

  const handleSave = async () => {
    setSaving(true)
    try {
      const result = await onSave(form)
      if (result.success) {
        toast.success(result.message ?? `${label} salvo`)
        onClose()
      } else {
        toast.error(result.message ?? 'Erro ao salvar')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!item?.id || !onDelete) return
    if (deleteStep === 0) { setDeleteStep(1); return }
    if (deleteStep === 1) { setDeleteStep(2); return }
    if (deleteStep === 2 && deleteConfirmText !== item.nome) {
      toast.error('Digite o nome exato para confirmar')
      return
    }
    setDeleting(true)
    try {
      const result = await onDelete(item.id)
      if (result.success) {
        toast.success(result.message ?? `${label} excluido`)
        onClose()
      } else {
        toast.error(result.message ?? 'Erro ao excluir')
      }
    } finally {
      setDeleting(false)
      setDeleteStep(0)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-[440px] bg-white shadow-xl flex flex-col overflow-hidden animate-in slide-in-from-right">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <h2 className="text-[15px] font-bold text-zinc-900">
            {mode === 'create' ? `Novo ${label}` : `Editar ${label}`}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600"><X className="h-4 w-4" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-6 py-5 space-y-4">
          {parentInactive && (
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-700 font-medium">
              Pai inativo — este item nao aparece no frontend publico.
            </div>
          )}

          {/* --- Fields per level --- */}
          <Field label="Nome *" value={form.nome ?? ''} onChange={v => set('nome', v)} />

          {level === 'editais' && <>
            <Field label="Sigla" value={form.sigla ?? ''} onChange={v => set('sigla', v)} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Esfera" value={form.esfera ?? ''} onChange={v => set('esfera', v)} />
              <Field label="Tipo" value={form.tipo ?? ''} onChange={v => set('tipo', v)} />
            </div>
            <Field label="Descricao" value={form.descricao ?? ''} onChange={v => set('descricao', v)} multiline />
            <Field label="Link" value={form.link ?? ''} onChange={v => set('link', v)} />
            <Field label="Cidade" value={form.cidade ?? ''} onChange={v => set('cidade', v)} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Data Publicacao" value={form.dataPublicacao ?? ''} onChange={v => set('dataPublicacao', v)} type="date" />
              <Field label="Data Encerramento" value={form.dataEncerramento ?? ''} onChange={v => set('dataEncerramento', v)} type="date" />
            </div>
          </>}

          {level === 'cargos' && <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Vagas" value={String(form.vagas ?? 0)} onChange={v => set('vagas', Number(v))} type="number" />
              <Field label="Remuneracao" value={String(form.remuneracao ?? 0)} onChange={v => set('remuneracao', Number(v))} type="number" />
            </div>
            <Field label="Data da Prova" value={form.dataProva ?? ''} onChange={v => set('dataProva', v)} type="date" />
          </>}

          {level === 'disciplinas' && <>
            <Field label="Nome no Edital" value={form.nomeEdital ?? ''} onChange={v => set('nomeEdital', v)} />
          </>}

          {level === 'topicos' && <>
            <Field label="Ordem" value={String(form.ordem ?? 0)} onChange={v => set('ordem', Number(v))} type="number" />
          </>}

          {/* Ativo toggle */}
          <div className="flex items-center justify-between rounded-lg bg-zinc-50 px-4 py-3">
            <span className="text-[13px] font-medium text-zinc-700">Ativo</span>
            <button
              onClick={() => set('ativo', !form.ativo)}
              className={cn(
                "relative h-6 w-11 rounded-full transition-colors",
                form.ativo ? "bg-violet-600" : "bg-zinc-300"
              )}
            >
              <div className={cn(
                "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                form.ativo ? "translate-x-[22px]" : "translate-x-0.5"
              )} />
            </button>
          </div>

          {/* Manage children button */}
          {mode === 'edit' && onManageChildren && childLabel && (
            <button onClick={onManageChildren}
              className="flex w-full items-center justify-between rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-[13px] font-medium text-violet-700 hover:bg-violet-100 transition-colors">
              Gerenciar {childLabel}
              <ChevronRight className="h-4 w-4" />
            </button>
          )}

          {/* Audit log */}
          {mode === 'edit' && logEntries && logEntries.length > 0 && (
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2">Historico</h3>
              <div className="space-y-2">
                {logEntries.slice(0, 10).map(entry => (
                  <div key={entry.id} className="flex items-start gap-2 text-[11px]">
                    <Clock className="h-3 w-3 text-zinc-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-medium text-zinc-700">{entry.action}</span>
                      <span className="text-zinc-400 ml-1.5">{new Date(entry.criadoEm).toLocaleString('pt-BR')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-100 px-6 py-4 flex items-center gap-2">
          {mode === 'edit' && onDelete && (
            <div className="mr-auto">
              {deleteStep === 0 && (
                <button onClick={handleDelete} className="text-[12px] text-red-500 hover:text-red-700">
                  Excluir permanentemente
                </button>
              )}
              {deleteStep === 1 && (
                <button onClick={handleDelete} className="text-[12px] font-medium text-red-600 bg-red-50 px-2 py-1 rounded">
                  Tem certeza? Clique novamente
                </button>
              )}
              {deleteStep === 2 && (
                <div className="flex items-center gap-2">
                  <input
                    type="text" value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)}
                    placeholder={`Digite "${item?.nome}" para confirmar`}
                    className="text-[12px] border border-red-200 rounded px-2 py-1 w-48 outline-none focus:border-red-400"
                  />
                  <button onClick={handleDelete} disabled={deleting}
                    className="text-[12px] font-medium text-white bg-red-600 px-2 py-1 rounded hover:bg-red-700 disabled:opacity-50">
                    {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Excluir'}
                  </button>
                </div>
              )}
            </div>
          )}

          <button onClick={onClose} className="rounded-lg border border-zinc-200 px-4 py-2 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving || !form.nome}
            className="rounded-lg bg-violet-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-violet-700 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === 'create' ? 'Criar' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// --- Simple field component ---
function Field({ label, value, onChange, type = 'text', multiline }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; multiline?: boolean
}) {
  return (
    <div>
      <label className="text-[11px] font-medium text-zinc-500 mb-1 block">{label}</label>
      {multiline ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={3}
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] text-zinc-900 outline-none focus:border-violet-400 resize-none" />
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)}
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] text-zinc-900 outline-none focus:border-violet-400" />
      )}
    </div>
  )
}
