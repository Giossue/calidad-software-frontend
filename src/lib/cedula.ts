const CHECK_DIGIT_COEFFICIENTS = [2, 1, 2, 1, 2, 1, 2, 1, 2]

/** Verifica el dígito de control de una cédula ecuatoriana (algoritmo módulo 10). */
export function isValidEcuadorianCedula(value: string): boolean {
  if (!/^\d{10}$/.test(value)) return false

  const province = Number(value.slice(0, 2))
  if (province < 1 || (province > 24 && province !== 30)) return false

  if (Number(value[2]) > 6) return false

  let sum = 0
  for (let i = 0; i < CHECK_DIGIT_COEFFICIENTS.length; i++) {
    const digit = Number(value[i]) * CHECK_DIGIT_COEFFICIENTS[i]
    sum += digit >= 10 ? digit - 9 : digit
  }

  const checkDigit = (10 - (sum % 10)) % 10
  return checkDigit === Number(value[9])
}
