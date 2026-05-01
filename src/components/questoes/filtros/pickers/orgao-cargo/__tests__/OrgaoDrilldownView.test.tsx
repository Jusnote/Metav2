import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { OrgaoDrilldownView } from '../OrgaoDrilldownView';

describe('OrgaoDrilldownView', () => {
  const baseProps = {
    orgao: 'TRF1',
    availableCargos: { 'Juiz Federal': 1234, 'Analista Judiciário': 567, 'Técnico': 89 },
    selection: 'all' as const,
    onMarkAll: vi.fn(),
    onTogglePair: vi.fn(),
    onRefineToSpecific: vi.fn(),
    onBack: vi.fn(),
    totalCount: 12345,
  };

  it('renderiza header com órgão + back button', () => {
    render(<OrgaoDrilldownView {...baseProps} />);
    expect(screen.getByText('TRF1')).toBeInTheDocument();
    expect(screen.getByText(/voltar/i)).toBeInTheDocument();
  });

  it('botão "Marcar todos" com count', () => {
    render(<OrgaoDrilldownView {...baseProps} selection={undefined} />);
    expect(screen.getByText(/marcar todos/i)).toBeInTheDocument();
    expect(screen.getByText(/12\.345/)).toBeInTheDocument();
  });

  it('botão all chama onMarkAll', () => {
    const onMark = vi.fn();
    render(<OrgaoDrilldownView {...baseProps} selection={undefined} onMarkAll={onMark} />);
    fireEvent.click(screen.getByText(/marcar todos/i));
    expect(onMark).toHaveBeenCalledWith('TRF1');
  });

  it('quando selection é "all" mostra estado ativo + botão pra desfazer', () => {
    render(<OrgaoDrilldownView {...baseProps} selection="all" />);
    expect(screen.getByText(/todos os cargos selecionados/i)).toBeInTheDocument();
  });

  it('link "Refinar cargos individualmente" dispara onRefineToSpecific', () => {
    const onRefine = vi.fn();
    render(<OrgaoDrilldownView {...baseProps} selection="all" onRefineToSpecific={onRefine} />);
    fireEvent.click(screen.getByText(/refinar cargos individualmente/i));
    expect(onRefine).toHaveBeenCalledWith('TRF1');
  });

  it('renderiza lista de cargos com counts', () => {
    render(<OrgaoDrilldownView {...baseProps} selection={[]} />);
    expect(screen.getByText('Juiz Federal')).toBeInTheDocument();
    expect(screen.getByText('1.234')).toBeInTheDocument();
  });

  it('toggle de cargo chama onTogglePair', () => {
    const onToggle = vi.fn();
    render(<OrgaoDrilldownView {...baseProps} selection={[]} onTogglePair={onToggle} />);
    fireEvent.click(screen.getByText('Juiz Federal'));
    expect(onToggle).toHaveBeenCalledWith('TRF1', 'Juiz Federal');
  });

  it('back button chama onBack', () => {
    const onBack = vi.fn();
    render(<OrgaoDrilldownView {...baseProps} onBack={onBack} />);
    fireEvent.click(screen.getByText(/voltar/i));
    expect(onBack).toHaveBeenCalled();
  });
});
