import { CheckCircle2Icon, CircleIcon } from "lucide-react"

import {
  getPasswordStrength,
  getUnmetPasswordRequirements,
  PASSWORD_REQUIREMENTS,
  type PasswordStrength as Strength,
} from "@/lib/password-rules"
import { cn } from "@/lib/utils"

const STRENGTH_STYLES: Record<Strength, { label: string; bar: string; text: string }> = {
  empty: { label: "", bar: "", text: "" },
  weak: { label: "Débil", bar: "bg-red-500", text: "text-red-600 dark:text-red-400" },
  medium: { label: "Media", bar: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  strong: { label: "Fuerte", bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
}

interface PasswordStrengthProps {
  readonly password: string
  readonly id?: string
  readonly className?: string
}

/** Barra de fortaleza y lista de requisitos pendientes; cada requisito desaparece al cumplirse. */
function PasswordStrength({ password, id, className }: PasswordStrengthProps) {
  const strength = getPasswordStrength(password)
  const pending = getUnmetPasswordRequirements(password)
  const metCount = PASSWORD_REQUIREMENTS.length - pending.length
  const style = STRENGTH_STYLES[strength]

  return (
    <div id={id} data-slot="password-strength" className={cn("flex flex-col gap-2", className)}>
      <div className="flex gap-1.5" aria-hidden="true">
        {PASSWORD_REQUIREMENTS.map((requirement, index) => (
          <span
            key={requirement.id}
            className={cn(
              "h-1 flex-1 rounded-full bg-slate-200 transition-colors duration-300 dark:bg-accent",
              strength !== "empty" && index < metCount && style.bar,
            )}
          />
        ))}
      </div>

      <div aria-live="polite" className="flex flex-col gap-1 text-xs">
        {strength !== "empty" && (
          <p className={cn("font-medium", style.text)}>
            Seguridad: {style.label}
          </p>
        )}
        {pending.length > 0 ? (
          <ul aria-label="Requisitos pendientes de la contraseña" className="flex flex-col gap-0.5 text-muted-foreground">
            {pending.map((requirement) => (
              <li key={requirement.id} className="flex items-center gap-1.5 animate-in fade-in">
                <CircleIcon className="size-3 shrink-0" aria-hidden="true" />
                {requirement.label}
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2Icon className="size-3.5 shrink-0" aria-hidden="true" />
            La contraseña cumple todos los requisitos.
          </p>
        )}
      </div>
    </div>
  )
}

export { PasswordStrength }
