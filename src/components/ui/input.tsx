import * as React from "react"
import { cn } from "@/lib/utils"

// Textos libres: el navegador subraya las palabras mal escritas en español.
const SPELLCHECKED_TYPES = new Set([undefined, "text", "search"])

function Input({ className, type, spellCheck, lang, inputMode, ...props }: React.ComponentProps<"input">) {
  const checksSpelling = spellCheck ?? (SPELLCHECKED_TYPES.has(type) && inputMode !== "numeric" && inputMode !== "decimal" && inputMode !== "tel" && inputMode !== "email")
  return (
    <input
      type={type}
      inputMode={inputMode}
      spellCheck={checksSpelling}
      lang={lang ?? (checksSpelling ? "es" : undefined)}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-md border border-border bg-field px-3 py-1 text-base shadow-control transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/30",
        (type === "date" || type === "time" || type === "datetime-local") &&
          "block min-w-0 max-w-full appearance-none text-left [&::-webkit-date-and-time-value]:min-w-0 [&::-webkit-date-and-time-value]:text-left",
        className
      )}
      {...props}
    />
  )
}

export { Input }
