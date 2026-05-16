import { BookOpen } from 'lucide-react'

export function CuradoriaEmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-8">
      <BookOpen className="h-12 w-12 text-slate-300" />
      <h2 className="text-lg font-semibold text-slate-700 mt-4">Selecione um cargo</h2>
      <p className="text-sm text-slate-500 mt-2 max-w-md">
        Escolha um cargo na lista à esquerda pra revisar a decomposição do edital,
        editar subtópicos manualmente e publicar pra liberar no V2 do cronograma.
      </p>
    </div>
  )
}
