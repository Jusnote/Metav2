import { useEffect } from 'react'
import type { Dispositivo, Lei } from '@/types/lei-api'

export function useCopyWithReference(
  dispositivos: Dispositivo[],
  currentLei: Lei | null,
) {
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed) return

      const anchorNode = selection.anchorNode
      if (!anchorNode) return

      const dispositivoEl = (anchorNode as HTMLElement).closest?.('[data-posicao]')
        ?? (anchorNode.parentElement as HTMLElement)?.closest?.('[data-posicao]')

      if (!dispositivoEl) return

      const posicao = parseInt(dispositivoEl.getAttribute('data-posicao') ?? '', 10)
      const disp = dispositivos.find(d => d.posicao === posicao)

      if (!disp) return

      const leiName = currentLei?.apelido ?? currentLei?.titulo ?? ''
      let ref = ''
      if (disp.tipo === 'ARTIGO' && disp.numero) {
        ref = `Art. ${disp.numero}, ${leiName}`
      } else if (disp.tipo === 'PARAGRAFO' && disp.numero) {
        ref = `§ ${disp.numero}, ${leiName}`
      } else if (disp.numero) {
        ref = `${disp.numero}, ${leiName}`
      } else {
        ref = leiName
      }

      const selectedText = selection.toString()
      const textWithRef = `${selectedText}\n— ${ref}`

      e.preventDefault()
      e.clipboardData?.setData('text/plain', textWithRef)
    }

    document.addEventListener('copy', handler)
    return () => document.removeEventListener('copy', handler)
  }, [dispositivos, currentLei])
}
