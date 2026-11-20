import type { Api, CardInput, ModuleInput, SignUpResult } from '@/services/contract'
import type {
  AnalyticsFilters,
  AnalyticsMetrics,
  AppNotification,
  AuthSession,
  BoardData,
  BoardSummary,
  Card,
  CardDetail,
  CardStatus,
  CardWithMeta,
  Comment,
  CuratorDashboard,
  Invitation,
  Module,
  ModuleProgress,
  NotificationType,
  Profile,
  ReviewItem,
  SignUpInput,
  StudentDashboard,
  StudentSummary,
} from '@/types'
import { MODULE_COLORS, REVIEW_OVERDUE_HOURS, STALLED_HOURS } from '@/lib/constants'
import { generateCode, hoursSince } from '@/lib/utils'
import {
  ensureDB,
  getDB,
  hashPassword,
  nextId,
  randomSalt,
  resetDB,
  saveDB,
  subscribeToLocalChanges,
  verifyPassword,
  type LocalDB,
} from './db'

const HOUR = 3_600_000
const DAY = 24 * HOUR

function fail(message: string): never {
  throw new Error(message)
}

function nowIso() {
  return new Date().toISOString()
}

function findProfile(db: LocalDB, id: string): Profile | undefined {
  return db.profiles.find((p) => p.id === id)
}

function requireProfile(db: LocalDB, id: string): Profile {
  const profile = findProfile(db, id)
  if (!profile) fail('Профиль не найден')
  return profile
}

function currentUser(db: LocalDB): Profile {
  const id = db.session?.userId
  if (!id) fail('Требуется авторизация')
  return requireProfile(db, id)
}

function isLinked(db: LocalDB, curatorId: string, studentId: string) {
  return db.curatorStudents.some((l) => l.curatorId === curatorId && l.studentId === studentId)
}

function linkedStudents(db: LocalDB, curatorId: string) {
  return db.curatorStudents
    .filter((l) => l.curatorId === curatorId)
    .map((l) => requireProfile(db, l.studentId))
}

function linkedCurators(db: LocalDB, studentId: string) {
  return db.curatorStudents
    .filter((l) => l.studentId === studentId)
    .map((l) => requireProfile(db, l.curatorId))
}

function boardOf(db: LocalDB, studentId: string) {
  return db.boards.find((b) => b.studentId === studentId) ?? null
}

function ensureBoard(db: LocalDB, studentId: string) {
  const existing = boardOf(db, studentId)
  if (existing) return existing
  const student = requireProfile(db, studentId)
  const board = {
    id: nextId(),
    studentId,
    title: `${student.firstName} ${student.lastName} — обучение`,
    createdAt: nowIso(),
  }
  db.boards.push(board)
  return board
}

function assertBoardAccess(db: LocalDB, me: Profile, boardId: string) {
  const board = db.boards.find((b) => b.id === boardId)
  if (!board) fail('Доска не найдена')
  if (me.role === 'student') {
    if (board.studentId !== me.id) fail('Нет доступа к этой доске')
    return board
  }
  if (!isLinked(db, me.id, board.studentId)) fail('Ученик не закреплён за вами')
  return board
}

function assertCardAccess(db: LocalDB, me: Profile, cardId: string) {
  const card = db.cards.find((c) => c.id === cardId)
  if (!card) fail('Задание не найдено')
  const module = db.modules.find((m) => m.id === card.moduleId)
  if (!module) fail('Модуль не найден')
  assertBoardAccess(db, me, module.boardId)
  return { card, module }
}

function eventsOf(db: LocalDB, cardId: string) {
  return db.cardEvents
    .filter((e) => e.cardId === cardId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

function statusSince(db: LocalDB, card: Card) {
  const events = eventsOf(db, card.id).filter((e) => e.toStatus === card.status)
  return events.length ? events[events.length - 1].createdAt : card.updatedAt
}

function submittedAt(db: LocalDB, card: Card) {
  const events = eventsOf(db, card.id).filter((e) => e.toStatus === 'review')
  return events.length ? events[events.length - 1].createdAt : null
}

function cardMeta(db: LocalDB, card: Card): CardWithMeta {
  const module = db.modules.find((m) => m.id === card.moduleId)
  const board = module ? db.boards.find((b) => b.id === module.boardId) : undefined
  const student = board ? findProfile(db, board.studentId) : undefined
  const assignee = findProfile(db, card.assigneeId)
  const since = statusSince(db, card)
  const submitted = submittedAt(db, card)
  const overdue =
    !!card.deadline && card.status !== 'done' && new Date(card.deadline).getTime() < Date.now()

  return {
    ...card,
    moduleTitle: module?.title ?? 'Без модуля',
    moduleColor: module?.color ?? MODULE_COLORS[0],
    boardId: board?.id ?? '',
    studentId: student?.id ?? '',
    studentName: student ? `${student.firstName} ${student.lastName}` : '—',
    assigneeName: assignee ? `${assignee.firstName} ${assignee.lastName}` : '—',
    assigneeAvatar: assignee?.avatarUrl ?? null,
    commentsCount: db.comments.filter((c) => c.cardId === card.id).length,
    statusSince: since,
    submittedAt: submitted,
    isOverdue: overdue,
    waitingHours: card.status === 'review' ? Math.round(hoursSince(since)) : 0,
  }
}

function cardsOfBoard(db: LocalDB, boardId: string) {
  const moduleIds = db.modules.filter((m) => m.boardId === boardId).map((m) => m.id)
  return db.cards
    .filter((c) => moduleIds.includes(c.moduleId))
    .map((c) => cardMeta(db, c))
    .sort((a, b) => a.position - b.position)
}

function boardData(db: LocalDB, studentId: string): BoardData {
  const student = requireProfile(db, studentId)
  const board = ensureBoard(db, studentId)
  return {
    board,
    student,
    modules: db.modules
      .filter((m) => m.boardId === board.id)
      .sort((a, b) => a.position - b.position),
    cards: cardsOfBoard(db, board.id),
  }
}

function notify(
  db: LocalDB,
  userId: string,
  type: NotificationType,
  payload: Record<string, unknown>,
) {
  db.notifications.push({
    id: nextId(),
    userId,
    type,
    payload,
    readAt: null,
    createdAt: nowIso(),
  })
}

function summarizeStudent(db: LocalDB, student: Profile): StudentSummary {
  const board = boardOf(db, student.id)
  if (!board) {
    return {
      profile: student,
      boardId: null,
      total: 0,
      done: 0,
      inProgress: 0,
      review: 0,
      revision: 0,
      backlog: 0,
      overdue: 0,
      percent: 0,
      lastActivityAt: null,
    }
  }
  const cards = cardsOfBoard(db, board.id)
  const done = cards.filter((c) => c.status === 'done').length
  const lastActivityAt = cards.reduce<string | null>(
    (acc, c) => (!acc || new Date(c.updatedAt) > new Date(acc) ? c.updatedAt : acc),
    null,
  )
  return {
    profile: student,
    boardId: board.id,
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

function moduleProgress(db: LocalDB, boardId: string): ModuleProgress[] {
  const modules = db.modules
    .filter((m) => m.boardId === boardId)
    .sort((a, b) => a.position - b.position)
  const cards = cardsOfBoard(db, boardId)
  return modules.map((module) => {
    const list = cards.filter((c) => c.moduleId === module.id)
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

function reviewQueue(db: LocalDB, curatorId: string): ReviewItem[] {
  const studentIds = linkedStudents(db, curatorId).map((s) => s.id)
  return db.cards
    .filter((c) => {
      const module = db.modules.find((m) => m.id === c.moduleId)
      const board = module ? db.boards.find((b) => b.id === module.boardId) : undefined
      return c.status === 'review' && !!board && studentIds.includes(board.studentId)
    })
    .map((c) => {
      const meta = cardMeta(db, c)
      return {
        ...meta,
        studentId: meta.studentId,
        studentName: meta.studentName,
        submittedAt: meta.statusSince,
        waitingHours: Math.round(hoursSince(meta.statusSince)),
      }
    })
    .sort((a, b) => new Date(a.statusSince).getTime() - new Date(b.statusSince).getTime())
}

function median(values: number[]) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function avg(values: number[]) {
  if (!values.length) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

function dayKey(value: string | number | Date) {
  return new Date(value).toISOString().slice(0, 10)
}

function computeAnalytics(
  db: LocalDB,
  me: Profile,
  filters: AnalyticsFilters,
): AnalyticsMetrics {
  const studentProfiles =
    me.role === 'student'
      ? [me]
      : linkedStudents(db, me.id).filter((s) => !filters.studentId || s.id === filters.studentId)

  const to = filters.to ? new Date(filters.to) : new Date()
  const from = filters.from ? new Date(filters.from) : new Date(to.getTime() - 29 * DAY)
  const fromMs = from.getTime()
  const toMs = to.getTime()

  const scopedCards: CardWithMeta[] = studentProfiles.flatMap((student) => {
    const board = boardOf(db, student.id)
    return board ? cardsOfBoard(db, board.id) : []
  })
  const cardIds = new Set(scopedCards.map((c) => c.id))
  const allEvents = db.cardEvents
    .filter((e) => cardIds.has(e.cardId))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  const events = allEvents.filter((e) => {
    const t = new Date(e.createdAt).getTime()
    return t >= fromMs && t <= toMs
  })

  const cycleHours: number[] = []
  const reviewHours: number[] = []
  const reviewByStudent = new Map<string, number[]>()

  allEvents.forEach((event) => {
    if (event.toStatus === 'review') {
      const before = allEvents.filter(
        (e) =>
          e.cardId === event.cardId &&
          new Date(e.createdAt) < new Date(event.createdAt) &&
          e.toStatus === 'in_progress',
      )
      const last = before[before.length - 1]
      if (last) {
        const hours =
          (new Date(event.createdAt).getTime() - new Date(last.createdAt).getTime()) / HOUR
        if (hours >= 0) cycleHours.push(hours)
      }
    }
    if (
      event.fromStatus === 'review' &&
      (event.toStatus === 'done' || event.toStatus === 'revision')
    ) {
      const reviewEvent = allEvents
        .filter(
          (e) =>
            e.cardId === event.cardId &&
            e.toStatus === 'review' &&
            new Date(e.createdAt) < new Date(event.createdAt),
        )
        .pop()
      if (reviewEvent) {
        const hours =
          (new Date(event.createdAt).getTime() - new Date(reviewEvent.createdAt).getTime()) / HOUR
        if (hours >= 0) {
          reviewHours.push(hours)
          const meta = scopedCards.find((c) => c.id === event.cardId)
          if (meta) {
            const list = reviewByStudent.get(meta.studentId) ?? []
            list.push(hours)
            reviewByStudent.set(meta.studentId, list)
          }
        }
      }
    }
  })

  const everInProgress = new Set(
    allEvents.filter((e) => e.toStatus === 'in_progress').map((e) => e.cardId),
  )
  const everReviewed = new Set(
    allEvents.filter((e) => e.toStatus === 'review').map((e) => e.cardId),
  )

  const timelineMap = new Map<string, { submitted: number; completed: number; created: number }>()
  const days = Math.min(120, Math.max(1, Math.ceil((toMs - fromMs) / DAY)))
  for (let i = days - 1; i >= 0; i -= 1) {
    const key = dayKey(toMs - i * DAY)
    timelineMap.set(key, { submitted: 0, completed: 0, created: 0 })
  }
  events.forEach((e) => {
    const bucket = timelineMap.get(dayKey(e.createdAt))
    if (!bucket) return
    if (e.toStatus === 'review') bucket.submitted += 1
    if (e.toStatus === 'done') bucket.completed += 1
  })
  scopedCards.forEach((c) => {
    const bucket = timelineMap.get(dayKey(c.createdAt))
    if (bucket) bucket.created += 1
  })

  const durations = new Map<CardStatus, number[]>()
  allEvents.forEach((event, index) => {
    const next = allEvents[index + 1]
    if (!next || next.cardId !== event.cardId) return
    const hours = (new Date(next.createdAt).getTime() - new Date(event.createdAt).getTime()) / HOUR
    if (hours < 0) return
    const status = event.toStatus
    const list = durations.get(status) ?? []
    list.push(hours)
    durations.set(status, list)
  })

  const reviewCards = scopedCards.filter((c) => c.status === 'review')

  return {
    medianCycleHours: median(cycleHours),
    conversionRate: everInProgress.size
      ? Math.round((everReviewed.size / everInProgress.size) * 100)
      : 0,
    overdueReviews: reviewCards.filter((c) => hoursSince(c.statusSince) > REVIEW_OVERDUE_HOURS)
      .length,
    avgReviewHours: avg(reviewHours),
    completedTasks: events.filter((e) => e.toStatus === 'done').length,
    submittedTasks: events.filter((e) => e.toStatus === 'review').length,
    students: studentProfiles.map((s) => summarizeStudent(db, s)),
    byStatus: (['backlog', 'in_progress', 'review', 'revision', 'done'] as CardStatus[]).map(
      (status) => ({ status, count: scopedCards.filter((c) => c.status === status).length }),
    ),
    timeline: Array.from(timelineMap.entries()).map(([date, value]) => ({ date, ...value })),
    reviewTimes: studentProfiles.map((s) => {
      const values = reviewByStudent.get(s.id) ?? []
      return {
        studentId: s.id,
        studentName: `${s.firstName} ${s.lastName}`,
        avgHours: avg(values),
        count: values.length,
      }
    }),
    statusDurations: Array.from(durations.entries()).map(([status, values]) => ({
      status,
      avgHours: avg(values) ?? 0,
    })),
  }
}

function currentSession(db: LocalDB): AuthSession | null {
  if (!db.session) return null
  const profile = findProfile(db, db.session.userId)
  if (!profile) return null
  return { user: { id: profile.id, email: profile.email }, profile }
}

async function read<T>(fn: (db: LocalDB) => T): Promise<T> {
  const db = await ensureDB()
  return fn(db)
}

async function write<T>(fn: (db: LocalDB) => T): Promise<T> {
  const db = await ensureDB()
  const result = fn(db)
  saveDB(db)
  return result
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

const localApi: Api = {
  mode: 'local',

  auth: {
    async getSession() {
      return read((db) => currentSession(db))
    },

    async signIn(email, password) {
      const db = await ensureDB()
      const normalized = normalizeEmail(email)
      const user = db.users.find((u) => u.email === normalized)
      if (!user) fail('Неверный email или пароль')
      const valid = await verifyPassword(password, user.salt, user.passwordHash)
      if (!valid) fail('Неверный email или пароль')
      const profile = requireProfile(db, user.id)
      if (!profile.approved) {
        fail('Аккаунт куратора ожидает подтверждения администратором')
      }
      db.session = { userId: profile.id }
      saveDB(db)
      return { user: { id: profile.id, email: profile.email }, profile }
    },

    async signUp(input: SignUpInput): Promise<SignUpResult> {
      const db = await ensureDB()
      const normalized = normalizeEmail(input.email)
      if (db.users.some((u) => u.email === normalized)) {
        fail('Пользователь с таким email уже зарегистрирован')
      }
      const salt = randomSalt()
      const passwordHash = await hashPassword(input.password, salt)
      const profile: Profile = {
        id: nextId(),
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email: normalized,
        role: input.role,
        avatarUrl: null,
        approved: input.role === 'student',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      }
      db.users.push({ id: profile.id, email: normalized, passwordHash, salt })
      db.profiles.push(profile)
      if (profile.role === 'student') ensureBoard(db, profile.id)
      db.session = { userId: profile.id }
      saveDB(db)
      return {
        session: { user: { id: profile.id, email: profile.email }, profile },
        requiresEmailConfirmation: false,
        pendingApproval: !profile.approved,
      }
    },

    async signOut() {
      await write((db) => {
        db.session = null
      })
    },

    async requestPasswordReset(email) {
      const db = await ensureDB()
      const normalized = normalizeEmail(email)
      const user = db.users.find((u) => u.email === normalized)
      if (!user) return {}
      const token = generateCode(10)
      db.passwordResets.push({
        token,
        userId: user.id,
        expiresAt: new Date(Date.now() + HOUR).toISOString(),
      })
      saveDB(db)
      return { devLink: `${window.location.origin}/reset-password?token=${token}` }
    },

    async updatePassword(password, token) {
      const db = await ensureDB()
      let userId: string | null = null
      if (token) {
        const reset = db.passwordResets.find(
          (r) => r.token === token && new Date(r.expiresAt).getTime() > Date.now(),
        )
        if (!reset) fail('Ссылка для восстановления недействительна или истекла')
        userId = reset.userId
        db.passwordResets = db.passwordResets.filter((r) => r.token !== token)
      } else {
        userId = db.session?.userId ?? null
      }
      if (!userId) fail('Требуется авторизация')
      const user = db.users.find((u) => u.id === userId)
      if (!user) fail('Пользователь не найден')
      const salt = randomSalt()
      user.salt = salt
      user.passwordHash = await hashPassword(password, salt)
      saveDB(db)
    },

    async resendConfirmation() {
      // В локальном режиме подтверждение email не требуется.
    },

    onAuthStateChange(callback) {
      let lastUserId: string | null = null
      try {
        lastUserId = currentSession(getDB())?.user.id ?? null
      } catch {
        lastUserId = null
      }
      return subscribeToLocalChanges(() => {
        let next: AuthSession | null = null
        try {
          next = currentSession(getDB())
        } catch {
          next = null
        }
        const nextId = next?.user.id ?? null
        if (nextId === lastUserId) return
        lastUserId = nextId
        callback(next)
      })
    },
  },

  profile: {
    async update(input) {
      return write((db) => {
        const me = currentUser(db)
        me.firstName = input.firstName.trim()
        me.lastName = input.lastName.trim()
        if (input.avatarUrl !== undefined) me.avatarUrl = input.avatarUrl
        me.updatedAt = nowIso()
        return me
      })
    },
  },

  boards: {
    async my() {
      return read((db) => {
        const me = currentUser(db)
        if (me.role !== 'student') fail('Доска доступна только ученику')
        return boardData(db, me.id)
      })
    },

    async forStudent(studentId) {
      return read((db) => {
        const me = currentUser(db)
        const board = ensureBoard(db, studentId)
        assertBoardAccess(db, me, board.id)
        return boardData(db, studentId)
      })
    },

    async list(): Promise<BoardSummary[]> {
      return read((db) => {
        const me = currentUser(db)
        const students = me.role === 'curator' ? linkedStudents(db, me.id) : [me]
        return students.map((student) => {
          const summary = summarizeStudent(db, student)
          return {
            boardId: summary.boardId ?? '',
            student,
            total: summary.total,
            done: summary.done,
            review: summary.review,
            percent: summary.percent,
            lastActivityAt: summary.lastActivityAt,
          }
        })
      })
    },
  },

  modules: {
    async create(boardId, input: ModuleInput) {
      return write((db) => {
        const me = currentUser(db)
        const board = assertBoardAccess(db, me, boardId)
        if (me.role === 'student' && board.studentId !== me.id) fail('Нет доступа')
        const module: Module = {
          id: nextId(),
          boardId,
          title: input.title.trim(),
          description: input.description?.trim() ?? '',
          color: input.color ?? MODULE_COLORS[db.modules.length % MODULE_COLORS.length],
          position: db.modules.filter((m) => m.boardId === boardId).length,
          createdAt: nowIso(),
        }
        db.modules.push(module)
        return module
      })
    },

    async update(moduleId, input) {
      return write((db) => {
        const me = currentUser(db)
        const module = db.modules.find((m) => m.id === moduleId)
        if (!module) fail('Модуль не найден')
        assertBoardAccess(db, me, module.boardId)
        if (input.title !== undefined) module.title = input.title.trim()
        if (input.description !== undefined) module.description = input.description.trim()
        if (input.color !== undefined) module.color = input.color
        return module
      })
    },

    async remove(moduleId) {
      await write((db) => {
        const me = currentUser(db)
        const module = db.modules.find((m) => m.id === moduleId)
        if (!module) fail('Модуль не найден')
        assertBoardAccess(db, me, module.boardId)
        const cardIds = db.cards.filter((c) => c.moduleId === moduleId).map((c) => c.id)
        db.cards = db.cards.filter((c) => c.moduleId !== moduleId)
        db.cardEvents = db.cardEvents.filter((e) => !cardIds.includes(e.cardId))
        db.comments = db.comments.filter((c) => !cardIds.includes(c.cardId))
        db.modules = db.modules.filter((m) => m.id !== moduleId)
      })
    },
  },

  cards: {
    async list(boardId) {
      return read((db) => {
        const me = currentUser(db)
        assertBoardAccess(db, me, boardId)
        return cardsOfBoard(db, boardId)
      })
    },

    async get(cardId): Promise<CardDetail> {
      return read((db) => {
        const me = currentUser(db)
        const { card } = assertCardAccess(db, me, cardId)
        const events = eventsOf(db, card.id).map((event) => {
          const actor = findProfile(db, event.actorId)
          return {
            ...event,
            actorName: actor ? `${actor.firstName} ${actor.lastName}` : 'Система',
          }
        })
        const comments = db.comments
          .filter((c) => c.cardId === card.id)
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          .map((comment) => {
            const author = findProfile(db, comment.authorId)
            return {
              ...comment,
              authorName: author ? `${author.firstName} ${author.lastName}` : 'Пользователь',
              authorAvatar: author?.avatarUrl ?? null,
              authorRole: author?.role ?? ('student' as const),
            }
          })
        return { card: cardMeta(db, card), events, comments }
      })
    },

    async create(input: CardInput) {
      return write((db) => {
        const me = currentUser(db)
        const module = db.modules.find((m) => m.id === input.moduleId)
        if (!module) fail('Модуль не найден')
        const board = assertBoardAccess(db, me, module.boardId)
        const student = requireProfile(db, board.studentId)
        const card: Card = {
          id: nextId(),
          moduleId: input.moduleId,
          title: input.title.trim(),
          description: input.description.trim(),
          status: 'backlog',
          assigneeId: student.id,
          deadline: input.deadline ?? null,
          position: db.cards.filter((c) => c.moduleId === input.moduleId).length,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        }
        db.cards.push(card)
        db.cardEvents.push({
          id: nextId(),
          cardId: card.id,
          actorId: me.id,
          fromStatus: null,
          toStatus: 'backlog',
          comment: null,
          createdAt: card.createdAt,
        })
        if (me.role === 'curator') {
          notify(db, student.id, 'curator_assigned', {
            cardId: card.id,
            cardTitle: card.title,
            actorName: `${me.firstName} ${me.lastName}`,
          })
        }
        return card
      })
    },

    async update(cardId, input) {
      return write((db) => {
        const me = currentUser(db)
        const { card } = assertCardAccess(db, me, cardId)
        if (me.role === 'student' && card.assigneeId !== me.id) fail('Нет доступа')
        if (input.title !== undefined) card.title = input.title.trim()
        if (input.description !== undefined) card.description = input.description.trim()
        if (input.deadline !== undefined) card.deadline = input.deadline
        card.updatedAt = nowIso()
        return card
      })
    },

    async move(cardId, toStatus, comment) {
      await write((db) => {
        const me = currentUser(db)
        const { card, module } = assertCardAccess(db, me, cardId)
        const board = db.boards.find((b) => b.id === module.boardId)
        if (!board) fail('Доска не найдена')
        const from = card.status
        if (from === toStatus) fail('Задание уже находится в этом статусе')

        if (me.role === 'student') {
          if (card.assigneeId !== me.id) fail('Это задание назначено другому ученику')
          const allowed =
            (from === 'backlog' && toStatus === 'in_progress') ||
            (from === 'in_progress' && toStatus === 'review') ||
            (from === 'revision' && toStatus === 'review')
          if (!allowed) {
            fail(
              toStatus === 'done'
                ? 'Ученик не может перевести задание в «Готово» — это делает куратор'
                : 'Недопустимый переход статуса для ученика',
            )
          }
        } else {
          if (!isLinked(db, me.id, board.studentId)) fail('Ученик не закреплён за вами')
          const allowed = from === 'review' && (toStatus === 'done' || toStatus === 'revision')
          if (!allowed) {
            fail('Куратор может принимать или возвращать задания только из «На проверке»')
          }
          if (toStatus === 'revision' && (!comment || comment.trim().length < 10)) {
            fail('При возврате на доработку нужен комментарий не короче 10 символов')
          }
        }

        card.status = toStatus
        card.updatedAt = nowIso()
        db.cardEvents.push({
          id: nextId(),
          cardId: card.id,
          actorId: me.id,
          fromStatus: from,
          toStatus,
          comment: comment?.trim() || null,
          createdAt: card.updatedAt,
        })

        const student = requireProfile(db, board.studentId)
        const curators = linkedCurators(db, board.studentId)

        if (toStatus === 'review') {
          curators.forEach((curator) => {
            notify(db, curator.id, 'task_submitted', {
              cardId: card.id,
              cardTitle: card.title,
              studentId: student.id,
              studentName: `${student.firstName} ${student.lastName}`,
              resubmitted: from === 'revision',
            })
          })
        }
        if (toStatus === 'done') {
          notify(db, student.id, 'task_approved', {
            cardId: card.id,
            cardTitle: card.title,
            actorName: `${me.firstName} ${me.lastName}`,
          })
        }
        if (toStatus === 'revision') {
          notify(db, student.id, 'task_returned', {
            cardId: card.id,
            cardTitle: card.title,
            comment: comment?.trim(),
            actorName: `${me.firstName} ${me.lastName}`,
          })
        }
      })
    },

    async addComment(cardId, text) {
      return write((db) => {
        const me = currentUser(db)
        const { card, module } = assertCardAccess(db, me, cardId)
        const value = text.trim()
        if (!value) fail('Комментарий не может быть пустым')
        if (value.length > 4000) fail('Комментарий слишком длинный')
        const comment: Comment = {
          id: nextId(),
          cardId,
          authorId: me.id,
          text: value,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        }
        db.comments.push(comment)
        const board = db.boards.find((b) => b.id === module.boardId)
        if (board) {
          const student = requireProfile(db, board.studentId)
          if (me.role === 'curator') {
            notify(db, student.id, 'new_comment', {
              cardId,
              cardTitle: card.title,
              actorName: `${me.firstName} ${me.lastName}`,
              text: value,
            })
          } else {
            linkedCurators(db, student.id).forEach((curator) => {
              notify(db, curator.id, 'new_comment', {
                cardId,
                cardTitle: card.title,
                actorName: `${me.firstName} ${me.lastName}`,
                text: value,
                studentId: student.id,
                studentName: `${student.firstName} ${student.lastName}`,
              })
            })
          }
        }
        return comment
      })
    },
  },

  reviews: {
    async queue() {
      return read((db) => {
        const me = currentUser(db)
        if (me.role !== 'curator') fail('Раздел доступен только куратору')
        return reviewQueue(db, me.id)
      })
    },

    async decide(cardId, decision, comment) {
      await localApi.cards.move(cardId, decision === 'approve' ? 'done' : 'revision', comment)
    },
  },

  students: {
    async list() {
      return read((db) => {
        const me = currentUser(db)
        if (me.role !== 'curator') fail('Раздел доступен только куратору')
        return linkedStudents(db, me.id).map((student) => summarizeStudent(db, student))
      })
    },

    async invitations() {
      return read((db) => {
        const me = currentUser(db)
        if (me.role !== 'curator') fail('Раздел доступен только куратору')
        return db.invitations
          .filter((i) => i.curatorId === me.id)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      })
    },

    async invite(email?: string) {
      return write((db) => {
        const me = currentUser(db)
        if (me.role !== 'curator') fail('Приглашения доступны только куратору')
        const normalized = email?.trim() ? normalizeEmail(email) : null
        if (normalized) {
          const existing = db.profiles.find((p) => p.email === normalized)
          if (existing && isLinked(db, me.id, existing.id)) {
            fail('Этот ученик уже закреплён за вами')
          }
        }
        let token = generateCode(8)
        while (db.invitations.some((i) => i.token === token)) token = generateCode(8)
        const invitation: Invitation = {
          id: nextId(),
          curatorId: me.id,
          email: normalized,
          token,
          status: 'pending',
          expiresAt: new Date(Date.now() + 7 * DAY).toISOString(),
          createdAt: nowIso(),
        }
        db.invitations.push(invitation)
        return invitation
      })
    },

    async revokeInvitation(id) {
      await write((db) => {
        const me = currentUser(db)
        const invitation = db.invitations.find((i) => i.id === id && i.curatorId === me.id)
        if (!invitation) fail('Приглашение не найдено')
        invitation.status = 'revoked'
      })
    },

    async acceptInvitation(token) {
      const db = await ensureDB()
      const me = currentUser(db)
      if (me.role !== 'student') fail('Присоединиться к куратору может только ученик')
      const invitation = db.invitations.find(
        (i) => i.token === token.trim().toUpperCase() && i.status === 'pending',
      )
      if (!invitation) fail('Приглашение не найдено или уже использовано')
      if (new Date(invitation.expiresAt).getTime() < Date.now()) {
        invitation.status = 'expired'
        saveDB(db)
        fail('Срок действия приглашения истёк')
      }
      if (invitation.email && invitation.email !== me.email) {
        fail('Приглашение выдано для другого email')
      }
      const curator = requireProfile(db, invitation.curatorId)
      db.curatorStudents = db.curatorStudents.filter((l) => l.studentId !== me.id)
      db.curatorStudents.push({
        id: nextId(),
        curatorId: curator.id,
        studentId: me.id,
        createdAt: nowIso(),
      })
      invitation.status = 'accepted'
      ensureBoard(db, me.id)
      notify(db, curator.id, 'invitation_accepted', {
        studentId: me.id,
        studentName: `${me.firstName} ${me.lastName}`,
        studentEmail: me.email,
      })
      saveDB(db)
      return { curatorName: `${curator.firstName} ${curator.lastName}` }
    },

    async remove(studentId) {
      await write((db) => {
        const me = currentUser(db)
        if (me.role !== 'curator') fail('Действие доступно только куратору')
        if (!isLinked(db, me.id, studentId)) fail('Ученик не закреплён за вами')
        db.curatorStudents = db.curatorStudents.filter(
          (l) => !(l.curatorId === me.id && l.studentId === studentId),
        )
      })
    },
  },

  dashboard: {
    async student(): Promise<StudentDashboard> {
      return read((db) => {
        const me = currentUser(db)
        if (me.role !== 'student') fail('Дашборд доступен только ученику')
        const board = ensureBoard(db, me.id)
        const cards = cardsOfBoard(db, board.id)
        const done = cards.filter((c) => c.status === 'done').length
        const studentCardIds = new Set(cards.map((c) => c.id))
        const curatorActions = db.cardEvents
          .filter((e) => studentCardIds.has(e.cardId))
          .filter((e) => findProfile(db, e.actorId)?.role === 'curator')
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 6)
          .map((event) => {
            const actor = findProfile(db, event.actorId)
            const card = db.cards.find((c) => c.id === event.cardId)
            return {
              ...event,
              actorName: actor ? `${actor.firstName} ${actor.lastName}` : 'Куратор',
              cardTitle: card?.title ?? 'Задание',
            }
          })
        const recentComments = db.comments
          .filter((c) => studentCardIds.has(c.cardId))
          .filter((c) => findProfile(db, c.authorId)?.role === 'curator')
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 4)
          .map((comment) => {
            const author = findProfile(db, comment.authorId)
            const card = db.cards.find((c) => c.id === comment.cardId)
            return {
              ...comment,
              authorName: author ? `${author.firstName} ${author.lastName}` : 'Куратор',
              cardTitle: card?.title ?? 'Задание',
            }
          })

        return {
          profile: me,
          total: cards.length,
          done,
          inProgress: cards.filter((c) => c.status === 'in_progress').length,
          review: cards.filter((c) => c.status === 'review').length,
          revision: cards.filter((c) => c.status === 'revision').length,
          backlog: cards.filter((c) => c.status === 'backlog').length,
          overdue: cards.filter((c) => c.isOverdue).length,
          percent: cards.length ? Math.round((done / cards.length) * 100) : 0,
          modules: moduleProgress(db, board.id),
          deadlines: cards
            .filter((c) => c.deadline && c.status !== 'done')
            .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
            .slice(0, 5),
          attention: cards
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
            .slice(0, 5),
          curatorActions,
          recentComments,
          notifications: db.notifications
            .filter((n) => n.userId === me.id)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 5),
          stalled: cards.filter(
            (c) => c.status === 'in_progress' && hoursSince(c.statusSince) > STALLED_HOURS,
          ),
        }
      })
    },

    async curator(): Promise<CuratorDashboard> {
      return read((db) => {
        const me = currentUser(db)
        if (me.role !== 'curator') fail('Дашборд доступен только куратору')
        const students = linkedStudents(db, me.id).map((s) => summarizeStudent(db, s))
        const queue = reviewQueue(db, me.id)
        const analytics = computeAnalytics(db, me, {})
        const studentIds = new Set(students.map((s) => s.profile.id))
        const boardIds = db.boards.filter((b) => studentIds.has(b.studentId)).map((b) => b.id)
        const moduleIds = new Set(
          db.modules.filter((m) => boardIds.includes(m.boardId)).map((m) => m.id),
        )
        const cardIds = new Set(
          db.cards.filter((c) => moduleIds.has(c.moduleId)).map((c) => c.id),
        )
        const recentActivity = db.cardEvents
          .filter((e) => cardIds.has(e.cardId))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 8)
          .map((event) => {
            const actor = findProfile(db, event.actorId)
            const card = db.cards.find((c) => c.id === event.cardId)
            const module = card ? db.modules.find((m) => m.id === card.moduleId) : undefined
            const board = module ? db.boards.find((b) => b.id === module.boardId) : undefined
            const student = board ? findProfile(db, board.studentId) : undefined
            return {
              ...event,
              actorName: actor ? `${actor.firstName} ${actor.lastName}` : 'Пользователь',
              cardTitle: card?.title ?? 'Задание',
              studentName: student ? `${student.firstName} ${student.lastName}` : '—',
            }
          })
        const weekStart = Date.now() - 7 * DAY
        return {
          activeStudents: students.length,
          totalCards: students.reduce((acc, s) => acc + s.total, 0),
          inReview: students.reduce((acc, s) => acc + s.review, 0),
          overdueReviews: queue.filter((q) => q.waitingHours > REVIEW_OVERDUE_HOURS).length,
          avgReviewHours: analytics.avgReviewHours,
          completedThisWeek: db.cardEvents.filter(
            (e) =>
              cardIds.has(e.cardId) &&
              e.toStatus === 'done' &&
              new Date(e.createdAt).getTime() > weekStart,
          ).length,
          students,
          reviewQueue: queue,
          recentActivity,
          notifications: db.notifications
            .filter((n) => n.userId === me.id)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 5),
          weekly: analytics.timeline.slice(-7).map((t) => ({
            date: t.date,
            submitted: t.submitted,
            completed: t.completed,
          })),
        }
      })
    },
  },

  analytics: {
    async get(filters) {
      return read((db) => {
        const me = currentUser(db)
        return computeAnalytics(db, me, filters)
      })
    },
  },

  notifications: {
    async list(): Promise<AppNotification[]> {
      return read((db) => {
        const me = currentUser(db)
        return db.notifications
          .filter((n) => n.userId === me.id)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      })
    },

    async markRead(id) {
      await write((db) => {
        const me = currentUser(db)
        const notification = db.notifications.find((n) => n.id === id && n.userId === me.id)
        if (notification && !notification.readAt) notification.readAt = nowIso()
      })
    },

    async markAllRead() {
      await write((db) => {
        const me = currentUser(db)
        db.notifications
          .filter((n) => n.userId === me.id && !n.readAt)
          .forEach((n) => {
            n.readAt = nowIso()
          })
      })
    },
  },

  async search(query) {
    return read((db) => {
      const me = currentUser(db)
      const value = query.trim().toLowerCase()
      if (!value) return { cards: [], students: [] }
      let cards: CardWithMeta[] = []
      if (me.role === 'student') {
        const board = boardOf(db, me.id)
        cards = board ? cardsOfBoard(db, board.id) : []
      } else {
        cards = linkedStudents(db, me.id).flatMap((student) => {
          const board = boardOf(db, student.id)
          return board ? cardsOfBoard(db, board.id) : []
        })
      }
      const matchedCards = cards
        .filter(
          (c) =>
            c.title.toLowerCase().includes(value) ||
            c.description.toLowerCase().includes(value) ||
            c.moduleTitle.toLowerCase().includes(value),
        )
        .slice(0, 8)
      const matchedStudents =
        me.role === 'curator'
          ? linkedStudents(db, me.id)
              .filter(
                (s) =>
                  `${s.firstName} ${s.lastName}`.toLowerCase().includes(value) ||
                  s.email.toLowerCase().includes(value),
              )
              .slice(0, 5)
          : []
      return { cards: matchedCards, students: matchedStudents }
    })
  },

  reminders: {
    async run() {
      return write((db) => {
        const me = currentUser(db)
        let created = 0
        const now = Date.now()
        const cards = db.cards.filter((card) => {
          const module = db.modules.find((m) => m.id === card.moduleId)
          const board = module ? db.boards.find((b) => b.id === module.boardId) : undefined
          if (!board) return false
          if (me.role === 'curator') return isLinked(db, me.id, board.studentId)
          return board.studentId === me.id
        })

        cards.forEach((card) => {
          const since = statusSince(db, card)
          const key = `stalled:${since}`
          const already = db.reminderEvents.some(
            (r) => r.cardId === card.id && r.cycleKey === key,
          )
          if (
            card.status === 'in_progress' &&
            now - new Date(since).getTime() > STALLED_HOURS * HOUR &&
            !already
          ) {
            notify(db, card.assigneeId, 'task_stalled', {
              cardId: card.id,
              cardTitle: card.title,
            })
            db.reminderEvents.push({
              id: nextId(),
              cardId: card.id,
              userId: card.assigneeId,
              type: 'stalled_48h',
              cycleKey: key,
              createdAt: nowIso(),
            })
            created += 1
          }

          if (card.deadline && card.status !== 'done') {
            const deadlineMs = new Date(card.deadline).getTime()
            const deadlineKey = `deadline:${card.deadline}`
            const notified = db.reminderEvents.some(
              (r) => r.cardId === card.id && r.cycleKey === deadlineKey,
            )
            if (deadlineMs > now && deadlineMs - now < 48 * HOUR && !notified) {
              notify(db, card.assigneeId, 'deadline_soon', {
                cardId: card.id,
                cardTitle: card.title,
                deadline: card.deadline,
              })
              db.reminderEvents.push({
                id: nextId(),
                cardId: card.id,
                userId: card.assigneeId,
                type: 'deadline_soon',
                cycleKey: deadlineKey,
                createdAt: nowIso(),
              })
              created += 1
            }
          }

          if (card.status === 'review') {
            const module = db.modules.find((m) => m.id === card.moduleId)
            const board = module ? db.boards.find((b) => b.id === module.boardId) : undefined
            if (!board) return
            if (hoursSince(since) <= REVIEW_OVERDUE_HOURS) return
            const key = `review_overdue:${since}`
            const alreadyOverdue = db.reminderEvents.some(
              (r) => r.cardId === card.id && r.cycleKey === key,
            )
            if (alreadyOverdue) return
            const student = findProfile(db, board.studentId)
            linkedCurators(db, board.studentId).forEach((curator) => {
              notify(db, curator.id, 'review_overdue', {
                cardId: card.id,
                cardTitle: card.title,
                studentId: board.studentId,
                studentName: student ? `${student.firstName} ${student.lastName}` : '—',
                waitingHours: Math.round(hoursSince(since)),
              })
              db.reminderEvents.push({
                id: nextId(),
                cardId: card.id,
                userId: curator.id,
                type: 'review_overdue',
                cycleKey: key,
                createdAt: nowIso(),
              })
            })
            created += 1
          }
        })
        return created
      })
    },
  },

  realtime: {
    subscribe(callback) {
      return subscribeToLocalChanges(callback)
    },
  },

  resetDemoData() {
    resetDB()
  },
}

export const localAdapter = localApi
