import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { PickerSkeleton } from '../shared/PickerSkeleton';

describe('PickerSkeleton', () => {
  it('renderiza 8 linhas placeholders por padrão', () => {
    const { container } = render(<PickerSkeleton />);
    const rows = container.querySelectorAll('[data-testid="skeleton-row"]');
    expect(rows.length).toBe(8);
  });

  it('aceita prop rows pra controlar quantidade', () => {
    const { container } = render(<PickerSkeleton rows={3} />);
    const rows = container.querySelectorAll('[data-testid="skeleton-row"]');
    expect(rows.length).toBe(3);
  });

  it('cada linha tem classes de animação pulse', () => {
    const { container } = render(<PickerSkeleton rows={1} />);
    const row = container.querySelector('[data-testid="skeleton-row"]');
    expect(row?.className).toMatch(/animate-pulse/);
  });
});
