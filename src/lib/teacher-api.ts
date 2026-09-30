import { buildQuery, request, type PaginatedResourceCollection } from '@/lib/api'
import type { Attendance, Tutoring, TutoringReport, TutoringSchedule } from '@/lib/tutoring-api'

const ROOT = '/api/v1/teacher'
type Resource<T> = { readonly data: T }
type Collection<T> = { readonly data: readonly T[] }
export type TeacherListParams = { page?: number; per_page?: number; search?: string; status?: 'active' | 'inactive'; role?: 'tutor' | 'par_academico'; date?: string }

export interface TeacherTutoring extends Tutoring {
  readonly career_name: string
  readonly can_manage: boolean
  readonly active_enrollment_count: number
  readonly schedules: readonly TutoringSchedule[]
  readonly period_start_date: string
  readonly period_end_date: string
}
export type GradeType = 'diagnostic' | 'partial' | 'partial_two'
export type GradeEntry = { enrollment_id: number; diagnostic?: string; partial?: string; partial_two?: string }
export interface Enrollment {
  readonly id: number
  readonly tutoring_id: number
  readonly student_id: number
  readonly identification: string
  readonly name: string
  readonly email: string
  readonly phone: string | null
  readonly is_active: boolean
  readonly student_is_active: boolean
  readonly can_edit_profile: boolean
  readonly enrolled_at: string
  readonly diagnostic_grade: string | null
  readonly partial_grade: string | null
  readonly second_partial_grade: string | null
  readonly knowledge_group: string | null
  readonly knowledge_group_key: string | null
}
export type AvailableStudent = Pick<Enrollment, 'identification' | 'name' | 'email'> & { readonly id: number }
export type NewStudentInput = { identification: string; name: string; email: string; phone: string | null }
export interface Methodology {
  readonly id: number
  readonly activity_id: number
  readonly description: string
  readonly is_active: boolean
}
export interface Activity {
  readonly id: number
  readonly topic_id: number
  readonly name: string
  readonly duration: string
  readonly is_active: boolean
  readonly methodologies: readonly Methodology[]
}
export interface TutoringTopic {
  readonly id: number
  readonly tutoring_id: number
  readonly name: string
  readonly description: string | null
  readonly is_active: boolean
  readonly is_covered: boolean
  readonly activities: readonly Activity[]
}
export interface TutoringSession {
  readonly id: number
  readonly tutoring_id: number
  readonly date: string
  readonly topics_covered: boolean
  readonly topics: readonly Pick<TutoringTopic, 'id' | 'name' | 'is_active'>[]
  readonly attendance: readonly { id: number; enrollment_id: number; student_id: number; student_name: string; present: boolean }[]
}
export type SessionInput = { date: string; topics_covered: boolean; topic_ids: readonly number[]; attendance: readonly { enrollment_id: number; present: boolean }[] }
export interface TeacherAttendance extends Attendance { readonly topics_covered: boolean | null }
export interface GradeSettings {
  readonly minimum: number
  readonly maximum: number
  readonly groups: readonly { key: string; label: string; min: number; max: number }[]
}
export interface ReportSummary {
  readonly as_of: string
  readonly enrollment_count: number
  readonly active_enrollment_count: number
  readonly session_count: number
  readonly present_count: number
  readonly absent_count: number
  readonly topic_count: number
  readonly covered_topic_count: number
  readonly diagnostic_count: number
  readonly partial_count: number
  readonly knowledge_groups: Readonly<Record<string, number>>
}
export interface TeacherReport extends TutoringReport { readonly summary: ReportSummary | null }
export interface TeacherDegreeAssignment {
  readonly id: number
  readonly role: 'tutor' | 'par_academico'
  readonly assigned_at: string | null
  readonly topic: { id: number; title: string; description: string | null; status: string }
  readonly student: { id: number; name: string; email: string }
  readonly period: { id: number; name: string }
}

function list<T>(path: string, params: TeacherListParams = {}) {
  return request<PaginatedResourceCollection<T>>(`${ROOT}/${path}${buildQuery(params)}`)
}
async function mutate<T>(path: string, method: string, input?: unknown): Promise<T> {
  return (await request<Resource<T>>(`${ROOT}/${path}`, { method, ...(input === undefined ? {} : { body: JSON.stringify(input) }) })).data
}
async function collectPages<T>(loader: (page: number) => Promise<PaginatedResourceCollection<T>>): Promise<readonly T[]> {
  const rows: T[] = []
  let page = 1
  let lastPage = 1
  do {
    const response = await loader(page)
    rows.push(...response.data)
    lastPage = response.meta?.last_page ?? 1
    page += 1
  } while (page <= lastPage)
  return rows
}

export const teacherApi = {
  tutorings: (params?: TeacherListParams) => list<TeacherTutoring>('tutorings', params),
  allTutorings: () => collectPages((page) => list<TeacherTutoring>('tutorings', { page, per_page: 100 })),
  gradeSettings: async () => (await request<Resource<GradeSettings>>(`${ROOT}/grade-settings`)).data,
  students: (id: number, params?: TeacherListParams) => list<Enrollment>(`tutorings/${id}/students`, params),
  allStudents: (id: number) => collectPages((page) => list<Enrollment>(`tutorings/${id}/students`, { page, per_page: 100 })),
  availableStudents: async (id: number, search = '') => (await request<Collection<AvailableStudent>>(`${ROOT}/tutorings/${id}/available-students${buildQuery({ search })}`)).data,
  enrollStudent: (id: number, input: NewStudentInput | { student_id: number }) => mutate<Enrollment>(`tutorings/${id}/students`, 'POST', input),
  updateStudent: (id: number, enrollmentId: number, input: { name: string; phone: string | null }) => mutate<Enrollment>(`tutorings/${id}/students/${enrollmentId}`, 'PATCH', input),
  deactivateStudent: (id: number, enrollmentId: number) => mutate<Enrollment>(`tutorings/${id}/students/${enrollmentId}/deactivate`, 'PATCH'),
  saveGrades: async (id: number, grades: readonly GradeEntry[]) => (await request<Collection<Enrollment>>(`${ROOT}/tutorings/${id}/grades`, { method: 'PUT', body: JSON.stringify({ grades }) })).data,
  registerGrade: (id: number, enrollmentId: number, type: GradeType, value: string) => mutate<Enrollment>(`tutorings/${id}/students/${enrollmentId}/grades/${type}`, 'PUT', { value }),
  topics: (id: number, params?: TeacherListParams) => list<TutoringTopic>(`tutorings/${id}/topics`, params),
  allTopics: (id: number) => collectPages((page) => list<TutoringTopic>(`tutorings/${id}/topics`, { page, per_page: 100 })),
  createTopic: (id: number, input: { name: string; description: string }) => mutate<TutoringTopic>(`tutorings/${id}/topics`, 'POST', input),
  updateTopic: (id: number, topicId: number, input: { name: string; description: string }) => mutate<TutoringTopic>(`tutorings/${id}/topics/${topicId}`, 'PATCH', input),
  deactivateTopic: (id: number, topicId: number) => mutate<TutoringTopic>(`tutorings/${id}/topics/${topicId}/deactivate`, 'PATCH'),
  createActivity: (id: number, topicId: number, input: { name: string; duration: string }) => mutate<Activity>(`tutorings/${id}/topics/${topicId}/activities`, 'POST', input),
  updateActivity: (id: number, topicId: number, activityId: number, input: { name: string; duration: string }) => mutate<Activity>(`tutorings/${id}/topics/${topicId}/activities/${activityId}`, 'PATCH', input),
  deactivateActivity: (id: number, topicId: number, activityId: number) => mutate<Activity>(`tutorings/${id}/topics/${topicId}/activities/${activityId}/deactivate`, 'PATCH'),
  createMethodology: (id: number, topicId: number, activityId: number, input: { description: string }) => mutate<Methodology>(`tutorings/${id}/topics/${topicId}/activities/${activityId}/methodologies`, 'POST', input),
  updateMethodology: (id: number, topicId: number, activityId: number, methodologyId: number, input: { description: string }) => mutate<Methodology>(`tutorings/${id}/topics/${topicId}/activities/${activityId}/methodologies/${methodologyId}`, 'PATCH', input),
  deactivateMethodology: (id: number, topicId: number, activityId: number, methodologyId: number) => mutate<Methodology>(`tutorings/${id}/topics/${topicId}/activities/${activityId}/methodologies/${methodologyId}/deactivate`, 'PATCH'),
  sessions: (id: number, params?: TeacherListParams) => list<TutoringSession>(`tutorings/${id}/sessions`, params),
  attendance: (id: number, params?: TeacherListParams) => list<TeacherAttendance>(`tutorings/${id}/attendance`, params),
  allAttendance: (id: number, date: string) => collectPages((page) => list<TeacherAttendance>(`tutorings/${id}/attendance`, { page, date, per_page: 100 })),
  saveSession: (id: number, input: SessionInput) => mutate<TutoringSession>(`tutorings/${id}/sessions`, 'PUT', input),
  reports: (id: number, params?: TeacherListParams) => list<TeacherReport>(`tutorings/${id}/reports`, params),
  sendReport: (id: number, input: { title: string; observations: string }) => mutate<TeacherReport>(`tutorings/${id}/reports`, 'POST', input),
  degreeAssignments: (params?: TeacherListParams) => list<TeacherDegreeAssignment>('degree-assignments', params),
}
