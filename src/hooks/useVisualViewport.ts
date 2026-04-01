'use client';

import { useEffect } from 'react';

/**
 * Sets CSS custom property --visual-vh on <html> for browsers without dvh support.
 * Value = 1% of visualViewport.height (recalculates when keyboard opens/closes).
 */
export function useVisualViewport() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Skip if browser supports dvh natively
    if (CSS.supports('height', '1dvh')) return;

    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      document.documentElement.style.setProperty(
        '--visual-vh',
        `${vv.height * 0.01}px`,
      );
    };

    update();
    vv.addEventListener('resize', update);
    return () => vv.removeEventListener('resize', update);
  }, []);
}
