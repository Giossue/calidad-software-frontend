import { buildQuery, request, type AcademicPeriod, type PaginatedResourceCollection, type PaginationMeta, type Section } from '@/lib/api'

const ROOT = '/api/v1/coordination'
type Resource<T> = { readonly data: T }
type Collection<T> = { readonly data: readonly T[] }

export interface DegreePaginationMeta extends PaginationMeta {
  readonly current_period?: {
    readonly id: number
    readonly name: string
  } | null
}

export interface DegreeEnrollmentStudent {
  readonly id: number
  readonly student_id: number
  readonly identification: string
  readonly name: string
  readonly email: string
  readonly phone: string | null
  readonly is_degree_enrolled: boolean
  readonly degree_enrollment_id: number | null
  readonly enrolled_at: string | null
  readonly period_id: number | null
  readonly period_name: string | null
}

export type DegreeTopicStatus = 'pendiente' | 'aprobado' | 'rechazado'
export interface DegreePerson {
  readonly id: number
  readonly name: string
  readonly email: string
  readonly role?: string
}
export interface DegreeStudent extends DegreePerson {
  readonly identification: string
  readonly phone: string | null
}
export interface DegreeAssignment {
  readonly id: number
  readonly role: 'tutor' | 'par_academico'
  readonly assigned_at: string | null
  readonly teacher: DegreePerson | null
  readonly is_active?: boolean
}
export interface DegreeObservation {
  readonly id: number
  readonly topic_id?: number
  readonly observation: string
  readonly registered_at: string | null
  readonly coordinator: DegreePerson | null
}
export interface DegreeActivity {
  readonly id: number
  readonly description: string
  readonly is_completed: boolean
  readonly registered_at: string | null
  readonly completed_at?: string | null
  readonly teacher?: DegreePerson | null
}

export interface DegreeTracking {
  readonly id: number
  readonly degree_topic_id?: number
  readonly opened_at: string | null
  readonly closed_at?: string | null
  readonly progress_percentage: number
  readonly status: string
  readonly activities: readonly DegreeActivity[]
}

export interface DegreeReport {
  readonly id: number
  readonly topic_id: number | null
  readonly topic_title: string
  readonly student_name: string
  readonly student_identification: string
  readonly coordinator_name: string
  readonly generated_at: string
  readonly final_observations: string
  readonly progress_percentage: number
  readonly period_name: string
}

export interface DegreeTopic {
  readonly id: number
  readonly title: string
  readonly description: string | null
  readonly status: DegreeTopicStatus
  readonly proposed_at: string | null
  readonly reviewed_at: string | null
  readonly student: DegreeStudent | null
  readonly section: Pick<Section, 'id' | 'name'> | null
  readonly academic_period: Pick<AcademicPeriod, 'id' | 'name' | 'is_active'> | null
  readonly reviewer: DegreePerson | null
  readonly assignments: readonly DegreeAssignment[]
  readonly observations: readonly DegreeObservation[]
  readonly tracking?: DegreeTracking | null
}
export interface DegreeTeacherCareer {
  readonly id: number
  readonly name: string
  readonly faculty_id: number | null
  readonly faculty_name: string | null
}
export interface DegreeTeacher extends DegreeStudent {
  readonly is_active: boolean
  readonly active_tutorships_count: number
  readonly active_peer_reviews_count: number
  /** Carreras (con su facultad) en las que enseña; la búsqueda abarca todas las facultades. */
  readonly careers?: readonly DegreeTeacherCareer[]
}
export interface AcademicPeer {
  readonly assignment_id: number
  readonly teacher_id: number | null
  readonly identification: string | null
  readonly name: string | null
  readonly email: string | null
  readonly phone: string | null
  readonly role: 'par_academico'
  readonly assigned_at: string | null
  readonly is_active: boolean
}
export interface DegreeTopicCollection extends Collection<DegreeTopic> {
  readonly meta: {
    readonly academic_period: Pick<AcademicPeriod, 'id' | 'name'>
    readonly filter_section_id: number | null
  }
}
export type DegreeTopicFilters = { status?: DegreeTopicStatus; section_id?: number; search?: string }
export type ApproveDegreeTopicInput = { tutor_id: number; peer_ids: readonly number[] }

async function resource<T>(path: string, method?: string, input?: unknown): Promise<T> {
  return (await request<Resource<T>>(path, { ...(method ? { method } : {}), ...(input === undefined ? {} : { body: JSON.stringify(input) }) })).data
}

export const degreeCoordinationApi = {
  currentPeriod: () => resource<AcademicPeriod>('/api/v1/academic-periods/current'),
  async sections(): Promise<readonly Section[]> {
    return (await request<Collection<Section>>('/api/v1/academic-periods/current/sections')).data
  },
  registerSection: (name: string) => resource<Pick<Section, 'id' | 'name'> & { status: boolean; academic_period: Pick<AcademicPeriod, 'id' | 'name'> }>('/api/v1/academic-periods/current/sections', 'POST', { name }),
  async teachers(search = ''): Promise<readonly DegreeTeacher[]> {
    return (await request<Collection<DegreeTeacher>>(`${ROOT}/teachers${buildQuery({ search })}`)).data
  },
  topics: (filters: DegreeTopicFilters = {}) => request<DegreeTopicCollection>(`${ROOT}/degree-topics${buildQuery(filters)}`),
  topic: (id: number) => resource<DegreeTopic>(`${ROOT}/degree-topics/${id}`),
  approve: (id: number, input: ApproveDegreeTopicInput) => resource<DegreeTopic>(`${ROOT}/degree-topics/${id}/approve`, 'POST', input),
  reject: (id: number, observation: string) => resource<DegreeTopic>(`${ROOT}/degree-topics/${id}/reject`, 'POST', { observation }),
  observe: (id: number, observation: string) => resource<DegreeObservation>(`${ROOT}/degree-topics/${id}/observations`, 'POST', { observation }),
  async peers(id: number): Promise<readonly AcademicPeer[]> {
    return (await request<Collection<AcademicPeer>>(`${ROOT}/degree-topics/${id}/peers`)).data
  },
  async updatePeers(id: number, peerIds: readonly number[]): Promise<readonly AcademicPeer[]> {
    return (await request<Collection<AcademicPeer>>(`${ROOT}/degree-topics/${id}/peers`, { method: 'PUT', body: JSON.stringify({ peer_ids: peerIds }) })).data
  },
  async studentTopics(): Promise<readonly DegreeTopic[]> {
    return (await request<Collection<DegreeTopic>>('/api/v1/student/degree-topics')).data
  },
  degreeStudents: (params?: { page?: number; search?: string; enrolled?: boolean }) =>
    request<PaginatedResourceCollection<DegreeEnrollmentStudent, DegreePaginationMeta>>(
      `${ROOT}/degree-students${buildQuery({
        page: params?.page,
        search: params?.search,
        enrolled: params?.enrolled !== undefined ? (params.enrolled ? 1 : 0) : undefined,
      })}`,
    ),
  enrollDegreeStudent: (studentId: number) =>
    request<{ data: DegreeEnrollmentStudent; message: string }>(`${ROOT}/degree-students/${studentId}/enroll`, { method: 'POST' }),
  unenrollDegreeStudent: (studentId: number) =>
    request<{ data: DegreeEnrollmentStudent; message: string }>(`${ROOT}/degree-students/${studentId}/unenroll`, { method: 'DELETE' }),
  addActivity: (topicId: number, data: { descripcion: string; completada?: boolean; docente_id?: number }) =>
    request<{ data: DegreeActivity; message: string }>(`${ROOT}/degree-topics/${topicId}/activities`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  toggleActivity: (topicId: number, activityId: number, completada?: boolean) =>
    request<{ data: { id: number; is_completed: boolean; progress_percentage: number }; message: string }>(
      `${ROOT}/degree-topics/${topicId}/activities/${activityId}/toggle`,
      {
        method: 'PATCH',
        body: JSON.stringify(completada !== undefined ? { completada } : {}),
      },
    ),
  updateProgress: (topicId: number, data: { porcentaje_avance: number; estado?: string }) =>
    request<{ data: { id: number; progress_percentage: number; status: string }; message: string }>(
      `${ROOT}/degree-topics/${topicId}/progress`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      },
    ),
  generateReport: (topicId: number, data: { observaciones_finales: string }) =>
    request<{ data: DegreeReport; message: string }>(`${ROOT}/degree-topics/${topicId}/reports`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  reports: (params?: { page?: number; search?: string }) =>
    request<PaginatedResourceCollection<DegreeReport, PaginationMeta>>(
      `${ROOT}/degree-reports${buildQuery({ page: params?.page, search: params?.search })}`,
    ),
}
