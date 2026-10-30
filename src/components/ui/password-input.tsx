import * as React from "react"
import { EyeIcon, EyeOffIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type PasswordInputProps = Omit<React.ComponentProps<typeof Input>, "type">

function PasswordInput({ className, disabled, ...props }: PasswordInputProps) {
  const [visible, setVisible] = React.useState(false)

  return (
    <div className="relative flex w-full items-center">
      <Input
        type={visible ? "text" : "password"}
        disabled={disabled}
        className={cn("pr-10", className)}
        {...props}
      />
      <Button
        type="button"
        variant="tertiary"
        size="icon"
        tabIndex={-1}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setVisible((current) => !current)}
        disabled={disabled}
        className="absolute right-1 z-10 size-7 text-muted-foreground"
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={visible}
        title={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
      >
        {visible ? <EyeOffIcon className="text-primary" /> : <EyeIcon />}
      </Button>
    </div>
  )
}

export { PasswordInput }
