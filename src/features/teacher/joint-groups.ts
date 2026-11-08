import type { JointTutoring, TeacherTutoring } from '@/lib/teacher-api'

/** Grupo de una clase: la tutoría propia o una conjunta (misma asignatura, misma hora). */
export type ClassGroup = Readonly<{ id: number; label: string; canManage: boolean }>

export function ownGroup(tutoring: TeacherTutoring): ClassGroup {
  return { id: tutoring.id, label: groupLabel(tutoring.career_name, tutoring.section_name), canManage: tutoring.can_manage }
}

export function jointGroup(joint: JointTutoring): ClassGroup {
  return { id: joint.id, label: groupLabel(joint.career_name, joint.section_name), canManage: joint.can_manage }
}

function groupLabel(career: string | null, section: string | null): string {
  return [career, section ? `paralelo ${section}` : null].filter(Boolean).join(' · ') || 'Grupo'
}
