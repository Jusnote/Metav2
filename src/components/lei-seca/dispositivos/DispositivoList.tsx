import { useRef, useCallback } from 'react'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'
import type { Dispositivo } from '@/types/lei-api'
import { DispositivoRenderer } from './DispositivoRenderer'

interface DispositivoListProps {
  dispositivos: Dispositivo[]
  totalCount: number
  loadMore: () => void
  hasMore: boolean
  isLoadingMore: boolean
  leiSecaMode?: boolean
  showRevogados?: boolean
  onRangeChanged?: (startIndex: number, endIndex: number) => void
  /** Optional external ref to access the Virtuoso imperative handle (e.g. scrollToIndex) */
  virtuosoRef?: React.RefObject<VirtuosoHandle | null>
}

export function DispositivoList({
  dispositivos,
  totalCount,
  loadMore,
  hasMore,
  isLoadingMore,
  leiSecaMode,
  showRevogados,
  onRangeChanged,
  virtuosoRef: externalRef,
}: DispositivoListProps) {
  const internalRef = useRef<VirtuosoHandle>(null)
  const virtuosoRef = externalRef ?? internalRef

  const handleEndReached = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      loadMore()
    }
  }, [hasMore, isLoadingMore, loadMore])

  return (
    <Virtuoso
      ref={virtuosoRef as React.RefObject<VirtuosoHandle>}
      data={dispositivos}
      endReached={handleEndReached}
      overscan={200}
      itemContent={(index, item) => (
        <div className="max-w-3xl mx-auto px-11 font-[Literata,Georgia,serif] text-base leading-[1.9]">
          <DispositivoRenderer
            item={item}
            leiSecaMode={leiSecaMode}
            showRevogados={showRevogados}
          />
        </div>
      )}
      rangeChanged={({ startIndex, endIndex }) => {
        onRangeChanged?.(startIndex, endIndex)
      }}
      components={{
        Footer: () =>
          isLoadingMore ? (
            <div className="max-w-3xl mx-auto px-14 text-center py-4 text-muted-foreground text-sm">
              Carregando mais dispositivos...
            </div>
          ) : null,
      }}
      style={{ height: '100%' }}
    />
  )
}

export type { VirtuosoHandle }
