/** Dominios de correo institucional de la UEB; deben coincidir con el backend. */
export const institutionalEmailDomains = ['@ueb.edu.ec', '@mailes.ueb.edu.ec'] as const

export const institutionalEmailDomainsLabel = institutionalEmailDomains.join(' o ')

export function isInstitutionalEmail(email: string): boolean {
  return institutionalEmailDomains.some((domain) => email.endsWith(domain))
}
