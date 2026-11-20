import type {
  Activity,
  AnalyticsMetrics,
  AppNotification,
  BoardData,
  CardWithMeta,
  CuratorDashboard,
  ModuleProgress,
  Profile,
  ReviewItem,
  StudentDashboard,
  StudentSummary,
} from '@/types'
import { REVIEW_OVERDUE_HOURS, STALLED_HOURS } from '@/lib/constants'
import { hoursSince } from '@/lib/utils'

export function modulesProgress(board: BoardData): ModuleProgress[] {
  return [...board.modules]
    .sort((a, b) => a.position - b.position)
    .map((module) => {
      const list = board.cards.filter((c) => c.moduleId === module.id)
      const done = list.filter((c) => c.status === 'done').length
      return {
        module,
        total: list.length,
        done,
        inProgress: list.filter((c) => c.status === 'in_progress').length,
        review: list.filter((c) => c.status === 'review').length,
        revision: list.filter((c) => c.status === 'revision').length,
        backlog: list.filter((c) => c.status === 'backlog').length,
        percent: list.length ? Math.round((done / list.length) * 100) : 0,
      }
    })
}

export function summarize(profile: Profile, board: BoardData | null): StudentSummary {
  const cards = board?.cards ?? []
  const done = cards.filter((c) => c.status === 'done').length
  const lastActivityAt = cards.reduce<string | null>(
    (acc, c) => (!acc || new Date(c.updatedAt) > new Date(acc) ? c.updatedAt : acc),
    null,
  )
  return {
    profile,
    boardId: board?.board.id ?? null,
    total: cards.length,
    done,
    inProgress: cards.filter((c) => c.status === 'in_progress').length,
    review: cards.filter((c) => c.status === 'review').length,
    revision: cards.filter((c) => c.status === 'revision').length,
    backlog: cards.filter((c) => c.status === 'backlog').length,
    overdue: cards.filter((c) => c.isOverdue).length,
    percent: cards.length ? Math.round((done / cards.length) * 100) : 0,
    lastActivityAt,
  }
}

export function buildStudentDashboard(
  profile: Profile,
  board: BoardData,
  activity: Activity,
  notifications: AppNotification[],
): StudentDashboard {
  const cards = board.cards
  const done = cards.filter((c) => c.status === 'done').length
  const curatorEvents = activity.events.filter((e) => e.actorRole === 'curator')
  const curatorComments = activity.comments.filter((c) => c.authorRole === 'curator')

  const attention = cards
    .filter(
      (c) =>
        c.status === 'revision' ||
        c.isOverdue ||
        (c.status === 'in_progress' && hoursSince(c.statusSince) > STALLED_HOURS),
    )
    .sort((a, b) => {
      if (a.status === 'revision' && b.status !== 'revision') return -1
      if (b.status === 'revision' && a.status !== 'revision') return 1
      return new Date(a.deadline ?? 0).getTime() - new Date(b.deadline ?? 0).getTime()
    })
    .slice(0, 5)

  return {
    profile,
    total: cards.length,
    done,
    inProgress: cards.filter((c) => c.status === 'in_progress').length,
    review: cards.filter((c) => c.status === 'review').length,
    revision: cards.filter((c) => c.status === 'revision').length,
    backlog: cards.filter((c) => c.status === 'backlog').length,
    overdue: cards.filter((c) => c.isOverdue).length,
    percent: cards.length ? Math.round((done / cards.length) * 100) : 0,
    modules: modulesProgress(board),
    deadlines: cards
      .filter((c) => c.deadline && c.status !== 'done')
      .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
      .slice(0, 5),
    attention,
    curatorActions: curatorEvents.slice(0, 6).map((event) => ({
      id: event.id,
      cardId: event.cardId,
      actorId: event.actorId,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      comment: event.comment,
      createdAt: event.createdAt,
      actorName: event.actorName,
      cardTitle: event.cardTitle,
    })),
    recentComments: curatorComments.slice(0, 4).map((comment) => ({
      id: comment.id,
      cardId: comment.cardId,
      authorId: comment.authorId,
      text: comment.text,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      authorName: comment.authorName,
      cardTitle: comment.cardTitle,
    })),
    notifications: notifications.slice(0, 5),
    stalled: cards.filter(
      (c) => c.status === 'in_progress' && hoursSince(c.statusSince) > STALLED_HOURS,
    ),
  }
}

export function buildCuratorDashboard(
  students: StudentSummary[],
  queue: ReviewItem[],
  analytics: AnalyticsMetrics,
  activity: Activity,
  notifications: AppNotification[],
): CuratorDashboard {
  const weekly = analytics.timeline.slice(-7).map((t) => ({
    date: t.date,
    submitted: t.submitted,
    completed: t.completed,
  }))
  return {
    activeStudents: students.length,
    totalCards: students.reduce((acc, s) => acc + s.total, 0),
    inReview: students.reduce((acc, s) => acc + s.review, 0),
    overdueReviews: queue.filter((q) => q.waitingHours > REVIEW_OVERDUE_HOURS).length,
    avgReviewHours: analytics.avgReviewHours,
    completedThisWeek: weekly.reduce((acc, w) => acc + w.completed, 0),
    students,
    reviewQueue: queue,
    recentActivity: activity.events.slice(0, 8).map((event) => ({
      id: event.id,
      cardId: event.cardId,
      actorId: event.actorId,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      comment: event.comment,
      createdAt: event.createdAt,
      actorName: event.actorName,
      cardTitle: event.cardTitle,
      studentName: event.studentName,
    })),
    notifications: notifications.slice(0, 5),
    weekly,
  }
}

export function filterCards(cards: CardWithMeta[], filters: {
  query?: string
  moduleId?: string
  status?: string
  assigneeId?: string
  deadline?: string
  overdue?: boolean
}) {
  const query = filters.query?.trim().toLowerCase()
  return cards.filter((card) => {
    if (query && !`${card.title} ${card.description} ${card.moduleTitle}`.toLowerCase().includes(query)) {
      return false
    }
    if (filters.moduleId && card.moduleId !== filters.moduleId) return false
    if (filters.status && card.status !== filters.status) return false
    if (filters.assigneeId && card.studentId !== filters.assigneeId) return false
    if (filters.overdue && !card.isOverdue) return false
    if (filters.deadline === 'overdue' && !card.isOverdue) return false
    if (filters.deadline === 'none' && card.deadline) return false
    if (filters.deadline === 'week') {
      if (!card.deadline) return false
      const diff = new Date(card.deadline).getTime() - Date.now()
      if (diff < 0 || diff > 7 * 24 * 3_600_000) return false
    }
    return true
  })
}
