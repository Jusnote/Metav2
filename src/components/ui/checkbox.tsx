import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"

import { cn } from "../../lib/utils"

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      // Base: rounded-md, bg cinza claro com inner shadow sutil pra dar profundidade
      // (estilo macOS/Linear/Notion). Border quase invisível só pra delimitar.
      "peer shrink-0 rounded-md border border-zinc-200/80 dark:border-zinc-700",
      "bg-zinc-100 dark:bg-zinc-800",
      "shadow-[inset_0_1px_2px_0_rgb(0_0_0_/_0.05)]",
      "hover:bg-zinc-200/70 dark:hover:bg-zinc-700/80",
      "ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "disabled:cursor-not-allowed disabled:opacity-50",
      // Estado checked: cor primária, sem inner shadow (achata visualmente o "preenchido")
      "data-[state=checked]:bg-primary data-[state=checked]:border-primary",
      "data-[state=checked]:shadow-none data-[state=checked]:text-primary-foreground",
      "data-[state=checked]:animate-check-bounce",
      "transition-colors duration-150",
      "h-4 w-4",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn("flex items-center justify-center text-current animate-check-draw")}
    >
      <Check className="h-3 w-3" strokeWidth={3} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
