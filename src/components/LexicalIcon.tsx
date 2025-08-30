import React from 'react';

// Componente para carregar ícones SVG no Vite
export interface IconProps {
  name: string;
  className?: string;
  size?: number;
}

export function LexicalIcon({ name, className = '', size = 16 }: IconProps) {
  const iconUrl = `/lexical-icons/${name}.svg`;
  
  return (
    <img 
      src={iconUrl}
      alt={name}
      className={`lexical-icon ${className}`}
      width={size}
      height={size}
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        filter: 'currentColor'
      }}
    />
  );
}

// Hook para usar ícones SVG como data URLs (alternativa)
export function useSvgIcon(name: string) {
  const [iconData, setIconData] = React.useState<string>('');
  
  React.useEffect(() => {
    fetch(`/lexical-icons/${name}.svg`)
      .then(response => response.text())
      .then(svg => {
        const dataUrl = `data:image/svg+xml;base64,${btoa(svg)}`;
        setIconData(dataUrl);
      })
      .catch(console.error);
  }, [name]);
  
  return iconData;
}

export default LexicalIcon;
