// /v3/cursos/[id]/resumos/[blocoId] — stub temporário.
// Leitor de resumo do aluno entra junto com o editor admin na próxima iteração.

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { carregarContextoBloco } from '@/v3/lib/resumos/arvore-resumos'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string; blocoId: string }>
}

export default async function LeitorResumoStubPage({ params }: Props) {
  const { id, blocoId } = await params
  const contexto = await carregarContextoBloco(id, blocoId)
  if (!contexto) notFound()

  return (
    <div className="h-full w-full flex flex-col bg-background">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-4 p-4 max-w-7xl mx-auto w-full">
          <Link href={`/v3/cursos/${id}`}>
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
        <div className="max-w-2xl mx-auto px-6 py-16 text-center space-y-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted">
            <FileText className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold">Resumo em preparação</h2>
          <p className="text-muted-foreground">
            O conteúdo deste bloco ainda não foi publicado pelo admin.
            Volte em breve.
          </p>
        </div>
      </div>
    </div>
  )
}
