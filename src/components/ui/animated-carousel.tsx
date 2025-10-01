"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, forwardRef } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

type CarouselSlide = {
  image: string;
  content: string;
};

interface AnimatedCarouselProps {
  slides: CarouselSlide[];
  autoplay?: boolean;
  className?: string;
  onSlideContentChange?: (slideIndex: number, content: string) => void;
  editable?: boolean;
}

export const AnimatedCarousel = forwardRef<HTMLDivElement, AnimatedCarouselProps>(({ 
  slides, 
  autoplay = false, 
  className,
  onSlideContentChange,
  editable = false
}, ref) => {
  const [active, setActive] = useState(0);

  const handleNext = () => {
    setActive((prev) => (prev + 1) % slides.length);
  };

  const handlePrev = () => {
    setActive((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const isActive = (index: number) => {
    return index === active;
  };

  useEffect(() => {
    if (autoplay) {
      const interval = setInterval(handleNext, 5000);
      return () => clearInterval(interval);
    }
  }, [autoplay]);

  const randomRotateY = () => {
    return Math.floor(Math.random() * 21) - 10;
  };

  const handleContentChange = (content: string) => {
    if (onSlideContentChange) {
      onSlideContentChange(active, content);
    }
  };

  if (!slides || slides.length === 0) {
    return (
      <div className={cn("max-w-sm md:max-w-4xl mx-auto px-4 md:px-8 lg:px-12 py-8", className)}>
        <div className="text-center text-muted-foreground">
          Nenhum slide disponível
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className={cn("max-w-sm md:max-w-4xl mx-auto px-4 md:px-8 lg:px-12 py-8", className)}>
      <div className="relative grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Imagens */}
        <div>
          <div className="relative h-80 w-full">
            <AnimatePresence>
              {slides.map((slide, index) => (
                <motion.div
                  key={`${slide.image}-${index}`}
                  initial={{
                    opacity: 0,
                    scale: 0.9,
                    z: -100,
                    rotate: randomRotateY(),
                  }}
                  animate={{
                    opacity: isActive(index) ? 1 : 0.7,
                    scale: isActive(index) ? 1 : 0.95,
                    z: isActive(index) ? 0 : -100,
                    rotate: isActive(index) ? 0 : randomRotateY(),
                    zIndex: isActive(index)
                      ? 999
                      : slides.length + 2 - index,
                    y: isActive(index) ? [0, -80, 0] : 0,
                  }}
                  exit={{
                    opacity: 0,
                    scale: 0.9,
                    z: 100,
                    rotate: randomRotateY(),
                  }}
                  transition={{
                    duration: 0.4,
                    ease: "easeInOut",
                  }}
                  className="absolute inset-0 origin-bottom"
                >
                  <img
                    src={slide.image}
                    alt={`Slide ${index + 1}`}
                    draggable={false}
                    className="h-full w-full rounded-3xl object-cover object-center shadow-lg"
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex justify-between flex-col py-4">
          <div className="h-96 overflow-y-auto overflow-x-hidden pr-4">
            <motion.div
              key={active}
              initial={{
                y: 20,
                opacity: 0,
              }}
              animate={{
                y: 0,
                opacity: 1,
              }}
              exit={{
                y: -20,
                opacity: 0,
              }}
              transition={{
                duration: 0.2,
                ease: "easeInOut",
              }}
              className="w-full"
            >
              {editable ? (
                <div
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleContentChange(e.currentTarget.innerHTML)}
                  className="min-h-[200px] p-4 border border-border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary focus:border-transparent w-full break-words"
                  dangerouslySetInnerHTML={{ __html: slides[active]?.content || "Escreva aqui..." }}
                />
              ) : (
                <div 
                  className="text-foreground prose prose-sm max-w-none prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2 w-full break-words whitespace-normal"
                  dangerouslySetInnerHTML={{ __html: slides[active]?.content || "" }}
                />
              )}
            </motion.div>
          </div>

          {/* Navegação */}
          <div className="flex gap-4 pt-8 md:pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrev}
              className="h-10 w-10 rounded-full bg-secondary hover:bg-secondary/80 flex items-center justify-center group/button"
            >
              <ChevronLeft className="h-5 w-5 text-foreground group-hover/button:rotate-12 transition-transform duration-300" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNext}
              className="h-10 w-10 rounded-full bg-secondary hover:bg-secondary/80 flex items-center justify-center group/button"
            >
              <ChevronRight className="h-5 w-5 text-foreground group-hover/button:-rotate-12 transition-transform duration-300" />
            </Button>
          </div>

          {/* Indicadores */}
          <div className="flex justify-center gap-2 mt-4">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setActive(index)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all duration-200",
                  isActive(index) 
                    ? "bg-primary w-8" 
                    : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

AnimatedCarousel.displayName = "AnimatedCarousel";