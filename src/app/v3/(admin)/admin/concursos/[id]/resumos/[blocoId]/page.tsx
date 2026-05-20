// /v3/admin/concursos/[id]/resumos/[blocoId] — stub temporário.
// Editor de resumo está em re-design. Por ora, mostra contexto do bloco
// e link de volta pra lista. A implementação Plate completa entra depois.

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { carregarContextoBloco } from '@/v3/lib/resumos/arvore-resumos'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string; blocoId: string }>
}

export default async function EditorResumoStubPage({ params }: Props) {
  const { id, blocoId } = await params
  const contexto = await carregarContextoBloco(id, blocoId)
  if (!contexto) notFound()

  return (
    <div className="h-full w-full flex flex-col bg-background">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-4 p-4 max-w-7xl mx-auto w-full">
          <Link href={`/v3/admin/concursos/${id}/resumos`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">{contexto.bloco.nome}</h1>
              <p className="text-sm text-muted-foreground">
                Aula {String(contexto.aula.ordem).padStart(2, '0')} ·{' '}
                {contexto.disciplina.nome}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto px-6 py-16">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold">Editor em re-design</h2>
            <p className="text-muted-foreground">
              A escrita do resumo deste bloco será habilitada na próxima iteração.
              Por enquanto, use a lista pra organizar quais blocos precisam de
              resumo e voltamos aqui depois.
            </p>
            <div className="pt-4">
              <Link href={`/v3/admin/concursos/${id}/resumos`}>
                <Button variant="outline">Voltar para a lista</Button>
              </Link>
            </div>
          </div>

          <div className="mt-12 border rounded-lg p-6 bg-muted/30">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Contexto do bloco
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Disciplina</dt>
                <dd className="font-medium">{contexto.disciplina.nome}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Aula</dt>
                <dd className="font-medium">
                  {String(contexto.aula.ordem).padStart(2, '0')} ·{' '}
                  {contexto.aula.nome}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Bloco</dt>
                <dd className="font-medium">
                  {contexto.bloco.ordem} · {contexto.bloco.nome}
                </dd>
              </div>
              {contexto.bloco.horas_sugeridas && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Carga sugerida</dt>
                  <dd className="font-medium">
                    {Math.round(contexto.bloco.horas_sugeridas * 60)} min
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}
