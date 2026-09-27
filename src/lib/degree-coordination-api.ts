import { buildQuery, request, type AcademicPeriod, type Section } from '@/lib/api'

const ROOT = '/api/v1/coordination'
type Resource<T> = { readonly data: T }
type Collection<T> = { readonly data: readonly T[] }

export type DegreeTopicStatus = 'pendiente' | 'aprobado' | 'rechazado'
export interface DegreePerson {
  readonly id: number
  readonly name: string
  readonly email: string
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
}
export interface DegreeTeacher extends DegreeStudent {
  readonly is_active: boolean
  readonly active_tutorships_count: number
  readonly active_peer_reviews_count: number
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
}
