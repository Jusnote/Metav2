'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { FixedToolbar } from '@/components/ui/fixed-toolbar';

export function ScrollableFixedToolbar({
  children,
  className,
  ...props
}: React.ComponentProps<typeof FixedToolbar>) {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);

  const checkScroll = React.useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
  }, []);

  React.useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Check initial state
    checkScroll();

    // Listen to scroll events
    container.addEventListener('scroll', checkScroll);

    // Listen to resize events
    const resizeObserver = new ResizeObserver(checkScroll);
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener('scroll', checkScroll);
      resizeObserver.disconnect();
    };
  }, [checkScroll]);

  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = 200;
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  return (
    <div className="flex items-center gap-1">
      {/* Botão de navegação esquerda */}
      {canScrollLeft ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => scroll('left')}
          className="h-9 w-9 shrink-0 rounded-md p-0 hover:bg-neutral-100"
        >
          <ChevronLeft className="h-4 w-4 text-neutral-700" />
        </Button>
      ) : (
        <div className="h-9 w-9 shrink-0" />
      )}

      {/* Toolbar */}
      <FixedToolbar
        {...props}
        ref={scrollContainerRef}
        className={cn('scrollbar-hide flex-1', className)}
      >
        {children}
      </FixedToolbar>

      {/* Botão de navegação direita */}
      {canScrollRight ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => scroll('right')}
          className="h-9 w-9 shrink-0 rounded-md p-0 hover:bg-neutral-100"
        >
          <ChevronRight className="h-4 w-4 text-neutral-700" />
        </Button>
      ) : (
        <div className="h-9 w-9 shrink-0" />
      )}
    </div>
  );
}
