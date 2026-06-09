import React, { useEffect, useRef } from 'react';
import { useFloating, FloatingPortal, offset, flip, shift, arrow, autoUpdate, type Placement } from '@floating-ui/react';

export interface AnchorRectSource {
  getBoundingClientRect(): DOMRect;
  getClientRects?: () => DOMRectList;
  /** Elemento real dentro do container que rola — necessário pro autoUpdate
   *  achar o scroll container certo e pro cálculo correto com ancestrais transformados. */
  contextElement?: Element;
}

/**
 * Posiciona um popover ancorado a um "virtual element" (o retângulo de uma seleção
 * de texto ou de um ponto de clique), renderizando-o num portal no <body>.
 * Com `showArrow`, uma setinha aponta de fato pro alvo (middleware arrow).
 */
export function HighlightPopover({
  anchor, placement = 'bottom', showArrow = false, children,
}: {
  anchor: AnchorRectSource;
  placement?: Placement;
  showArrow?: boolean;
  children: React.ReactNode;
}) {
  const arrowRef = useRef<HTMLDivElement | null>(null);
  const pad = { top: 72, bottom: 8, left: 8, right: 8 };
  const { refs, floatingStyles, isPositioned, middlewareData, placement: finalPlacement } = useFloating({
    placement,
    strategy: 'fixed',
    middleware: [
      offset(8),
      flip({ padding: pad }),
      shift({ padding: pad }),
      ...(showArrow ? [arrow({ element: arrowRef, padding: 16 })] : []),
    ],
    whileElementsMounted: autoUpdate,
  });

  useEffect(() => {
    refs.setPositionReference(anchor);
  }, [refs, anchor]);

  const side = finalPlacement.split('-')[0] as 'top' | 'bottom' | 'left' | 'right';
  const staticSide = ({ top: 'bottom', bottom: 'top', left: 'right', right: 'left' } as const)[side];
  const arrowStyle: React.CSSProperties = {
    left: middlewareData.arrow?.x != null ? `${middlewareData.arrow.x}px` : undefined,
    top: middlewareData.arrow?.y != null ? `${middlewareData.arrow.y}px` : undefined,
    [staticSide]: '-9px',
  };

  return (
    <FloatingPortal>
      <div
        ref={refs.setFloating}
        style={{ ...floatingStyles, zIndex: 55, visibility: isPositioned ? 'visible' : 'hidden' }}
      >
        {children}
        {showArrow && <div ref={arrowRef} className={`qh-arrow qh-arrow-${side}`} style={arrowStyle} />}
      </div>
    </FloatingPortal>
  );
}
