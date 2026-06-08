import React, { useEffect } from 'react';
import { useFloating, FloatingPortal, offset, flip, shift, autoUpdate, type Placement } from '@floating-ui/react';

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
 * Isso escapa de ancestrais com transform/animation (ex.: o card .qc-card-enter)
 * que aprisionariam um position:fixed. Floating UI cuida de flip/shift/autoUpdate.
 */
export function HighlightPopover({
  anchor, placement = 'bottom', children,
}: {
  anchor: AnchorRectSource;
  placement?: Placement;
  children: React.ReactNode;
}) {
  const { refs, floatingStyles, isPositioned } = useFloating({
    placement,
    strategy: 'fixed',
    middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  useEffect(() => {
    refs.setPositionReference(anchor);
  }, [refs, anchor]);

  return (
    <FloatingPortal>
      <div
        ref={refs.setFloating}
        style={{ ...floatingStyles, zIndex: 55, visibility: isPositioned ? 'visible' : 'hidden' }}
      >
        {children}
      </div>
    </FloatingPortal>
  );
}
