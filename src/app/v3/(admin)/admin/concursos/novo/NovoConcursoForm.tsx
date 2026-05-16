'use client'

// Wizard cliente: Step 1 identificação → Step 2 upload → Step 3 processando
// Dispara processarEditalAction e redireciona pra tela de revisão ao concluir.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { processarEditalAction, type ProcessarEditalInput } from './actions'

type Step = 1 | 2 | 3

interface Step1Data {
  nome: string
  banca: string
  cargo: string
  nivel: 'medio' | 'superior' | ''
  dataProva: string
}

const BANCAS = ['Cebraspe', 'FGV', 'FCC', 'Vunesp', 'Outra']

export function NovoConcursoForm() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [pending, startTransition] = useTransition()

  const [step1, setStep1] = useState<Step1Data>({
    nome: '',
    banca: '',
    cargo: '',
    nivel: '',
    dataProva: '',
  })
  const [textoEdital, setTextoEdital] = useState('')
  const [horasTotais, setHorasTotais] = useState(400)
  const [nivelProfundidade, setNivelProfundidade] =
    useState<'basico' | 'intermediario' | 'avancado'>('intermediario')

  const [erro, setErro] = useState<string | null>(null)
  const [statusProcessamento, setStatusProcessamento] = useState<string | null>(null)

  const step1Valido = step1.nome.trim().length >= 3 && step1.banca && step1.cargo.trim().length >= 2
  const step2Valido = textoEdital.trim().length >= 200

  function handleContinuarStep1() {
    if (!step1Valido) return
    setErro(null)
    setStep(2)
  }

  function handleProcessar() {
    if (!step2Valido) return
    setErro(null)
    setStatusProcessamento('Enviando edital para a IA…')
    setStep(3)

    const input: ProcessarEditalInput = {
      nome: step1.nome.trim(),
      banca: step1.banca,
      cargo: step1.cargo.trim(),
      nivel: step1.nivel || undefined,
      dataProva: step1.dataProva || undefined,
      textoEdital: textoEdital.trim(),
      horasTotaisCronograma: horasTotais,
      nivelProfundidade,
    }

    startTransition(async () => {
      setStatusProcessamento('Dividindo disciplinas, estimando horas e estruturando árvore…')
      const result = await processarEditalAction(input)
      if (result.ok) {
        setStatusProcessamento(
          `Concluído: ${result.totais.disciplinas} disciplinas, ${result.totais.topicos} tópicos. Redirecionando…`,
        )
        // Redireciona pra tela de revisão
        setTimeout(() => {
          router.push(`/v3/admin/concursos/${result.concursoId}/revisar`)
        }, 800)
      } else {
        setErro(result.erro)
        setStatusProcessamento(null)
        setStep(2)
      }
    })
  }

  return (
    <div className="space-y-4">
      <StepIndicator current={step} />

      {step === 1 && (
        <Step1Card
          data={step1}
          onChange={setStep1}
          onContinuar={handleContinuarStep1}
          valido={step1Valido}
        />
      )}

      {step === 2 && (
        <Step2Card
          textoEdital={textoEdital}
          onChangeTexto={setTextoEdital}
          horasTotais={horasTotais}
          onChangeHoras={setHorasTotais}
          nivelProfundidade={nivelProfundidade}
          onChangeNivel={setNivelProfundidade}
          onProcessar={handleProcessar}
          onVoltar={() => setStep(1)}
          valido={step2Valido}
          pending={pending}
        />
      )}

      {step === 3 && (
        <Step3Processando
          status={statusProcessamento}
          concursoNome={step1.nome}
        />
      )}

      {erro && (
        <div
          className="rounded-md p-3 text-sm"
          style={{
            backgroundColor: 'var(--color-erro-bg)',
            color: 'var(--color-erro-text)',
            border: '1px solid rgba(226,75,74,0.4)',
          }}
          role="alert"
        >
          <strong className="font-medium">Erro: </strong>
          {erro}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function StepIndicator({ current }: { current: Step }) {
  const steps = [
    { n: 1, label: 'Identificação' },
    { n: 2, label: 'Edital' },
    { n: 3, label: 'Processamento' },
  ]
  return (
    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--fg-secondary)' }}>
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center gap-2">
          <span
            className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs"
            style={{
              backgroundColor:
                current >= s.n ? 'var(--color-revisao-solid)' : 'var(--bg-surface-3)',
              color: current >= s.n ? '#fff' : 'var(--fg-tertiary)',
            }}
            aria-current={current === s.n ? 'step' : undefined}
          >
            {s.n}
          </span>
          <span style={{ color: current >= s.n ? 'var(--fg-primary)' : 'var(--fg-tertiary)' }}>
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <span aria-hidden style={{ color: 'var(--border-strong)' }}>
              ·
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 1 — Identificação
// ---------------------------------------------------------------------------

function Step1Card({
  data,
  onChange,
  onContinuar,
  valido,
}: {
  data: Step1Data
  onChange: (d: Step1Data) => void
  onContinuar: () => void
  valido: boolean
}) {
  return (
    <div
      className="rounded-lg p-5 space-y-4"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
    >
      <h2 className="text-base font-medium" style={{ color: 'var(--fg-primary)' }}>
        Step 1 · Identificação do concurso
      </h2>

      <Field label="Nome do concurso *">
        <Input
          value={data.nome}
          onChange={(v) => onChange({ ...data, nome: v })}
          placeholder="Agente da Polícia Federal 2026"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Banca *">
          <Select
            value={data.banca}
            onChange={(v) => onChange({ ...data, banca: v })}
            options={[{ value: '', label: 'Selecione…' }, ...BANCAS.map((b) => ({ value: b, label: b }))]}
          />
        </Field>
        <Field label="Cargo *">
          <Input
            value={data.cargo}
            onChange={(v) => onChange({ ...data, cargo: v })}
            placeholder="Agente"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Nível">
          <Select
            value={data.nivel}
            onChange={(v) => onChange({ ...data, nivel: v as Step1Data['nivel'] })}
            options={[
              { value: '', label: 'Não definir' },
              { value: 'medio', label: 'Médio' },
              { value: 'superior', label: 'Superior' },
            ]}
          />
        </Field>
        <Field label="Data prevista da prova">
          <Input
            type="date"
            value={data.dataProva}
            onChange={(v) => onChange({ ...data, dataProva: v })}
          />
        </Field>
      </div>

      <div className="flex justify-end pt-2">
        <PrimaryButton onClick={onContinuar} disabled={!valido}>
          Continuar
        </PrimaryButton>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 2 — Upload edital
// ---------------------------------------------------------------------------

function Step2Card({
  textoEdital,
  onChangeTexto,
  horasTotais,
  onChangeHoras,
  nivelProfundidade,
  onChangeNivel,
  onProcessar,
  onVoltar,
  valido,
  pending,
}: {
  textoEdital: string
  onChangeTexto: (v: string) => void
  horasTotais: number
  onChangeHoras: (v: number) => void
  nivelProfundidade: 'basico' | 'intermediario' | 'avancado'
  onChangeNivel: (v: 'basico' | 'intermediario' | 'avancado') => void
  onProcessar: () => void
  onVoltar: () => void
  valido: boolean
  pending: boolean
}) {
  return (
    <div
      className="rounded-lg p-5 space-y-4"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
    >
      <h2 className="text-base font-medium" style={{ color: 'var(--fg-primary)' }}>
        Step 2 · Conteúdo programático
      </h2>

      <Field label="Cole o texto do edital *">
        <textarea
          value={textoEdital}
          onChange={(e) => onChangeTexto(e.target.value)}
          rows={16}
          placeholder="Cole o conteúdo programático do edital aqui…"
          className="w-full px-3 py-2 rounded-md text-sm font-mono leading-relaxed resize-y"
          style={{
            backgroundColor: 'var(--bg-canvas)',
            border: '1px solid var(--border-default)',
            color: 'var(--fg-primary)',
            minHeight: '320px',
          }}
        />
        <div
          className="flex justify-between text-xs mt-1"
          style={{ color: 'var(--fg-tertiary)' }}
        >
          <span>
            {textoEdital.length.toLocaleString('pt-BR')} caracteres
          </span>
          <span>
            Apenas conteúdo programático. Ignore disposições gerais.
          </span>
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Horas totais do cronograma">
          <Input
            type="number"
            value={String(horasTotais)}
            onChange={(v) => onChangeHoras(Math.max(1, Number(v) || 0))}
            placeholder="400"
          />
        </Field>
        <Field label="Nível de profundidade">
          <Select
            value={nivelProfundidade}
            onChange={(v) => onChangeNivel(v as typeof nivelProfundidade)}
            options={[
              { value: 'basico', label: 'Básico' },
              { value: 'intermediario', label: 'Intermediário' },
              { value: 'avancado', label: 'Avançado' },
            ]}
          />
        </Field>
      </div>

      <div className="flex justify-between pt-2">
        <SecondaryButton onClick={onVoltar} disabled={pending}>
          ← Voltar
        </SecondaryButton>
        <PrimaryButton onClick={onProcessar} disabled={!valido || pending}>
          {pending ? 'Processando…' : 'Processar edital'}
        </PrimaryButton>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 3 — Processando
// ---------------------------------------------------------------------------

function Step3Processando({ status, concursoNome }: { status: string | null; concursoNome: string }) {
  return (
    <div
      className="rounded-lg p-8 text-center space-y-5"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
    >
      <div
        className="inline-block w-10 h-10 rounded-full border-2 border-transparent animate-spin"
        style={{
          borderColor: 'var(--border-default)',
          borderTopColor: 'var(--color-revisao-solid)',
        }}
        aria-label="Processando"
        role="status"
      />
      <div>
        <h2 className="text-base font-medium" style={{ color: 'var(--fg-primary)' }}>
          Processando {concursoNome || 'concurso'}
        </h2>
        <p className="text-sm mt-2" style={{ color: 'var(--fg-secondary)' }}>
          {status ?? 'Aguardando…'}
        </p>
        <p className="text-xs mt-3" style={{ color: 'var(--fg-tertiary)' }}>
          O parsing pode levar de 1 a 3 minutos dependendo do tamanho do edital. Você
          será redirecionado pra tela de revisão automaticamente.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mini primitivos
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

function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded-md text-sm"
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
      className="w-full px-3 py-2 rounded-md text-sm"
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

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        backgroundColor: 'rgba(127,119,221,0.2)',
        border: '1px solid rgba(127,119,221,0.4)',
        color: 'var(--color-revisao-text)',
      }}
    >
      {children}
    </button>
  )
}

function SecondaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-2 rounded-md text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        backgroundColor: 'transparent',
        border: '1px solid var(--border-default)',
        color: 'var(--fg-secondary)',
      }}
    >
      {children}
    </button>
  )
}
