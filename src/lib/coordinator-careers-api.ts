import { request, type Career, type User } from '@/lib/api'

export const coordinatorCareersApi = {
  async listCareers(signal?: AbortSignal): Promise<readonly Career[]> {
    const response = await request<{ readonly data: readonly Career[] }>(
      '/api/v1/tutoring-coordination/careers',
      { signal },
    )
    return response.data
  },

  async assignCareers(userId: number, careerIds: readonly number[]): Promise<User> {
    const response = await request<{ readonly data: User }>(`/api/v1/admin/users/${userId}/careers`, {
      method: 'PUT',
      body: JSON.stringify({ career_ids: careerIds }),
    })
    return response.data
  },
}
