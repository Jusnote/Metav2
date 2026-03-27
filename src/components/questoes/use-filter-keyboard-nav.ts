import { useState, useCallback, useEffect } from 'react';

interface UseFilterKeyboardNavOptions {
  itemCount: number;
  onSelect: (index: number) => void;
  onClose: () => void;
  enabled: boolean;
}

export function useFilterKeyboardNav({
  itemCount,
  onSelect,
  onClose,
  enabled,
}: UseFilterKeyboardNavOptions) {
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  // Reset highlight when item count changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [itemCount]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!enabled || itemCount === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex(prev => (prev + 1) % itemCount);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex(prev => (prev - 1 + itemCount) % itemCount);
          break;
        case 'Enter':
          e.preventDefault();
          onSelect(highlightedIndex);
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [enabled, itemCount, highlightedIndex, onSelect, onClose],
  );

  return { highlightedIndex, setHighlightedIndex, handleKeyDown };
}
