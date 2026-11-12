import { buildQuery, request, type AcademicPeriod, type Career, type Cycle, type Modality, type PaginatedResourceCollection, type PaginationMeta, type Section } from '@/lib/api'

export type { Cycle }

const ROOT = '/api/v1/tutoring-coordination'
type Collection<T> = { readonly data: readonly T[] }
type Resource<T> = { readonly data: T }
export type TutoringListParams = { page?: number; search?: string; career_id?: number; cycle_id?: number; cycle_number?: number; status?: 'active' | 'inactive'; per_page?: number; period_id?: number }

/** Período que muestra la lista de tutorías (el vigente si no se pidió otro); `null` sin período vigente. */
export type ListedPeriod = { readonly id: number; readonly name: string; readonly is_active: boolean }
export interface TutoringListMeta extends PaginationMeta {
  readonly period?: ListedPeriod | null
}

export interface CoordinatorEnrollment {
  readonly id: number
  readonly tutoring_id: number
  readonly student_id: number
  readonly identification: string | null
  readonly name: string
  readonly email: string
  readonly phone: string | null
  readonly is_active: boolean
  readonly student_is_active: boolean
  readonly can_edit_profile: boolean
  readonly enrolled_at: string
}
export type CoordinatorAvailableStudent = { readonly id: number; readonly identification: string; readonly name: string; readonly email: string }

export interface Subject {
  readonly id: number
  readonly career_id: number
  readonly career_name: string
  readonly code: string | null
  readonly name: string
  readonly modality_id?: number | null
  readonly modality_name?: string | null
  readonly period_id?: number | null
  readonly period_name?: string | null
  readonly is_active: boolean
  /** Ciclo de la malla (solo el número); los paralelos se eligen al crear cada tutoría del período. */
  readonly cycle_number: number | null
  /** Derivado por el backend; no se usa para ubicar la asignatura. */
  readonly cycle_ids?: readonly number[]
  /** Secuencia de la malla: asignaturas que continúan a esta y las que hay que aprobar antes. */
  readonly next_subjects?: readonly SubjectReference[]
  readonly previous_subjects?: readonly SubjectReference[]
}

export interface SubjectReference {
  readonly id: number
  readonly code: string | null
  readonly name: string
}

export interface Teacher {
  readonly id: number
  readonly identification: string | null
  readonly name: string
  readonly email: string
  readonly phone: string | null
  readonly is_active: boolean
  readonly career_ids: readonly number[]
  readonly can_manage: boolean
  /** Ya entró y confirmó sus datos: el coordinador no puede cambiarle la cédula ni el correo. */
  readonly profile_completed?: boolean
  /** Tutorías vigentes que dicta, en las carreras de quien consulta. */
  readonly tutorings?: readonly { readonly id: number; readonly subject_name: string; readonly cycle_name: string | null; readonly cycle_number: number | null; readonly section_name: string | null }[]
}

/** Franja ocupada por una tutoría activa del docente en el período vigente. */
export interface BusySchedule {
  readonly tutoring_id: number
  readonly tutoring_name: string
  readonly day: string
  readonly start_time: string
  readonly end_time: string
}

export type AvailableTeacher = Pick<Teacher, 'id' | 'name' | 'email' | 'is_active'> & {
  readonly busy_schedules?: readonly BusySchedule[]
}

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
  readonly subject_is_active?: boolean | null
  readonly is_active: boolean
  readonly schedules?: readonly TutoringSchedule[]
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
  readonly summary?: unknown
  readonly tutoring_id?: number
  readonly subject_name?: string
  readonly career_name?: string
  readonly cycle_name?: string
  readonly section_name?: string
}
export interface TutoringReportMeta extends PaginationMeta {
  readonly enrollment_count: number
  readonly present_count: number
  readonly absent_count: number
}
export type SubjectInput = {
  career_id: number
  code?: string | null
  name: string
  cycle_number?: number | null
  modality_id?: number
  /** Asignaturas que continúan a esta en la malla. */
  next_subject_ids?: readonly number[]
}
export type TeacherInput = { career_id: number; identification: string; name: string; email: string; phone: string }
export type TutoringInput = {
  subject_id: number
  /**
   * Fila de ciclo con paralelo de la carrera, del número de ciclo de la asignatura; o, con
   * `parallel_id`, la fila base de ese número (el servidor crea la fila del paralelo).
   */
  cycle_id: number
  /** Paralelo del catálogo que aún no tiene fila de ciclo en ese número de ciclo. */
  parallel_id?: number
  period_id?: number
  modality_id?: number
  teacher_id?: number
  schedules: readonly TutoringScheduleItem[]
}
/** Horario semanal de una tutoría (uno por día); el aula es opcional. */
export type TutoringScheduleItem = { day: string; start_time: string; end_time: string; room?: string }
export type TutoringConfigurationInput = { teacher_id: number; cycle_id?: number; schedules: readonly TutoringScheduleItem[] }

async function collection<T>(path: string): Promise<readonly T[]> {
  return (await request<Collection<T>>(`${ROOT}/${path}`)).data
}
async function mutate<T>(path: string, method: string, input?: unknown): Promise<T> {
  return (await request<Resource<T>>(`${ROOT}/${path}`, { method, ...(input === undefined ? {} : { body: JSON.stringify(input) }) })).data
}
function list<T>(path: string, params: TutoringListParams = {}) {
  return request<PaginatedResourceCollection<T>>(`${ROOT}/${path}${buildQuery(params)}`)
}

/** Qué pasa con cada estudiante del listado PDF: se crea, se inscribe, ya estaba, no puede o falló. */
export type RosterStudentStatus = 'new' | 'enroll' | 'enrolled' | 'blocked' | 'error'

export interface RosterImportStudent {
  readonly number: number
  readonly name: string
  readonly email: string
  readonly phone: string | null
  readonly status: RosterStudentStatus
  readonly message: string | null
}

/** Vista previa o resultado de cargar el listado PDF de una asignatura. */
export interface RosterImport {
  readonly applied: boolean
  readonly career_name: string | null
  readonly subject_name: string
  readonly section_name: string
  readonly teacher_name: string | null
  readonly subject: SubjectReference | null
  readonly cycle_number: number | null
  readonly period_name: string | null
  readonly teacher: { readonly id: number; readonly name: string; readonly assign: boolean } | null
  readonly tutoring: { readonly id: number | null; readonly exists: boolean } | null
  readonly errors: readonly string[]
  readonly notes: readonly string[]
  readonly students: readonly RosterImportStudent[]
}

/** Una sesión de la tutoría vista por el coordinador. */
export interface SupervisionSession {
  readonly id: number
  readonly number: number
  readonly date: string
  readonly topics_covered: boolean
  readonly topics: readonly { readonly id: number; readonly name: string }[]
  readonly present_count: number
  readonly absent_count: number
  readonly attendance: readonly { readonly id: number; readonly student_id: number; readonly student_name: string; readonly student_identification: string; readonly present: boolean }[]
}

/** Etapa calificada de una tutoría (los mismos nombres que usa el docente). */
export type TutoringGradeStage = 'diagnostic' | 'partial' | 'partial_two'
export type TutoringFinalResult = 'approved' | 'failed'

/** Notas de un estudiante inscrito, de solo consulta para el coordinador. */
export interface TutoringStudentGrades {
  readonly enrollment_id: number
  readonly student_id: number
  readonly identification: string | null
  readonly name: string
  /** Una entrada por etapa, en orden; `value` es la nota con dos decimales o `null`. */
  readonly grades: readonly { readonly stage: TutoringGradeStage; readonly label: string; readonly value: string | null }[]
  readonly final_result: TutoringFinalResult | null
  readonly suggested_result: TutoringFinalResult | null
}

/** Asignatura de la malla leída del archivo o corregida en la vista previa. */
export interface CurriculumSubjectRow {
  readonly code: string | null
  readonly name: string
  readonly cycle: number | null
  readonly previous: readonly string[]
  readonly errors?: readonly string[]
}
export type CurriculumInput = { career_id: number; subjects: readonly CurriculumSubjectRow[] }

export const tutoringApi = {
  /** Lee el archivo de la malla (Excel, CSV o PDF) para revisarla antes de importarla. */
  previewCurriculum: async (careerId: number, file: File): Promise<readonly CurriculumSubjectRow[]> => {
    const body = new FormData()
    body.append('file', file)
    body.append('career_id', String(careerId))
    return (await request<Resource<{ subjects: readonly CurriculumSubjectRow[] }>>(`${ROOT}/curricula/preview`, { method: 'POST', body })).data.subjects
  },
  /** Crea en la carrera las asignaturas de la malla revisada, con sus ciclos y previas. */
  importCurriculum: (input: CurriculumInput) => request<{ created: number }>(`${ROOT}/curricula`, { method: 'POST', body: JSON.stringify(input) }),
  /** Lee el listado PDF; con `confirm` crea la tutoría, las cuentas y las inscripciones. */
  importRoster: async (careerId: number, file: File, confirm: boolean): Promise<RosterImport> => {
    const body = new FormData()
    body.append('file', file)
    body.append('career_id', String(careerId))
    body.append('confirm', confirm ? '1' : '0')
    return (await request<Resource<RosterImport>>(`${ROOT}/roster-imports`, { method: 'POST', body })).data
  },
  careers: () => collection<Career>('careers'),
  cycles: () => collection<Cycle>('cycles'),
  periods: () => collection<AcademicPeriod>('periods'),
  modalities: () => collection<Modality>('modalities'),
  sections: () => collection<Section>('sections'),
  createSection: (name: string) => mutate<Section>('sections', 'POST', { name, nombre: name }),
  subjects: (params?: TutoringListParams) => list<Subject>('subjects', params),
  createSubject: (input: SubjectInput) => mutate<Subject>('subjects', 'POST', input),
  updateSubject: (id: number, input: Omit<SubjectInput, 'career_id' | 'cycle_number'>) => mutate<Subject>(`subjects/${id}`, 'PATCH', input),
  deactivateSubject: (id: number) => mutate<Subject>(`subjects/${id}/deactivate`, 'PATCH'),
  teachers: (params?: TutoringListParams) => list<Teacher>('teachers', params),
  availableTeachers: (search = '', excludeCareerId?: number, careerId?: number) => collection<AvailableTeacher>(`available-teachers${buildQuery({ search, exclude_career_id: excludeCareerId, career_id: careerId })}`),
  linkTeacherToCareer: (teacherId: number, careerId: number) => mutate<Teacher>(`teachers/${teacherId}/careers`, 'POST', { career_id: careerId }),
  unlinkTeacherFromCareer: (teacherId: number, careerId: number) => mutate<Teacher>(`teachers/${teacherId}/careers/${careerId}`, 'DELETE'),
  createTeacher: (input: TeacherInput) => mutate<Teacher>('teachers', 'POST', input),
  updateTeacher: (id: number, input: Omit<TeacherInput, 'career_id'>) => mutate<Teacher>(`teachers/${id}`, 'PATCH', input),
  tutorings: (params?: TutoringListParams) => request<PaginatedResourceCollection<Tutoring, TutoringListMeta>>(`${ROOT}/tutorings${buildQuery(params ?? {})}`),
  createTutoring: (input: TutoringInput) => mutate<Tutoring>('tutorings', 'POST', input),
  updateTutoring: (id: number, input: Pick<TutoringInput, 'period_id' | 'modality_id'>) => mutate<Tutoring>(`tutorings/${id}`, 'PATCH', input),
  configureTutoring: (id: number, input: TutoringConfigurationInput) => mutate<Tutoring>(`tutorings/${id}/configuration`, 'PUT', input),
  activateTutoring: (id: number) => mutate<Tutoring>(`tutorings/${id}/activate`, 'PATCH'),
  /** Solo si la tutoría nunca tuvo estudiantes ni registros; si no, el backend responde 422. */
  deleteTutoring: (id: number) => request<void>(`${ROOT}/tutorings/${id}`, { method: 'DELETE' }),
  assignTutoringCycle: (id: number, cycleId: number) => mutate<Tutoring>(`tutorings/${id}/cycle`, 'PUT', { cycle_id: cycleId }),
  assignTeacher: (id: number, teacherId: number) => mutate<Tutoring>(`tutorings/${id}/teacher`, 'PUT', { teacher_id: teacherId }),
  schedules: (id: number) => collection<TutoringSchedule>(`tutorings/${id}/schedules`),
  createSchedule: (id: number, input: ScheduleInput) => mutate<TutoringSchedule>(`tutorings/${id}/schedules`, 'POST', input),
  updateSchedule: (id: number, scheduleId: number, input: ScheduleInput) => mutate<TutoringSchedule>(`tutorings/${id}/schedules/${scheduleId}`, 'PATCH', input),
  deactivateSchedule: (id: number, scheduleId: number) => mutate<TutoringSchedule>(`tutorings/${id}/schedules/${scheduleId}/deactivate`, 'PATCH'),
  attendance: (id: number, page: number) => list<Attendance>(`tutorings/${id}/attendance`, { page }),
  /** Sesiones de la tutoría, de la más reciente a la primera, cada una con su lista. */
  sessions: (id: number, page: number) => list<SupervisionSession>(`tutorings/${id}/sessions`, { page }),
  tutoringGrades: (id: number) => collection<TutoringStudentGrades>(`tutorings/${id}/grades`),
  reports: (id: number, page: number) => request<PaginatedResourceCollection<TutoringReport, TutoringReportMeta>>(`${ROOT}/tutorings/${id}/reports${buildQuery({ page })}`),
  allReports: (params?: { page?: number; search?: string; career_id?: number; cycle_id?: number; cycle_number?: number; tutoring_id?: number }) =>
    request<PaginatedResourceCollection<TutoringReport, TutoringReportMeta>>(`${ROOT}/reports${buildQuery(params ?? {})}`),
  students: (id: number, params?: { page?: number; search?: string; status?: string }) =>
    request<PaginatedResourceCollection<CoordinatorEnrollment>>(`${ROOT}/tutorings/${id}/students${buildQuery(params ?? {})}`),
  availableStudents: (id: number, search?: string) =>
    request<{ data: readonly CoordinatorAvailableStudent[] }>(`${ROOT}/tutorings/${id}/available-students${buildQuery({ search: search ?? '' })}`),
  enrollStudent: (id: number, input: { student_id?: number; identification?: string; name?: string; email?: string; phone?: string | null }) =>
    mutate<CoordinatorEnrollment>(`tutorings/${id}/students`, 'POST', input),
  updateStudent: (id: number, enrollmentId: number, input: { name: string; phone: string | null }) =>
    mutate<CoordinatorEnrollment>(`tutorings/${id}/students/${enrollmentId}`, 'PATCH', input),
  deactivateStudent: (id: number, enrollmentId: number) =>
    mutate<CoordinatorEnrollment>(`tutorings/${id}/students/${enrollmentId}/deactivate`, 'PATCH'),
  reenrollStudent: (id: number, enrollmentId: number) =>
    mutate<CoordinatorEnrollment>(`tutorings/${id}/students/${enrollmentId}/reenroll`, 'PATCH'),

  allStudents: (params?: { page?: number; search?: string; career_id?: number; cycle_number?: number; without_cycle?: boolean; tutoring_status?: 'with' | 'without' }) => {
    const { without_cycle: withoutCycle, ...rest } = params ?? {}
    return request<PaginatedResourceCollection<CoordinatorStudent>>(`${ROOT}/students${buildQuery({ ...rest, without_cycle: withoutCycle ? 1 : undefined })}`)
  },
  updateStudentCycle: (studentId: number, cycleId: number) =>
    request<{ data: CoordinatorStudent }>(`${ROOT}/students/${studentId}/cycle`, { method: 'PATCH', body: JSON.stringify({ cycle_id: cycleId }) }),
  createCoordinatorStudent: (input: { identification: string; name: string; email: string; phone?: string | null; cycle_id: number; tutoring_id?: number; career_id?: number }) =>
    request<{ data: CoordinatorStudent }>(`${ROOT}/students`, { method: 'POST', body: JSON.stringify(input) }),
  availableTutoringsForStudent: (studentId: number, search?: string) =>
    request<{ data: readonly Tutoring[] }>(`${ROOT}/students/${studentId}/available-tutorings${buildQuery({ search: search ?? '' })}`),
  enrollStudentInTutoring: (studentId: number, tutoringId: number) =>
    request<{ data: CoordinatorEnrollment }>(`${ROOT}/students/${studentId}/enroll`, { method: 'POST', body: JSON.stringify({ tutoring_id: tutoringId }) }),
  unenrollStudentFromTutoring: (studentId: number, enrollmentId: number) =>
    request<{ data: CoordinatorEnrollment }>(`${ROOT}/students/${studentId}/enrollments/${enrollmentId}`, { method: 'DELETE' }),
  degreeStudents: (params?: { page?: number; search?: string; career_id?: number; cycle_number?: number; enrolled?: boolean }) =>
    request<PaginatedResourceCollection<DegreeStudent, DegreePaginationMeta>>(
      `${ROOT}/degree-students${buildQuery({
        page: params?.page,
        search: params?.search,
        career_id: params?.career_id,
        cycle_number: params?.cycle_number,
        enrolled: params?.enrolled !== undefined ? (params.enrolled ? 1 : 0) : undefined,
      })}`,
    ),
  enrollDegreeStudent: (studentId: number) =>
    request<{ data: DegreeStudent; message: string }>(`${ROOT}/degree-students/${studentId}/enroll`, { method: 'POST' }),
  unenrollDegreeStudent: (studentId: number) =>
    request<{ data: DegreeStudent; message: string }>(`${ROOT}/degree-students/${studentId}/unenroll`, { method: 'DELETE' }),
  studentDegreeEnrollmentStatus: () =>
    request<StudentDegreeEnrollmentStatus>('/api/v1/student/degree-enrollment-status'),
}

export interface DegreePaginationMeta extends PaginationMeta {
  readonly current_period?: {
    readonly id: number
    readonly name: string
  } | null
}

/** Ciclo que tuvo el estudiante en un período (lo registra el sistema con sus tutorías). */
export interface StudentCycleHistory {
  readonly period_id: number
  readonly period_name: string
  readonly cycle_number: number
  readonly cycle_name: string
}

export interface DegreeStudent {
  readonly id: number
  readonly student_id: number
  readonly identification: string | null
  readonly name: string
  readonly email: string
  readonly phone: string | null
  /** Ciclo que cursa; el último ciclo de la carrera es titulación. */
  readonly cycle_id?: number | null
  readonly cycle_number?: number | null
  readonly cycle_name?: string | null
  readonly section_name?: string | null
  readonly academic_stage?: 'tutorias' | 'titulacion' | null
  readonly is_degree_enrolled: boolean
  readonly degree_enrollment_id: number | null
  readonly enrolled_at: string | null
  readonly period_id: number | null
  readonly period_name: string | null
  /** Ciclo por período, del más reciente al más antiguo. */
  readonly cycle_history?: readonly StudentCycleHistory[]
}

export interface StudentDegreeEnrollmentStatus {
  readonly is_enrolled: boolean
  readonly period_id: number | null
  readonly period_name: string | null
}

export interface CoordinatorStudentTutoring {
  readonly enrollment_id: number
  readonly tutoring_id: number
  readonly subject_name: string
  readonly cycle_name: string
  readonly section_name?: string | null
  readonly period_name: string
  readonly is_active: boolean
}

export interface CoordinatorStudent {
  readonly id: number
  readonly identification: string | null
  readonly name: string
  readonly email: string
  readonly phone?: string | null
  readonly is_active: boolean
  /** Ciclo que cursa; el último ciclo de la carrera es titulación. */
  readonly cycle_id?: number | null
  readonly cycle_number?: number | null
  readonly cycle_name?: string | null
  readonly section_name?: string | null
  readonly academic_stage?: 'tutorias' | 'titulacion' | null
  /** Asignaturas que arrastra: no se le inscribe en las que las continúan hasta aprobarlas. */
  readonly pending_subjects?: readonly SubjectReference[]
  readonly tutoring_count: number
  readonly tutorings: readonly CoordinatorStudentTutoring[]
  /** Ciclo por período, del más reciente al más antiguo. */
  readonly cycle_history?: readonly StudentCycleHistory[]
}


