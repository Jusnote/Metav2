import { NodeViewWrapper } from '@tiptap/react';
import { AnimatedCarousel } from './animated-carousel';
import { useState, useEffect } from 'react';

interface CarouselNodeViewProps {
  node: {
    attrs: {
      slides: Array<{ content: string; image: string }>;
    };
  };
  updateAttributes: (attrs: any) => void;
}

export function CarouselNodeView({ node, updateAttributes }: CarouselNodeViewProps) {
  const [slides, setSlides] = useState(node.attrs.slides || []);

  useEffect(() => {
    setSlides(node.attrs.slides || []);
  }, [node.attrs.slides]);

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