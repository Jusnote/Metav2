import { NodeViewWrapper, ReactNodeViewProps } from '@tiptap/react';
import { AnimatedCarousel } from './animated-carousel';
import { useState, useEffect } from 'react';

interface CarouselAttrs {
  slides: Array<{ content: string; image: string }>;
}

export function CarouselNodeView({ node, updateAttributes }: ReactNodeViewProps) {
  const attrs = node.attrs as CarouselAttrs;
  const [slides, setSlides] = useState(attrs.slides || []);

  useEffect(() => {
    setSlides(attrs.slides || []);
  }, [attrs.slides]);

  const handleSlideContentChange = (slideIndex: number, content: string) => {
    const updatedSlides = slides.map((slide: { content: string; image: string }, index: number) => 
      index === slideIndex ? { ...slide, content } : slide
    );
    
    setSlides(updatedSlides);
    updateAttributes({ slides: updatedSlides });
  };

  return (
    <NodeViewWrapper className="carousel-wrapper">
      <AnimatedCarousel
        slides={slides}
        editable={true}
        onSlideContentChange={handleSlideContentChange}
        className="my-4"
      />
    </NodeViewWrapper>
  );
}
