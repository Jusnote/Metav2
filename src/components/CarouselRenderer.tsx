import { useEffect, useRef, forwardRef } from 'react';
import { createRoot } from 'react-dom/client';
import { AnimatedCarousel } from './ui/animated-carousel';
import { InteractiveExplanation } from './ui/interactive-explanation';

interface CarouselRendererProps {
  content: string;
  className?: string;
}

export const CarouselRenderer = forwardRef<HTMLDivElement, CarouselRendererProps>(({ content, className }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || typeof document === 'undefined') return;

    // Renderizar o conteúdo HTML
    containerRef.current.innerHTML = content;

    // Encontrar e substituir elementos de carrossel
    const carouselElements = containerRef.current.querySelectorAll('[data-carousel]');
    
    carouselElements.forEach((element) => {
      const slidesData = element.getAttribute('data-slides');
      if (slidesData) {
        try {
          // SSR protection
          if (typeof document === 'undefined') return;
          
          const slides = JSON.parse(slidesData);
          
          // Criar um container React para o carrossel
          const carouselContainer = document.createElement('div');
          carouselContainer.className = 'carousel-container my-4';
          
          // Substituir o elemento original
          element.parentNode?.replaceChild(carouselContainer, element);
          
          // Renderizar o componente React
          const root = createRoot(carouselContainer);
          root.render(
            <AnimatedCarousel
              slides={slides}
              editable={false}
              className="border border-border rounded-lg overflow-hidden"
            />
          );
        } catch (error) {
          console.error('Erro ao processar dados do carrossel:', error);
        }
      }
    });

    // Encontrar e substituir elementos de explicação interativa
    const explanationElements = containerRef.current.querySelectorAll('span[data-explanation]');
    console.log('Elementos de explicação encontrados:', explanationElements.length);
    
    explanationElements.forEach((element, index) => {
      const explanation = element.getAttribute('data-explanation');
      const textContent = element.textContent || '';
      
      console.log(`Processando explicação ${index}:`, { explanation, textContent });
      
      if (explanation) {
        // SSR protection
        if (typeof document === 'undefined') return;
        
        // Criar um container React para a explicação
        const explanationContainer = document.createElement('span');
        explanationContainer.className = 'interactive-explanation-container';
        
        // Substituir o elemento original
        element.parentNode?.replaceChild(explanationContainer, element);
        
        // Renderizar o componente React
        const root = createRoot(explanationContainer);
        root.render(
          <InteractiveExplanation explanation={explanation}>
            {textContent}
          </InteractiveExplanation>
        );
        console.log(`Explicação ${index} renderizada com sucesso`);
      }
    });

    // Cleanup function
    return () => {
      carouselElements.forEach((_element) => {
        const container = containerRef.current?.querySelector('.carousel-container');
        if (container) {
          // O React vai limpar automaticamente quando o componente for desmontado
        }
      });
    };
  }, [content]);

  return (
    <div 
      ref={(node) => {
        // Safely assign to containerRef
        if (containerRef && 'current' in containerRef) {
          (containerRef as any).current = node;
        }
        
        // Handle forwarded ref
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref && typeof ref === 'object' && 'current' in ref) {
          // Use Object.defineProperty to safely assign to potentially read-only ref
          try {
            (ref as any).current = node;
          } catch (error) {
            // If assignment fails, the ref is read-only, which is fine
            console.warn('Could not assign to ref.current - ref may be read-only');
          }
        }
      }}
      className={className}
    />
  );
});

CarouselRenderer.displayName = 'CarouselRenderer';