import { buildQuery, request, type AcademicPeriod, type Career, type Cycle, type Modality, type PaginatedResourceCollection, type PaginationMeta } from '@/lib/api'

const ROOT = '/api/v1/tutoring-coordination'
type Collection<T> = { readonly data: readonly T[] }
type Resource<T> = { readonly data: T }
export type TutoringListParams = { page?: number; search?: string; career_id?: number; cycle_id?: number; status?: 'active' | 'inactive'; per_page?: number }

export interface Subject {
  readonly id: number
  readonly career_id: number
  readonly career_name: string
  readonly code: string
  readonly name: string
  readonly is_active: boolean
  readonly cycle_ids: readonly number[]
}

export interface Teacher {
  readonly id: number
  readonly identification: string
  readonly name: string
  readonly email: string
  readonly phone: string | null
  readonly is_active: boolean
  readonly career_ids: readonly number[]
  readonly can_manage: boolean
}

export type AvailableTeacher = Pick<Teacher, 'id' | 'name' | 'email' | 'is_active'>

export interface Tutoring {
  readonly id: number
  readonly subject_id: number | null
  readonly subject_name: string
  readonly cycle_id: number
  readonly cycle_name: string
  readonly career_id: number
  readonly period_id: number
  readonly period_name: string
  readonly modality_id: number
  readonly modality_name: string
  readonly section_id: number | null
  readonly section_name: string | null
  readonly teacher_id: number | null
  readonly teacher_name: string | null
  readonly teacher_is_active: boolean | null
  readonly is_active: boolean
}

export const WEEK_DAYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const
export const DAY_LABELS: Record<string, string> = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo' }
export type ScheduleInput = { day: string; start_time: string; end_time: string; room: string }
export interface TutoringSchedule extends ScheduleInput {
  readonly id: number
  readonly tutoring_id: number
  readonly is_active: boolean
}
export interface Attendance {
  readonly id: number
  readonly enrollment_id: number
  readonly student_id: number
  readonly student_name: string
  readonly date: string
  readonly present: boolean
}
export interface TutoringReport {
  readonly id: number
  readonly type: string
  readonly author_id: number
  readonly author_name: string
  readonly generated_at: string
  readonly content: string | null
}
export interface TutoringReportMeta extends PaginationMeta {
  readonly enrollment_count: number
  readonly present_count: number
  readonly absent_count: number
}
export type SubjectInput = { career_id: number; code: string; name: string; cycle_id?: number }
export type TeacherInput = { career_id: number; identification: string; name: string; email: string; phone: string }
export type TutoringInput = { subject_id: number; cycle_id: number; period_id: number; modality_id: number }

async function collection<T>(path: string): Promise<readonly T[]> {
  return (await request<Collection<T>>(`${ROOT}/${path}`)).data
}
async function mutate<T>(path: string, method: string, input?: unknown): Promise<T> {
  return (await request<Resource<T>>(`${ROOT}/${path}`, { method, ...(input === undefined ? {} : { body: JSON.stringify(input) }) })).data
}
function list<T>(path: string, params: TutoringListParams = {}) {
  return request<PaginatedResourceCollection<T>>(`${ROOT}/${path}${buildQuery(params)}`)
}

export const tutoringApi = {
  careers: () => collection<Career>('careers'),
  cycles: () => collection<Cycle>('cycles'),
  periods: () => collection<AcademicPeriod>('periods'),
  modalities: () => collection<Modality>('modalities'),
  subjects: (params?: TutoringListParams) => list<Subject>('subjects', params),
  createSubject: (input: SubjectInput) => mutate<Subject>('subjects', 'POST', input),
  updateSubject: (id: number, input: Omit<SubjectInput, 'career_id' | 'cycle_id'>) => mutate<Subject>(`subjects/${id}`, 'PATCH', input),
  deactivateSubject: (id: number) => mutate<Subject>(`subjects/${id}/deactivate`, 'PATCH'),
  assignSubjectCycle: (id: number, cycleId: number) => mutate<Subject>(`subjects/${id}/cycles/${cycleId}`, 'PUT'),
  unassignSubjectCycle: (id: number, cycleId: number) => mutate<Subject>(`subjects/${id}/cycles/${cycleId}`, 'DELETE'),
  teachers: (params?: TutoringListParams) => list<Teacher>('teachers', params),
  availableTeachers: (search = '', excludeCareerId?: number) => collection<AvailableTeacher>(`available-teachers${buildQuery({ search, exclude_career_id: excludeCareerId })}`),
  linkTeacherToCareer: (teacherId: number, careerId: number) => mutate<Teacher>(`teachers/${teacherId}/careers`, 'POST', { career_id: careerId }),
  unlinkTeacherFromCareer: (teacherId: number, careerId: number) => mutate<Teacher>(`teachers/${teacherId}/careers/${careerId}`, 'DELETE'),
  createTeacher: (input: TeacherInput) => mutate<Teacher>('teachers', 'POST', input),
  updateTeacher: (id: number, input: Omit<TeacherInput, 'career_id'>) => mutate<Teacher>(`teachers/${id}`, 'PATCH', input),
  deactivateTeacher: (id: number) => mutate<Teacher>(`teachers/${id}/deactivate`, 'PATCH'),
  tutorings: (params?: TutoringListParams) => list<Tutoring>('tutorings', params),
  createTutoring: (input: TutoringInput) => mutate<Tutoring>('tutorings', 'POST', input),
  updateTutoring: (id: number, input: Pick<TutoringInput, 'period_id' | 'modality_id'>) => mutate<Tutoring>(`tutorings/${id}`, 'PATCH', input),
  deactivateTutoring: (id: number) => mutate<Tutoring>(`tutorings/${id}/deactivate`, 'PATCH'),
  activateTutoring: (id: number) => mutate<Tutoring>(`tutorings/${id}/activate`, 'PATCH'),
  assignTutoringCycle: (id: number, cycleId: number) => mutate<Tutoring>(`tutorings/${id}/cycle`, 'PUT', { cycle_id: cycleId }),
  assignTeacher: (id: number, teacherId: number) => mutate<Tutoring>(`tutorings/${id}/teacher`, 'PUT', { teacher_id: teacherId }),
  schedules: (id: number) => collection<TutoringSchedule>(`tutorings/${id}/schedules`),
  createSchedule: (id: number, input: ScheduleInput) => mutate<TutoringSchedule>(`tutorings/${id}/schedules`, 'POST', input),
  updateSchedule: (id: number, scheduleId: number, input: ScheduleInput) => mutate<TutoringSchedule>(`tutorings/${id}/schedules/${scheduleId}`, 'PATCH', input),
  deactivateSchedule: (id: number, scheduleId: number) => mutate<TutoringSchedule>(`tutorings/${id}/schedules/${scheduleId}/deactivate`, 'PATCH'),
  attendance: (id: number, page: number) => list<Attendance>(`tutorings/${id}/attendance`, { page }),
  reports: (id: number, page: number) => request<PaginatedResourceCollection<TutoringReport, TutoringReportMeta>>(`${ROOT}/tutorings/${id}/reports${buildQuery({ page })}`),
}
