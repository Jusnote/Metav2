'use client'

// Tela MAIS importante do admin: revisão da árvore com drag-and-drop de tópicos
// dentro do mesmo bloco. Painel esquerdo = árvore; painel direito = detalhe do nó.
// Ref: doc 08-telas-admin.md "Tela 2 — Revisar árvore"

import { useMemo, useState, useTransition } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { BarrinhaRelevancia } from '@/v3/components/shared/BarrinhaRelevancia'
import {
  atualizarDisciplinaAction,
  atualizarSubtopicoAction,
  atualizarTopicoAction,
  publicarConcursoAction,
  reordenarTopicosAction,
} from '@/app/v3/(admin)/admin/concursos/[id]/revisar/actions'
import type {
  BlocoArvore,
  ConcursoComArvore,
  DisciplinaArvore,
  TopicoArvore,
} from '@/v3/lib/arvore-edital'

const NATUREZAS = [
  'doutrina',
  'doutrina_pratica',
  'pratica',
  'pratica_intensiva',
  'lei_seca',
  'lei_seca_mais_doutrina',
  'jurisprudencia',
  'misto',
] as const

const TIPOS_REVISAO = [
  'leitura_unica_mais_questoes',
  'resumo_mais_questoes',
  'tabela_mais_questoes',
  'exercicio_repetido',
  'exercicio_intensivo',
  'exercicio_montagem',
  'leitura_lei_mais_questoes',
  'leitura_norma_mais_questoes',
  'mapa_mental',
]

type SelecionadoTipo =
  | { tipo: 'disciplina'; id: string }
  | { tipo: 'topico'; id: string }
  | null

interface Props {
  concurso: ConcursoComArvore
}

export function ArvoreEditor({ concurso: initialConcurso }: Props) {
  const [concurso, setConcurso] = useState(initialConcurso)
  const [selecionado, setSelecionado] = useState<SelecionadoTipo>(() => {
    // Pre-seleciona o primeiro tópico encontrado pra UX inicial não vir vazia
    const t = initialConcurso.disciplinas[0]?.blocos[0]?.topicos[0]
    if (t) return { tipo: 'topico', id: t.id }
    if (initialConcurso.disciplinas[0]) {
      return { tipo: 'disciplina', id: initialConcurso.disciplinas[0].id }
    }
    return null
  })
  const [busca, setBusca] = useState('')
  const [expandidos, setExpandidos] = useState<Set<string>>(() => {
    // Expande tudo por padrão pra discoverability
    const s = new Set<string>()
    for (const d of initialConcurso.disciplinas) {
      s.add(d.id)
      for (const b of d.blocos) s.add(b.id)
    }
    return s
  })

  const [pubPending, startPubTransition] = useTransition()
  const [pubMsg, setPubMsg] = useState<string | null>(null)

  // Mapas pra lookup rápido
  const topicosPorBloco = useMemo(() => {
    const m = new Map<string, TopicoArvore[]>()
    for (const d of concurso.disciplinas) {
      for (const b of d.blocos) m.set(b.id, b.topicos)
    }
    return m
  }, [concurso])

  function toggleExpandido(id: string) {
    setExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function expandirTodos() {
    const s = new Set<string>()
    for (const d of concurso.disciplinas) {
      s.add(d.id)
      for (const b of d.blocos) s.add(b.id)
    }
    setExpandidos(s)
  }

  function colapsarTodos() {
    setExpandidos(new Set())
  }

  // Reordenação dentro de um bloco — atualiza estado local + persiste
  async function handleDragEndBloco(bloco: BlocoArvore, event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const topicos = topicosPorBloco.get(bloco.id) ?? []
    const oldIdx = topicos.findIndex((t) => t.id === active.id)
    const newIdx = topicos.findIndex((t) => t.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return

    const reordenados = arrayMove(topicos, oldIdx, newIdx).map((t, i) => ({
      ...t,
      ordem: i + 1,
    }))

    // Atualiza estado local imediato (otimista)
    setConcurso((c) => ({
      ...c,
      disciplinas: c.disciplinas.map((d) => ({
        ...d,
        blocos: d.blocos.map((b) =>
          b.id === bloco.id ? { ...b, topicos: reordenados } : b,
        ),
      })),
    }))

    // Persiste
    const result = await reordenarTopicosAction({
      blocoId: bloco.id,
      ordens: reordenados.map((t) => ({ topicoId: t.id, ordem: t.ordem })),
    })
    if (!result.ok) {
      console.error('[arvore] Falha ao reordenar:', result.erro)
      // Reverte se falhar
      setConcurso(initialConcurso)
    }
  }

  function patchTopico(topicoId: string, patch: Partial<TopicoArvore>) {
    setConcurso((c) => ({
      ...c,
      disciplinas: c.disciplinas.map((d) => ({
        ...d,
        blocos: d.blocos.map((b) => ({
          ...b,
          topicos: b.topicos.map((t) => (t.id === topicoId ? { ...t, ...patch } : t)),
        })),
      })),
    }))
  }

  function patchDisciplina(disciplinaId: string, patch: Partial<DisciplinaArvore>) {
    setConcurso((c) => ({
      ...c,
      disciplinas: c.disciplinas.map((d) =>
        d.id === disciplinaId ? { ...d, ...patch } : d,
      ),
    }))
  }

  function handlePublicar() {
    setPubMsg(null)
    startPubTransition(async () => {
      const result = await publicarConcursoAction(concurso.id)
      if (result.ok) {
        setPubMsg('Concurso publicado!')
        setConcurso((c) => ({ ...c, status: 'publicado' }))
      } else {
        setPubMsg(`Erro: ${result.erro}`)
      }
    })
  }

  // Match para destacar resultado da busca
  const buscaLower = busca.trim().toLowerCase()
  function matchBusca(texto: string) {
    return buscaLower === '' || texto.toLowerCase().includes(buscaLower)
  }

  // Nó selecionado pra o painel direito
  const topicoSel =
    selecionado?.tipo === 'topico'
      ? concurso.disciplinas
          .flatMap((d) => d.blocos.flatMap((b) => b.topicos))
          .find((t) => t.id === selecionado.id)
      : null
  const disciplinaSel =
    selecionado?.tipo === 'disciplina'
      ? concurso.disciplinas.find((d) => d.id === selecionado.id)
      : null

  return (
    <div className="flex gap-0 h-[calc(100vh-140px)]">
      {/* Painel esquerdo — árvore */}
      <div
        className="w-[34%] border-r overflow-y-auto"
        style={{ borderColor: 'var(--border-default)' }}
      >
        <div
          className="sticky top-0 z-10 px-4 py-3 border-b space-y-2"
          style={{
            backgroundColor: 'var(--bg-canvas)',
            borderColor: 'var(--border-default)',
          }}
        >
          <input
            type="search"
            placeholder="Buscar tópico…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded text-sm"
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              color: 'var(--fg-primary)',
            }}
          />
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={expandirTodos}
              className="hover:underline"
              style={{ color: 'var(--fg-secondary)' }}
            >
              Expandir todos
            </button>
            <span style={{ color: 'var(--border-strong)' }}>·</span>
            <button
              type="button"
              onClick={colapsarTodos}
              className="hover:underline"
              style={{ color: 'var(--fg-secondary)' }}
            >
              Colapsar todos
            </button>
          </div>
        </div>

        <div className="px-2 py-3 space-y-3">
          {concurso.disciplinas.map((d) => (
            <DisciplinaNo
              key={d.id}
              disciplina={d}
              expandidos={expandidos}
              onToggle={toggleExpandido}
              selecionado={selecionado}
              onSelect={setSelecionado}
              onDragEndBloco={handleDragEndBloco}
              matchBusca={matchBusca}
              topicosPorBloco={topicosPorBloco}
            />
          ))}
        </div>
      </div>

      {/* Painel direito — detalhe */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-5">
          {topicoSel && (
            <TopicoDetalhe
              topico={topicoSel}
              onSalvar={async (patch) => {
                patchTopico(topicoSel.id, patch)
                // Sanitiza: cast natureza para enum + remove nullables
                const { natureza, tipo_revisao, observacao, ...rest } = patch
                await atualizarTopicoAction({
                  topicoId: topicoSel.id,
                  ...rest,
                  ...(natureza !== undefined && {
                    natureza: natureza as
                      | 'doutrina'
                      | 'doutrina_pratica'
                      | 'pratica'
                      | 'pratica_intensiva'
                      | 'lei_seca'
                      | 'lei_seca_mais_doutrina'
                      | 'jurisprudencia'
                      | 'misto',
                  }),
                  ...(tipo_revisao !== undefined &&
                    tipo_revisao !== null && { tipo_revisao }),
                  ...(observacao !== undefined &&
                    observacao !== null && { observacao }),
                })
              }}
              onSalvarSubtopico={async (sId, patch) => {
                // Otimista
                setConcurso((c) => ({
                  ...c,
                  disciplinas: c.disciplinas.map((d) => ({
                    ...d,
                    blocos: d.blocos.map((b) => ({
                      ...b,
                      topicos: b.topicos.map((t) =>
                        t.id === topicoSel.id
                          ? {
                              ...t,
                              subtopicos: t.subtopicos.map((s) =>
                                s.id === sId ? { ...s, ...patch } : s,
                              ),
                            }
                          : t,
                      ),
                    })),
                  })),
                }))
                await atualizarSubtopicoAction({ subtopicoId: sId, ...patch })
              }}
            />
          )}
          {disciplinaSel && (
            <DisciplinaDetalhe
              disciplina={disciplinaSel}
              onSalvar={async (patch) => {
                patchDisciplina(disciplinaSel.id, patch)
                await atualizarDisciplinaAction({
                  disciplinaId: disciplinaSel.id,
                  ...patch,
                })
              }}
            />
          )}
          {!topicoSel && !disciplinaSel && (
            <div className="text-sm" style={{ color: 'var(--fg-tertiary)' }}>
              Selecione um nó na árvore para editar.
            </div>
          )}
        </div>

        {/* Footer publicar */}
        <div
          className="sticky bottom-0 border-t px-6 py-3 flex items-center justify-between gap-3"
          style={{
            borderColor: 'var(--border-default)',
            backgroundColor: 'var(--bg-canvas)',
          }}
        >
          <div className="text-xs" style={{ color: 'var(--fg-secondary)' }}>
            {pubMsg && (
              <span
                style={{
                  color: pubMsg.startsWith('Erro')
                    ? 'var(--color-erro-text)'
                    : 'var(--color-teoria-text)',
                }}
              >
                {pubMsg}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handlePublicar}
            disabled={pubPending || concurso.status === 'publicado'}
            className="px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundColor: 'var(--color-teoria-bg)',
              border: '1px solid var(--color-teoria-border)',
              color: 'var(--color-teoria-text)',
            }}
          >
            {concurso.status === 'publicado'
              ? 'Já publicado'
              : pubPending
                ? 'Publicando…'
                : 'Publicar concurso'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Nó: Disciplina (com seus blocos)
// ---------------------------------------------------------------------------

function DisciplinaNo({
  disciplina,
  expandidos,
  onToggle,
  selecionado,
  onSelect,
  onDragEndBloco,
  matchBusca,
  topicosPorBloco,
}: {
  disciplina: DisciplinaArvore
  expandidos: Set<string>
  onToggle: (id: string) => void
  selecionado: SelecionadoTipo
  onSelect: (s: SelecionadoTipo) => void
  onDragEndBloco: (bloco: BlocoArvore, e: DragEndEvent) => void
  matchBusca: (texto: string) => boolean
  topicosPorBloco: Map<string, TopicoArvore[]>
}) {
  const aberto = expandidos.has(disciplina.id)
  const isSel = selecionado?.tipo === 'disciplina' && selecionado.id === disciplina.id
  const totalTopicos = disciplina.blocos.reduce((s, b) => s + b.topicos.length, 0)

  return (
    <div>
      <div
        className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors"
        style={{
          backgroundColor: isSel ? 'var(--bg-surface-3)' : 'transparent',
        }}
        onClick={() => onSelect({ tipo: 'disciplina', id: disciplina.id })}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggle(disciplina.id)
          }}
          className="w-4 text-xs"
          style={{ color: 'var(--fg-secondary)' }}
          aria-label={aberto ? 'Colapsar' : 'Expandir'}
        >
          {aberto ? '▾' : '▸'}
        </button>
        <span
          className="text-sm font-medium flex-1"
          style={{ color: 'var(--fg-primary)' }}
        >
          {disciplina.nome}
        </span>
        <span
          className="text-xs font-mono"
          style={{ color: 'var(--fg-tertiary)' }}
          title={`${totalTopicos} tópicos`}
        >
          {disciplina.horas_totais}h
        </span>
      </div>

      {aberto && (
        <div className="ml-4 mt-1 space-y-2">
          {disciplina.blocos.map((b) => (
            <BlocoNo
              key={b.id}
              bloco={b}
              expandidos={expandidos}
              onToggle={onToggle}
              selecionado={selecionado}
              onSelect={onSelect}
              onDragEnd={(e) => onDragEndBloco(b, e)}
              matchBusca={matchBusca}
              topicos={topicosPorBloco.get(b.id) ?? []}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Nó: Bloco (com sortable de tópicos)
// ---------------------------------------------------------------------------

function BlocoNo({
  bloco,
  expandidos,
  onToggle,
  selecionado,
  onSelect,
  onDragEnd,
  matchBusca,
  topicos,
}: {
  bloco: BlocoArvore
  expandidos: Set<string>
  onToggle: (id: string) => void
  selecionado: SelecionadoTipo
  onSelect: (s: SelecionadoTipo) => void
  onDragEnd: (e: DragEndEvent) => void
  matchBusca: (texto: string) => boolean
  topicos: TopicoArvore[]
}) {
  const aberto = expandidos.has(bloco.id)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  return (
    <div>
      <div
        className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer"
        onClick={() => onToggle(bloco.id)}
      >
        <button
          type="button"
          className="w-4 text-xs"
          style={{ color: 'var(--fg-secondary)' }}
          aria-label={aberto ? 'Colapsar' : 'Expandir'}
        >
          {aberto ? '▾' : '▸'}
        </button>
        <span
          className="text-xs font-medium flex-1"
          style={{ color: 'var(--fg-secondary)' }}
        >
          {bloco.nome}
        </span>
        <span className="text-xs" style={{ color: 'var(--fg-tertiary)' }}>
          {topicos.length} · {bloco.horas_bloco ?? '—'}h
        </span>
      </div>

      {aberto && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={topicos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            <ul className="ml-5 mt-1 space-y-0.5">
              {topicos.map((t) => (
                <TopicoLi
                  key={t.id}
                  topico={t}
                  selecionado={selecionado}
                  onSelect={onSelect}
                  destacado={matchBusca(t.nome)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Item: Tópico (sortable)
// ---------------------------------------------------------------------------

function TopicoLi({
  topico,
  selecionado,
  onSelect,
  destacado,
}: {
  topico: TopicoArvore
  selecionado: SelecionadoTipo
  onSelect: (s: SelecionadoTipo) => void
  destacado: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: topico.id })
  const isSel = selecionado?.tipo === 'topico' && selecionado.id === topico.id

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : destacado ? 1 : 0.4,
    backgroundColor: isSel ? 'var(--bg-surface-3)' : 'transparent',
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-xs hover:bg-[var(--bg-surface-2)]"
      onClick={() => onSelect({ tipo: 'topico', id: topico.id })}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing px-1"
        style={{ color: 'var(--fg-tertiary)' }}
        aria-label="Arrastar tópico"
        onClick={(e) => e.stopPropagation()}
      >
        ⋮⋮
      </button>
      <BarrinhaRelevancia peso={topico.peso_incidencia} />
      <span className="flex-1 truncate" style={{ color: 'var(--fg-primary)' }}>
        {topico.nome}
      </span>
      <span style={{ color: 'var(--fg-tertiary)' }}>{topico.horas_sugeridas}h</span>
    </li>
  )
}

// ---------------------------------------------------------------------------
// Painel direito: Tópico
// ---------------------------------------------------------------------------

function TopicoDetalhe({
  topico,
  onSalvar,
  onSalvarSubtopico,
}: {
  topico: TopicoArvore
  onSalvar: (patch: Partial<TopicoArvore>) => Promise<void>
  onSalvarSubtopico: (
    sId: string,
    patch: { nome?: string; horas_sugeridas?: number | null; ordem?: number },
  ) => Promise<void>
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-base font-medium" style={{ color: 'var(--fg-primary)' }}>
        Tópico
      </h2>

      <Field label="Nome">
        <Input
          value={topico.nome}
          onChange={(v) => onSalvar({ nome: v })}
          debounceMs={500}
        />
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Peso (1-5)">
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            value={topico.peso_incidencia}
            onChange={(e) => onSalvar({ peso_incidencia: Number(e.target.value) })}
            className="w-full"
          />
          <div className="mt-1 flex items-center gap-2">
            <BarrinhaRelevancia peso={topico.peso_incidencia} />
            <span className="text-xs" style={{ color: 'var(--fg-secondary)' }}>
              {topico.peso_incidencia}/5
            </span>
          </div>
        </Field>

        <Field label="Natureza">
          <Select
            value={topico.natureza}
            onChange={(v) => onSalvar({ natureza: v })}
            options={NATUREZAS.map((n) => ({ value: n, label: n }))}
          />
        </Field>

        <Field label="Horas">
          <Input
            type="number"
            value={String(topico.horas_sugeridas)}
            onChange={(v) =>
              onSalvar({ horas_sugeridas: Math.max(0.1, Number(v) || 0.1) })
            }
            debounceMs={500}
          />
        </Field>
      </div>

      <Field label="Tipo de revisão">
        <Select
          value={topico.tipo_revisao ?? ''}
          onChange={(v) => onSalvar({ tipo_revisao: v })}
          options={[
            { value: '', label: '—' },
            ...TIPOS_REVISAO.map((t) => ({ value: t, label: t })),
          ]}
        />
      </Field>

      <Field label="Observação estratégica (mostrada ao aluno como dica)">
        <textarea
          value={topico.observacao ?? ''}
          onChange={(e) => onSalvar({ observacao: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 rounded-md text-sm"
          style={{
            backgroundColor: 'var(--bg-canvas)',
            border: '1px solid var(--border-default)',
            color: 'var(--fg-primary)',
          }}
        />
      </Field>

      {/* Subtópicos */}
      <div>
        <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--fg-primary)' }}>
          Subtópicos ({topico.subtopicos.length})
        </h3>
        <ul className="space-y-1.5">
          {topico.subtopicos.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded text-sm"
              style={{ backgroundColor: 'var(--bg-surface-2)' }}
            >
              <span
                className="w-6 text-xs font-mono"
                style={{ color: 'var(--fg-tertiary)' }}
              >
                {s.ordem}
              </span>
              <Input
                value={s.nome}
                onChange={(v) => onSalvarSubtopico(s.id, { nome: v })}
                debounceMs={500}
              />
              <Input
                type="number"
                value={String(s.horas_sugeridas ?? '')}
                onChange={(v) =>
                  onSalvarSubtopico(s.id, {
                    horas_sugeridas: v ? Number(v) : null,
                  })
                }
                placeholder="h"
                debounceMs={500}
              />
            </li>
          ))}
          {topico.subtopicos.length === 0 && (
            <li className="text-xs" style={{ color: 'var(--fg-tertiary)' }}>
              Sem subtópicos.
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Painel direito: Disciplina
// ---------------------------------------------------------------------------

function DisciplinaDetalhe({
  disciplina,
  onSalvar,
}: {
  disciplina: DisciplinaArvore
  onSalvar: (patch: {
    nome?: string
    horas_totais?: number
    nivel?: 'basico' | 'intermediario' | 'avancado'
    ordem?: number
  }) => Promise<void>
}) {
  const observacoes = Array.isArray(disciplina.observacoes_globais)
    ? (disciplina.observacoes_globais as string[])
    : []

  return (
    <div className="space-y-4">
      <h2 className="text-base font-medium" style={{ color: 'var(--fg-primary)' }}>
        Disciplina
      </h2>

      <Field label="Nome">
        <Input
          value={disciplina.nome}
          onChange={(v) => onSalvar({ nome: v })}
          debounceMs={500}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Horas totais">
          <Input
            type="number"
            value={String(disciplina.horas_totais)}
            onChange={(v) => onSalvar({ horas_totais: Math.max(1, Number(v) || 1) })}
            debounceMs={500}
          />
        </Field>
        <Field label="Nível">
          <Select
            value={disciplina.nivel ?? 'intermediario'}
            onChange={(v) =>
              onSalvar({ nivel: v as 'basico' | 'intermediario' | 'avancado' })
            }
            options={[
              { value: 'basico', label: 'Básico' },
              { value: 'intermediario', label: 'Intermediário' },
              { value: 'avancado', label: 'Avançado' },
            ]}
          />
        </Field>
      </div>

      {observacoes.length > 0 && (
        <div>
          <h3
            className="text-sm font-medium mb-2"
            style={{ color: 'var(--fg-primary)' }}
          >
            Observações da IA
          </h3>
          <ul className="space-y-1.5">
            {observacoes.map((o, i) => (
              <li
                key={i}
                className="text-sm px-3 py-2 rounded"
                style={{
                  color: 'var(--fg-secondary)',
                  backgroundColor: 'var(--bg-surface-2)',
                }}
              >
                {o}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs" style={{ color: 'var(--fg-tertiary)' }}>
        {disciplina.blocos.length} blocos ·{' '}
        {disciplina.blocos.reduce((s, b) => s + b.topicos.length, 0)} tópicos
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Primitivos
// ---------------------------------------------------------------------------

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span
        className="block text-xs mb-1.5"
        style={{ color: 'var(--fg-secondary)' }}
      >
        {label}
      </span>
      {children}
    </label>
  )
}

/**
 * Input com debounce — propaga onChange só após `debounceMs` de quietude.
 * Evita disparar atualizarTopicoAction a cada caractere digitado.
 */
function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
  debounceMs = 0,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  debounceMs?: number
}) {
  const [local, setLocal] = useState(value)

  // Sync quando o value externo muda (ex: troca de seleção)
  useStableSync(value, setLocal)

  function handle(v: string) {
    setLocal(v)
    if (debounceMs > 0) {
      // debounce nativo simples
      window.clearTimeout((handle as unknown as { t?: number }).t)
      ;(handle as unknown as { t?: number }).t = window.setTimeout(
        () => onChange(v),
        debounceMs,
      )
    } else {
      onChange(v)
    }
  }

  return (
    <input
      type={type}
      value={local}
      onChange={(e) => handle(e.target.value)}
      placeholder={placeholder}
      className="w-full px-2.5 py-1.5 rounded text-sm"
      style={{
        backgroundColor: 'var(--bg-canvas)',
        border: '1px solid var(--border-default)',
        color: 'var(--fg-primary)',
      }}
    />
  )
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-2.5 py-1.5 rounded text-sm"
      style={{
        backgroundColor: 'var(--bg-canvas)',
        border: '1px solid var(--border-default)',
        color: 'var(--fg-primary)',
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

// Sincroniza o local state com o value externo quando ele realmente muda
// (não toda re-render). Usa um ref pra comparar.
import { useEffect, useRef } from 'react'
function useStableSync<T>(externo: T, setLocal: (v: T) => void) {
  const prevRef = useRef(externo)
  useEffect(() => {
    if (prevRef.current !== externo) {
      setLocal(externo)
      prevRef.current = externo
    }
  }, [externo, setLocal])
}
