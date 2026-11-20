export type Role = 'student' | 'curator'

export type CardStatus = 'backlog' | 'in_progress' | 'review' | 'revision' | 'done'

export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired'

export interface Profile {
  id: string
  firstName: string
  lastName: string
  email: string
  role: Role
  avatarUrl: string | null
  approved: boolean
  createdAt: string
  updatedAt: string
}

export interface CuratorStudent {
  id: string
  curatorId: string
  studentId: string
  createdAt: string
}

export interface Invitation {
  id: string
  curatorId: string
  email: string | null
  token: string
  status: InvitationStatus
  expiresAt: string
  createdAt: string
}

export interface Board {
  id: string
  studentId: string
  title: string
  createdAt: string
}

export interface Module {
  id: string
  boardId: string
  title: string
  description: string
  color: string
  position: number
  createdAt: string
}

export interface Card {
  id: string
  moduleId: string
  title: string
  description: string
  status: CardStatus
  assigneeId: string
  deadline: string | null
  position: number
  createdAt: string
  updatedAt: string
}

export interface CardEvent {
  id: string
  cardId: string
  actorId: string
  fromStatus: CardStatus | null
  toStatus: CardStatus
  comment: string | null
  createdAt: string
}

export interface Comment {
  id: string
  cardId: string
  authorId: string
  text: string
  createdAt: string
  updatedAt: string
}

export type NotificationType =
  | 'task_submitted'
  | 'task_approved'
  | 'task_returned'
  | 'new_comment'
  | 'deadline_soon'
  | 'task_stalled'
  | 'review_overdue'
  | 'invitation_accepted'
  | 'curator_assigned'

export interface AppNotification {
  id: string
  userId: string
  type: NotificationType
  payload: Record<string, unknown>
  readAt: string | null
  createdAt: string
}

export interface ReminderEvent {
  id: string
  cardId: string
  userId: string
  type: string
  cycleKey: string
  createdAt: string
}

export interface CardWithMeta extends Card {
  moduleTitle: string
  moduleColor: string
  boardId: string
  studentId: string
  studentName: string
  assigneeName: string
  assigneeAvatar: string | null
  commentsCount: number
  statusSince: string
  submittedAt: string | null
  isOverdue: boolean
  waitingHours: number
}

export interface CardDetail {
  card: CardWithMeta
  events: (CardEvent & { actorName: string })[]
  comments: (Comment & { authorName: string; authorAvatar: string | null; authorRole: Role })[]
}

export interface ModuleProgress {
  module: Module
  total: number
  done: number
  inProgress: number
  review: number
  revision: number
  backlog: number
  percent: number
}

export interface StudentSummary {
  profile: Profile
  boardId: string | null
  total: number
  done: number
  inProgress: number
  review: number
  revision: number
  backlog: number
  overdue: number
  percent: number
  lastActivityAt: string | null
}

export interface ReviewItem extends CardWithMeta {
  studentId: string
  studentName: string
  submittedAt: string
  waitingHours: number
}

export interface StudentDashboard {
  profile: Profile
  total: number
  done: number
  inProgress: number
  review: number
  revision: number
  backlog: number
  overdue: number
  percent: number
  modules: ModuleProgress[]
  deadlines: CardWithMeta[]
  attention: CardWithMeta[]
  curatorActions: (CardEvent & { actorName: string; cardTitle: string })[]
  recentComments: (Comment & { authorName: string; cardTitle: string })[]
  notifications: AppNotification[]
  stalled: CardWithMeta[]
}

export interface CuratorDashboard {
  activeStudents: number
  totalCards: number
  inReview: number
  overdueReviews: number
  avgReviewHours: number | null
  completedThisWeek: number
  students: StudentSummary[]
  reviewQueue: ReviewItem[]
  recentActivity: (CardEvent & { actorName: string; cardTitle: string; studentName: string })[]
  notifications: AppNotification[]
  weekly: { date: string; submitted: number; completed: number }[]
}

export interface AnalyticsMetrics {
  medianCycleHours: number | null
  conversionRate: number
  overdueReviews: number
  avgReviewHours: number | null
  completedTasks: number
  submittedTasks: number
  students: StudentSummary[]
  byStatus: { status: CardStatus; count: number }[]
  timeline: { date: string; submitted: number; completed: number; created: number }[]
  reviewTimes: { studentId: string; studentName: string; avgHours: number | null; count: number }[]
  statusDurations: { status: CardStatus; avgHours: number }[]
}

export interface ActivityEvent extends CardEvent {
  actorName: string
  actorRole: Role
  cardTitle: string
  studentName: string
}

export interface ActivityComment extends Comment {
  authorName: string
  authorRole: Role
  cardTitle: string
  studentName: string
}

export interface Activity {
  events: ActivityEvent[]
  comments: ActivityComment[]
}

export interface SessionUser {
  id: string
  email: string
}

export interface AuthSession {
  user: SessionUser
  profile: Profile
}

export interface SignUpInput {
  firstName: string
  lastName: string
  email: string
  password: string
  role: Role
}

export interface CardFilters {
  moduleId?: string
  status?: CardStatus
  assigneeId?: string
  deadline?: 'all' | 'overdue' | 'week' | 'none'
  overdue?: boolean
  query?: string
}

export interface AnalyticsFilters {
  from?: string
  to?: string
  studentId?: string
}

export interface BoardData {
  board: Board
  student: Profile
  modules: Module[]
  cards: CardWithMeta[]
}

export interface BoardSummary {
  boardId: string
  student: Profile
  total: number
  done: number
  review: number
  percent: number
  lastActivityAt: string | null
}
