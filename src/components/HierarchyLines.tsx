import React from 'react';

interface HierarchyLinesProps {
  type: 'unit-to-topic' | 'topic-to-subtopic';
  isLast?: boolean;
  hasChildren?: boolean;
}

/**
 * Componente para renderizar linhas curvas de conexão hierárquica
 * Usa SVG para criar linhas suaves e arredondadas
 */
export const HierarchyLines: React.FC<HierarchyLinesProps> = ({
  type,
  isLast = false,
  hasChildren = true
}) => {
  if (!hasChildren) return null;

  if (type === 'unit-to-topic') {
    return (
      <div className="absolute left-3 top-12 bottom-0 w-8">
        <svg className="w-full h-full" preserveAspectRatio="none">
          {/* Linha vertical da unit */}
          <line
            x1="0"
            y1="0"
            x2="0"
            y2={isLast ? "50%" : "100%"}
            stroke="#cbd5e1"
            strokeWidth="2"
          />
        </svg>
      </div>
    );
  }

  if (type === 'topic-to-subtopic') {
    return (
      <div className="absolute left-3 top-10 w-6 h-6">
        <svg width="24" height="24" viewBox="0 0 24 24">
          {/* Linha curva horizontal conectando topic ao subtopic */}
          <path
            d="M 0 0 L 0 8 Q 0 12, 4 12 L 24 12"
            stroke="#cbd5e1"
            strokeWidth="2"
            fill="none"
          />
        </svg>
      </div>
    );
  }

  return null;
};

/**
 * Linha horizontal curva simples para conectar itens
 */
export const CurvedConnector: React.FC<{ length?: number }> = ({ length = 20 }) => {
  return (
    <svg width={length + 4} height="24" className="absolute -left-5 top-1/2 -translate-y-1/2">
      <path
        d={`M 0 12 Q 4 12, 4 8 L 4 0`}
        stroke="#cbd5e1"
        strokeWidth="2"
        fill="none"
      />
      <line
        x1="4"
        y1="12"
        x2={length}
        y2="12"
        stroke="#cbd5e1"
        strokeWidth="2"
      />
    </svg>
  );
};
