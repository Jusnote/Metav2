"use client";

import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
import React from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
} from "framer-motion";
import { cn } from "@/lib/utils";

interface InteractiveExplanationProps {
  children: React.ReactNode;
  explanation: string;
  className?: string;
}

export const InteractiveExplanation = ({
  children,
  explanation,
  className
}: InteractiveExplanationProps) => {
  const [isOpen, setOpen] = React.useState(false);

  const springConfig = { stiffness: 100, damping: 15 };
  const x = useMotionValue(0);
  const translateX = useSpring(x, springConfig);

  const handleMouseMove = (event: React.MouseEvent) => {
    const targetRect = event.currentTarget.getBoundingClientRect();
    const eventOffsetX = event.clientX - targetRect.left;
    const offsetFromCenter = (eventOffsetX - targetRect.width / 2) / 2;
    x.set(offsetFromCenter);
  };

  return (
    <HoverCardPrimitive.Root
      openDelay={50}
      closeDelay={100}
      onOpenChange={(open) => {
        setOpen(open);
      }}
    >
      <HoverCardPrimitive.Trigger
        onMouseMove={handleMouseMove}
        className={cn(
          "interactive-explanation-trigger",
          "text-primary font-medium underline decoration-primary/50 decoration-2 underline-offset-2",
          "hover:decoration-primary cursor-help transition-all duration-200",
          "bg-primary/10 px-1 rounded-sm",
          className
        )}
        asChild
      >
        <span>{children}</span>
      </HoverCardPrimitive.Trigger>

      <HoverCardPrimitive.Content
        className="origin-(--radix-hover-card-content-transform-origin)"
        side="top"
        align="center"
        sideOffset={10}
      >
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.6 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
                transition: {
                  type: "spring",
                  stiffness: 260,
                  damping: 20,
                },
              }}
              exit={{ opacity: 0, y: 20, scale: 0.6 }}
              className="shadow-xl rounded-xl max-w-sm"
              style={{
                x: translateX,
              }}
            >
              <div className="bg-popover border border-border rounded-xl p-4 shadow-lg">
                <div className="text-sm text-popover-foreground leading-relaxed break-words hyphens-auto overflow-wrap-anywhere">
                  {explanation}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </HoverCardPrimitive.Content>
    </HoverCardPrimitive.Root>
  );
};