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
}: DispositivoListProps) {
  const virtuosoRef = useRef<VirtuosoHandle>(null)

  const handleEndReached = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      loadMore()
    }
  }, [hasMore, isLoadingMore, loadMore])

  return (
    <Virtuoso
      ref={virtuosoRef}
      data={dispositivos}
      endReached={handleEndReached}
      overscan={200}
      itemContent={(index, item) => (
        <DispositivoRenderer
          item={item}
          leiSecaMode={leiSecaMode}
          showRevogados={showRevogados}
        />
      )}
      rangeChanged={({ startIndex, endIndex }) => {
        onRangeChanged?.(startIndex, endIndex)
      }}
      components={{
        Footer: () =>
          isLoadingMore ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              Carregando mais dispositivos...
            </div>
          ) : null,
      }}
      style={{ height: '100%' }}
    />
  )
}

export type { VirtuosoHandle }
