import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { firstNamesError, lastNamesError, NAME_PART_MAX_LENGTH } from '@/lib/person-name'
import { sanitizeLetters } from '@/lib/sanitize'

export const FIRST_NAMES_TIP = 'Uno o dos nombres.'
export const LAST_NAMES_TIP = 'Dos apellidos; uno solo si el registro civil tiene un único apellido (p. ej., hijos de padres extranjeros o inscritos en el exterior).'

/**
 * Campos "Nombres" y "Apellidos", en ese orden, con las reglas de `person-name`
 * (uno o dos nombres; dos apellidos o, como excepción, uno). Se devuelven como
 * fragmento para que cada formulario los acomode en su propia grilla.
 *
 * `errors` permite mostrar errores propios del formulario (campo tocado, error del
 * servidor); si no se pasan, se muestra el de la cantidad de nombres o apellidos.
 */
export function PersonNameFields({
  idPrefix,
  firstNames,
  lastNames,
  onFirstNamesChange,
  onLastNamesChange,
  onBlur,
  errors,
  required = false,
  disabled = false,
}: Readonly<{
  idPrefix: string
  firstNames: string
  lastNames: string
  onFirstNamesChange: (value: string) => void
  onLastNamesChange: (value: string) => void
  onBlur?: (field: 'first_names' | 'last_names') => void
  errors?: { first_names?: string | null; last_names?: string | null }
  required?: boolean
  disabled?: boolean
}>) {
  const firstId = `${idPrefix}-first-names`
  const lastId = `${idPrefix}-last-names`

  return (
    <>
      <FormField id={firstId} label="Nombres" required={required} tip={FIRST_NAMES_TIP} error={errors?.first_names ?? firstNamesError(firstNames)} counter={{ current: firstNames.length, max: NAME_PART_MAX_LENGTH }}>
        <Input
          id={firstId}
          name="first_names"
          value={firstNames}
          onChange={(event) => onFirstNamesChange(sanitizeLetters(event.target.value, NAME_PART_MAX_LENGTH))}
          onBlur={() => onBlur?.('first_names')}
          required={required}
          disabled={disabled}
          maxLength={NAME_PART_MAX_LENGTH}
          autoComplete="given-name"
          placeholder="Ej. Ana María"
        />
      </FormField>
      <FormField id={lastId} label="Apellidos" required={required} tip={LAST_NAMES_TIP} error={errors?.last_names ?? lastNamesError(lastNames)} counter={{ current: lastNames.length, max: NAME_PART_MAX_LENGTH }}>
        <Input
          id={lastId}
          name="last_names"
          value={lastNames}
          onChange={(event) => onLastNamesChange(sanitizeLetters(event.target.value, NAME_PART_MAX_LENGTH))}
          onBlur={() => onBlur?.('last_names')}
          required={required}
          disabled={disabled}
          maxLength={NAME_PART_MAX_LENGTH}
          autoComplete="family-name"
          placeholder="Ej. Torres Vera"
        />
      </FormField>
    </>
  )
}
