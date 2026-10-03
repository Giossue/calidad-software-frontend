import { request } from '@/lib/api'
import type { DegreeTopic } from '@/lib/degree-coordination-api'

const ROOT = '/api/v1/student'
type Resource<T> = { readonly data: T }
type Collection<T> = { readonly data: readonly T[] }
type Named = { readonly id: number; readonly name: string }
type Teacher = Named & { readonly email: string; readonly phone?: string | null }

export interface StudentSchedule {
  readonly id: number
  readonly day_of_week: string
  readonly start_time: string
  readonly end_time: string
  readonly is_active: boolean
}
export interface StudentTutoring {
  readonly id: number
  readonly enrolled_at: string | null
  readonly is_active: boolean
  readonly subject: {
    readonly id: number
    readonly name: string
    readonly is_active: boolean
    readonly academic_period: (Named & { readonly is_active: boolean }) | null
    readonly section: Named | null
    readonly modality: Named | null
    readonly cycle: (Named & { readonly number: number | null }) | null
    readonly teacher: Teacher | null
    readonly schedules: readonly StudentSchedule[]
  } | null
}

export interface StudentTutoringSummary {
  readonly id: number
  readonly name: string
  readonly is_active: boolean
  readonly academic_period: Named | null
  readonly section: Named | null
  readonly cycle: Named | null
  readonly teacher: Teacher | null
}
export interface StudentGradeEntry {
  readonly id: number
  readonly value: number
  readonly formatted_value: string
  readonly registered_at: string | null
}
export interface StudentGrades {
  readonly enrollment_id: number
  readonly enrolled_at: string | null
  readonly is_active: boolean
  readonly tutoring: StudentTutoringSummary | null
  readonly grades: {
    readonly diagnostic: StudentGradeEntry | null
    readonly partial: StudentGradeEntry | null
    readonly second_partial: StudentGradeEntry | null
  }
  readonly knowledge_metric: { readonly id: number; readonly group: string; readonly group_key: string; readonly min_score: number; readonly max_score: number } | null
  readonly scale_settings: { readonly minimum: number; readonly maximum: number }
}

export interface StudentAttendanceRecord {
  readonly id: number
  readonly date: string | null
  readonly present: boolean
  readonly status: 'presente' | 'ausente'
  readonly topics_covered: boolean | null
  readonly topics: readonly Named[]
}
export interface StudentAttendance {
  readonly enrollment_id: number
  readonly enrolled_at: string | null
  readonly is_active: boolean
  readonly tutoring: StudentTutoringSummary | null
  readonly summary: { readonly total_sessions: number; readonly present_count: number; readonly absent_count: number; readonly attendance_percentage: number }
  readonly records: readonly StudentAttendanceRecord[]
}

export interface StudentMethodology { readonly id: number; readonly activity_id: number; readonly description: string; readonly is_active: boolean }
export interface StudentActivity { readonly id: number; readonly topic_id: number; readonly name: string; readonly duration: string; readonly is_active: boolean; readonly methodologies: readonly StudentMethodology[] }
export interface StudentTopic {
  readonly id: number
  readonly tutoring_id: number
  readonly name: string
  readonly description: string | null
  readonly is_active: boolean
  readonly is_covered: boolean
  readonly activities_count: number
  readonly activities: readonly StudentActivity[]
}
export interface StudentClassSession {
  readonly id: number
  readonly tutoring_id?: number
  readonly date: string
  readonly topics_covered: boolean
  readonly topics: readonly StudentTopic[]
}

export interface StudentContent {
  readonly tutoring: StudentTutoringSummary
  readonly progress: { readonly total_topics: number; readonly covered_topics: number; readonly pending_topics: number; readonly progress_percentage: number }
  readonly topics: readonly StudentTopic[]
  readonly sessions?: readonly StudentClassSession[]
}

export interface StudentDegreeAssignments {
  readonly topic: {
    readonly id: number
    readonly title: string
    readonly description: string | null
    readonly status: string
    readonly proposed_at: string | null
    readonly approved_at: string | null
    readonly academic_period: Named | null
    readonly section: Named | null
    readonly coordinator: (Named & { readonly email: string }) | null
  }
  readonly tutor: (Teacher & { readonly assignment_id: number; readonly assigned_at: string | null }) | null
  readonly peers: readonly (Teacher & { readonly assignment_id: number; readonly assigned_at: string | null })[]
  readonly total_teachers_assigned: number
}
export type StudentTopicInput = { title: string; description: string | null }

async function mutate<T>(path: string, method: string, input: unknown): Promise<T> {
  return (await request<Resource<T>>(`${ROOT}/${path}`, { method, body: JSON.stringify(input) })).data
}

export const studentApi = {
  tutorings: async () => (await request<Collection<StudentTutoring>>(`${ROOT}/tutoring`)).data,
  grades: async () => (await request<Collection<StudentGrades>>(`${ROOT}/tutoring/grades`)).data,
  attendance: async () => (await request<Collection<StudentAttendance>>(`${ROOT}/tutoring/attendance`)).data,
  content: async (tutoringId: number) => (await request<Resource<StudentContent>>(`${ROOT}/tutoring/${tutoringId}/topics`)).data,
  sessions: async (tutoringId: number) => (await request<Collection<StudentClassSession>>(`${ROOT}/tutoring/${tutoringId}/sessions`)).data,
  degreeAssignments: async (topicId: number) => (await request<Resource<StudentDegreeAssignments>>(`${ROOT}/degree-topics/${topicId}/assignments`)).data,
  createTopic: (input: StudentTopicInput & { replace_pending?: boolean }) => mutate<DegreeTopic>('degree-topics', 'POST', input),
  updateTopic: (topicId: number, input: StudentTopicInput) => mutate<DegreeTopic>(`degree-topics/${topicId}`, 'PUT', input),
}
