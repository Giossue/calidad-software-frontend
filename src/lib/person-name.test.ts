import { describe, expect, it } from 'vitest'

import { countNames, firstNamesError, lastNamesError, splitStoredName } from './person-name'

describe('person-name', () => {
  it('cuenta los nombres sin contar las partículas por separado', () => {
    expect(countNames('Ana')).toBe(1)
    expect(countNames('  Ana   María ')).toBe(2)
    expect(countNames('María de los Ángeles')).toBe(2)
    expect(countNames('De la Torre Vera')).toBe(2)
    expect(countNames('')).toBe(0)
  })

  it('acepta uno o dos nombres', () => {
    expect(firstNamesError('Ana')).toBeNull()
    expect(firstNamesError('Ana María')).toBeNull()
    expect(firstNamesError('Juan Carlos Andrés')).toBe('Ingresa uno o dos nombres.')
  })

  it('acepta dos apellidos, o uno solo como excepción', () => {
    expect(lastNamesError('Torres Vera')).toBeNull()
    expect(lastNamesError('Smith')).toBeNull()
    expect(lastNamesError('Mora Vera Paz')).toBe('Ingresa tus dos apellidos, o uno solo si tu registro civil tiene un único apellido.')
  })

  it('separa el nombre guardado (apellidos y nombres) cuando tiene al menos tres partes', () => {
    expect(splitStoredName('Torres Vera Ana María')).toEqual({ lastNames: 'Torres Vera', firstNames: 'Ana María' })
    expect(splitStoredName('De la Torre Vera María de los Ángeles')).toEqual({ lastNames: 'De la Torre Vera', firstNames: 'María de los Ángeles' })
    // Con dos partes no se puede saber cuál es el nombre: el usuario los escribe.
    expect(splitStoredName('Ana Torres')).toEqual({ lastNames: '', firstNames: '' })
    expect(splitStoredName(undefined)).toEqual({ lastNames: '', firstNames: '' })
  })
})
