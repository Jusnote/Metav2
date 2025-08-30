import React from 'react';
import './lexical-playground/index.css';

// Importação dinâmica para melhor performance
const LexicalApp = React.lazy(() => 
  import('./lexical-playground/App').then(module => ({ default: module.default }))
);

export interface LexicalPlaygroundProps {
  className?: string;
  style?: React.CSSProperties;
}

export default function LexicalPlaygroundComponent({ 
  className = '', 
  style 
}: LexicalPlaygroundProps) {
  return (
    <div className={`lexical-playground-wrapper ${className}`} style={style}>
      <React.Suspense fallback={<div className="loading-spinner">Carregando editor...</div>}>
        <LexicalApp />
      </React.Suspense>
    </div>
  );
}

// Exportar componentes e utilitários adicionais
export { default as PlaygroundApp } from './lexical-playground/App';
export { default as PlaygroundEditor } from './lexical-playground/Editor';
export { default as PlaygroundSettings } from './lexical-playground/Settings';

// Exportar contextos
export { SettingsContext } from './lexical-playground/context/SettingsContext';
export { SharedHistoryContext } from './lexical-playground/context/SharedHistoryContext';

// Exportar temas
export { default as PlaygroundEditorTheme } from './lexical-playground/themes/PlaygroundEditorTheme';

// Exportar nodes
export { default as PlaygroundNodes } from './lexical-playground/nodes/PlaygroundNodes';
