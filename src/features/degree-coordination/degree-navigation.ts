export type DegreeSection = 'degree-students' | 'degree-topics' | 'degree-tracking' | 'degree-reports'

export function canCoordinateDegrees(role?: string): boolean {
  return role === 'coordinador_titulacion'
}

export function isDegreeSection(section?: string): section is DegreeSection {
  return (
    section === 'degree-students' ||
    section === 'degree-topics' ||
    section === 'degree-tracking' ||
    section === 'degree-reports'
  )
}
