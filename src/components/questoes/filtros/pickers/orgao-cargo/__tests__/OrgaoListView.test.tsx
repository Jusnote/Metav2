import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { OrgaoListView } from '../OrgaoListView';

const dicionario = {
  bancas: {},
  orgaos: { trf1: 'TRF1', stj: 'STJ', tj: 'TJ' },
  cargos: {},
  materias: [], assuntos: [], materia_assuntos: {},
  anos: { min: 2010, max: 2024 },
};

describe('OrgaoListView', () => {
  it('renderiza header e busca', () => {
    render(
      <OrgaoListView
        dicionario={dicionario}
        orgaosSelecionados={new Map()}
        onSelectOrgao={vi.fn()}
        onOpenFlatSearch={vi.fn()}
      />,
    );
    expect(screen.getByText(/Órgãos/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/buscar órgão/i)).toBeInTheDocument();
  });

  it('renderiza órgãos em ordem alfabética', () => {
    render(
      <OrgaoListView
        dicionario={dicionario}
        orgaosSelecionados={new Map()}
        onSelectOrgao={vi.fn()}
        onOpenFlatSearch={vi.fn()}
      />,
    );
    expect(screen.getByText('TRF1')).toBeInTheDocument();
    expect(screen.getByText('STJ')).toBeInTheDocument();
  });

  it('badge "todos" quando órgão está em modo all', () => {
    render(
      <OrgaoListView
        dicionario={dicionario}
        orgaosSelecionados={new Map([['TRF1', 'all']])}
        onSelectOrgao={vi.fn()}
        onOpenFlatSearch={vi.fn()}
      />,
    );
    expect(screen.getByText(/todos/i)).toBeInTheDocument();
  });

  it('badge "N cargos" quando órgão tem cargos específicos', () => {
    render(
      <OrgaoListView
        dicionario={dicionario}
        orgaosSelecionados={new Map([['STJ', ['Ministro', 'Analista']]])}
        onSelectOrgao={vi.fn()}
        onOpenFlatSearch={vi.fn()}
      />,
    );
    expect(screen.getByText(/2 cargos/i)).toBeInTheDocument();
  });

  it('clicar em órgão chama onSelectOrgao', () => {
    const onSelect = vi.fn();
    render(
      <OrgaoListView
        dicionario={dicionario}
        orgaosSelecionados={new Map()}
        onSelectOrgao={onSelect}
        onOpenFlatSearch={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('TRF1'));
    expect(onSelect).toHaveBeenCalledWith('TRF1');
  });

  it('botão "Buscar cargo direto" chama onOpenFlatSearch', () => {
    const onOpen = vi.fn();
    render(
      <OrgaoListView
        dicionario={dicionario}
        orgaosSelecionados={new Map()}
        onSelectOrgao={vi.fn()}
        onOpenFlatSearch={onOpen}
      />,
    );
    fireEvent.click(screen.getByText(/buscar cargo direto/i));
    expect(onOpen).toHaveBeenCalled();
  });

  it('search filtra a lista', () => {
    render(
      <OrgaoListView
        dicionario={dicionario}
        orgaosSelecionados={new Map()}
        onSelectOrgao={vi.fn()}
        onOpenFlatSearch={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/buscar órgão/i), { target: { value: 'TRF' } });
    expect(screen.getByText('TRF1')).toBeInTheDocument();
    expect(screen.queryByText('STJ')).not.toBeInTheDocument();
  });
});
