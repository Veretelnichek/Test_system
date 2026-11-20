import type { AnalyticsFilters } from '@/types'

export const qk = {
  notifications: ['notifications'] as const,
  studentDashboard: ['dashboard', 'student'] as const,
  curatorDashboard: ['dashboard', 'curator'] as const,
  board: (studentId?: string) => ['board', studentId ?? 'me'] as const,
  boardList: ['boards'] as const,
  reviews: ['reviews'] as const,
  students: ['students'] as const,
  invitations: ['invitations'] as const,
  analytics: (filters: AnalyticsFilters) => ['analytics', filters] as const,
  card: (cardId: string) => ['card', cardId] as const,
  search: (query: string) => ['search', query] as const,
}

export const INVALIDATION_KEYS = [
  qk.notifications,
  qk.studentDashboard,
  qk.curatorDashboard,
  qk.boardList,
  qk.reviews,
  qk.students,
  qk.invitations,
  ['board'],
  ['analytics'],
]
