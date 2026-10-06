import * as React from "react"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-md border border-input bg-transparent max-md:bg-white max-md:dark:bg-input/30 px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        type === "search" && "bg-white dark:bg-card",
        (type === "date" || type === "time" || type === "datetime-local") &&
          "block min-w-0 max-w-full appearance-none text-left [&::-webkit-date-and-time-value]:min-w-0 [&::-webkit-date-and-time-value]:text-left",
        className
      )}
      {...props}
    />
  )
}

export { Input }
