import type { Api, CardInput, ModuleInput, SignUpResult } from '@/services/contract'
import type {
  Activity,
  AnalyticsMetrics,
  AppNotification,
  BoardData,
  BoardSummary,
  Card,
  CardDetail,
  CardWithMeta,
  Comment,
  CuratorDashboard,
  Invitation,
  Profile,
  ReviewItem,
  SignUpInput,
  StudentDashboard,
  StudentSummary,
} from '@/types'
import { isSupabaseConfigured, requireSupabase } from '@/lib/supabase'
import {
  buildCuratorDashboard,
  buildStudentDashboard,
  summarize,
} from '@/services/shared/derive'

interface ProfileRow {
  id: string
  first_name: string
  last_name: string
  email: string
  role: Profile['role']
  avatar_url: string | null
  approved: boolean
  created_at: string
  updated_at: string
}

interface NotificationRow {
  id: string
  user_id: string
  type: AppNotification['type']
  payload: Record<string, unknown>
  read_at: string | null
  created_at: string
}

interface InvitationRow {
  id: string
  curator_id: string
  email: string | null
  token: string
  status: Invitation['status']
  expires_at: string
  created_at: string
}

interface CardRow {
  id: string
  module_id: string
  title: string
  description: string
  status: Card['status']
  assignee_id: string
  deadline: string | null
  position: number
  created_at: string
  updated_at: string
}

let cachedProfile: Profile | null = null

function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    role: row.role,
    avatarUrl: row.avatar_url,
    approved: row.approved,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    payload: row.payload ?? {},
    readAt: row.read_at,
    createdAt: row.created_at,
  }
}

function mapInvitation(row: InvitationRow): Invitation {
  return {
    id: row.id,
    curatorId: row.curator_id,
    email: row.email,
    token: row.token,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }
}

function mapCard(row: CardRow): Card {
  return {
    id: row.id,
    moduleId: row.module_id,
    title: row.title,
    description: row.description,
    status: row.status,
    assigneeId: row.assignee_id,
    deadline: row.deadline,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function translateError(error: unknown): never {
  const message =
    typeof error === 'string'
      ? error
      : error && typeof error === 'object' && 'message' in error
        ? String((error as { message: unknown }).message)
        : 'Неизвестная ошибка'
  const map: { pattern: RegExp; text: string }[] = [
    { pattern: /Invalid login credentials/i, text: 'Неверный email или пароль' },
    { pattern: /Email not confirmed/i, text: 'Подтвердите email по ссылке из письма' },
    { pattern: /User already registered/i, text: 'Пользователь с таким email уже зарегистрирован' },
    { pattern: /Password should be at least/i, text: 'Пароль должен содержать минимум 8 символов' },
    { pattern: /JWT|session/i, text: 'Сессия истекла. Войдите снова' },
    { pattern: /duplicate key/i, text: 'Такая запись уже существует' },
    { pattern: /row-level security/i, text: 'Недостаточно прав для этого действия' },
  ]
  const found = map.find((m) => m.pattern.test(message))
  throw new Error(found ? found.text : message)
}

async function loadProfile(id: string): Promise<Profile> {
  const sb = requireSupabase()
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data, error } = await sb
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle<ProfileRow>()
    if (!error && data) {
      const profile = mapProfile(data)
      cachedProfile = profile
      return profile
    }
    if (error) throw new Error(error.message)
    await new Promise((resolve) => setTimeout(resolve, 350))
  }
  throw new Error('Профиль не найден. Попробуйте войти заново.')
}

async function getMe(): Promise<Profile> {
  if (cachedProfile) return cachedProfile
  const sb = requireSupabase()
  const { data, error } = await sb.auth.getUser()
  if (error || !data.user) throw new Error('Требуется авторизация')
  return loadProfile(data.user.id)
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const sb = requireSupabase()
  const { data, error } = await sb.rpc(fn, args)
  if (error) translateError(error)
  return data as T
}

async function getBoard(studentId?: string): Promise<BoardData> {
  const data = await rpc<BoardData>('get_board', { p_student: studentId ?? null })
  return {
    board: data.board,
    student: data.student,
    modules: data.modules ?? [],
    cards: data.cards ?? [],
  }
}

async function listNotifications(): Promise<AppNotification[]> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) translateError(error)
  return ((data ?? []) as NotificationRow[]).map(mapNotification)
}

async function getActivity(studentId?: string): Promise<Activity> {
  const data = await rpc<Activity>('get_activity', { p_student: studentId ?? null })
  return { events: data.events ?? [], comments: data.comments ?? [] }
}

const supabaseApi: Api = {
  mode: 'supabase',

  auth: {
    async getSession() {
      if (!isSupabaseConfigured) return null
      const sb = requireSupabase()
      const { data } = await sb.auth.getSession()
      if (!data.session?.user) {
        cachedProfile = null
        return null
      }
      try {
        const profile = await loadProfile(data.session.user.id)
        return { user: { id: profile.id, email: profile.email }, profile }
      } catch {
        return null
      }
    },

    async signIn(email, password) {
      const sb = requireSupabase()
      const { data, error } = await sb.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })
      if (error) translateError(error)
      if (!data.user) throw new Error('Не удалось выполнить вход')
      const profile = await loadProfile(data.user.id)
      if (!profile.approved) {
        await sb.auth.signOut()
        cachedProfile = null
        throw new Error('Аккаунт куратора ожидает подтверждения администратором')
      }
      return { user: { id: profile.id, email: profile.email }, profile }
    },

    async signUp(input: SignUpInput): Promise<SignUpResult> {
      const sb = requireSupabase()
      const { data, error } = await sb.auth.signUp({
        email: input.email.trim().toLowerCase(),
        password: input.password,
        options: {
          data: {
            first_name: input.firstName.trim(),
            last_name: input.lastName.trim(),
            role: input.role,
          },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      })
      if (error) translateError(error)

      if (!data.session?.user) {
        return {
          session: null,
          requiresEmailConfirmation: true,
          pendingApproval: input.role === 'curator',
        }
      }

      const profile = await loadProfile(data.session.user.id)
      return {
        session: { user: { id: profile.id, email: profile.email }, profile },
        requiresEmailConfirmation: false,
        pendingApproval: !profile.approved,
      }
    },

    async signOut() {
      cachedProfile = null
      const sb = requireSupabase()
      await sb.auth.signOut()
    },

    async requestPasswordReset(email) {
      const sb = requireSupabase()
      const { error } = await sb.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) translateError(error)
      return {}
    },

    async updatePassword(password) {
      const sb = requireSupabase()
      const { error } = await sb.auth.updateUser({ password })
      if (error) translateError(error)
    },

    async resendConfirmation(email) {
      const sb = requireSupabase()
      const { error } = await sb.auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: `${window.location.origin}/login` },
      })
      if (error) translateError(error)
    },

    onAuthStateChange(callback) {
      const sb = requireSupabase()
      const { data } = sb.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || !session?.user) {
          cachedProfile = null
          callback(null)
          return
        }
        loadProfile(session.user.id)
          .then((profile) => {
            callback({ user: { id: profile.id, email: profile.email }, profile })
          })
          .catch(() => callback(null))
      })
      return () => data.subscription.unsubscribe()
    },
  },

  profile: {
    async update(input) {
      const me = await getMe()
      const sb = requireSupabase()
      const patch: Record<string, string | null> = {
        first_name: input.firstName.trim(),
        last_name: input.lastName.trim(),
      }
      if (input.avatarUrl !== undefined) patch.avatar_url = input.avatarUrl
      const { data, error } = await sb
        .from('profiles')
        .update(patch)
        .eq('id', me.id)
        .select('*')
        .single<ProfileRow>()
      if (error) translateError(error)
      cachedProfile = mapProfile(data)
      return cachedProfile
    },
  },

  boards: {
    async my() {
      return getBoard()
    },

    async forStudent(studentId) {
      return getBoard(studentId)
    },

    async list(): Promise<BoardSummary[]> {
      const me = await getMe()
      if (me.role === 'student') {
        const board = await getBoard()
        const summary = summarize(me, board)
        return [
          {
            boardId: board.board.id,
            student: board.student,
            total: summary.total,
            done: summary.done,
            review: summary.review,
            percent: summary.percent,
            lastActivityAt: summary.lastActivityAt,
          },
        ]
      }
      const students = await rpc<StudentSummary[]>('get_students')
      return students.map((s) => ({
        boardId: s.boardId ?? '',
        student: s.profile,
        total: s.total,
        done: s.done,
        review: s.review,
        percent: s.percent,
        lastActivityAt: s.lastActivityAt,
      }))
    },
  },

  modules: {
    async create(boardId, input: ModuleInput) {
      const sb = requireSupabase()
      const { count } = await sb
        .from('modules')
        .select('id', { count: 'exact', head: true })
        .eq('board_id', boardId)
      const { data, error } = await sb
        .from('modules')
        .insert({
          board_id: boardId,
          title: input.title.trim(),
          description: input.description?.trim() ?? '',
          color: input.color ?? '#0297DE',
          position: count ?? 0,
        })
        .select('*')
        .single<{
          id: string
          board_id: string
          title: string
          description: string
          color: string
          position: number
          created_at: string
        }>()
      if (error) translateError(error)
      return {
        id: data.id,
        boardId: data.board_id,
        title: data.title,
        description: data.description,
        color: data.color,
        position: data.position,
        createdAt: data.created_at,
      }
    },

    async update(moduleId, input) {
      const sb = requireSupabase()
      const payload: Record<string, string> = {}
      if (input.title !== undefined) payload.title = input.title.trim()
      if (input.description !== undefined) payload.description = input.description.trim()
      if (input.color !== undefined) payload.color = input.color
      const { data, error } = await sb
        .from('modules')
        .update(payload)
        .eq('id', moduleId)
        .select('*')
        .single<{
          id: string
          board_id: string
          title: string
          description: string
          color: string
          position: number
          created_at: string
        }>()
      if (error) translateError(error)
      return {
        id: data.id,
        boardId: data.board_id,
        title: data.title,
        description: data.description,
        color: data.color,
        position: data.position,
        createdAt: data.created_at,
      }
    },

    async remove(moduleId) {
      const sb = requireSupabase()
      const { error } = await sb.from('modules').delete().eq('id', moduleId)
      if (error) translateError(error)
    },
  },

  cards: {
    async list(boardId) {
      const sb = requireSupabase()
      const { data: board, error } = await sb
        .from('boards')
        .select('student_id')
        .eq('id', boardId)
        .single<{ student_id: string }>()
      if (error) translateError(error)
      const data = await getBoard(board.student_id)
      return data.cards.filter((c) => c.boardId === boardId)
    },

    async get(cardId): Promise<CardDetail> {
      return rpc<CardDetail>('get_card_detail', { p_card: cardId })
    },

    async create(input: CardInput) {
      const row = await rpc<CardRow>('create_card', {
        p_module_id: input.moduleId,
        p_title: input.title,
        p_description: input.description,
        p_deadline: input.deadline ?? null,
      })
      return mapCard(row)
    },

    async update(cardId, input: Partial<CardInput>) {
      const row = await rpc<CardRow>('update_card', {
        p_card_id: cardId,
        p_title: input.title ?? null,
        p_description: input.description ?? null,
        p_deadline: input.deadline ?? null,
      })
      return mapCard(row)
    },

    async move(cardId, toStatus, comment) {
      await rpc<CardRow>('move_card', {
        p_card_id: cardId,
        p_to: toStatus,
        p_comment: comment ?? null,
      })
    },

    async addComment(cardId, text) {
      const row = await rpc<{
        id: string
        card_id: string
        author_id: string
        text: string
        created_at: string
        updated_at: string
      }>('add_comment', { p_card_id: cardId, p_text: text })
      return {
        id: row.id,
        cardId: row.card_id,
        authorId: row.author_id,
        text: row.text,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      } satisfies Comment
    },
  },

  reviews: {
    async queue() {
      return rpc<ReviewItem[]>('get_review_queue')
    },

    async decide(cardId, decision, comment) {
      await rpc<CardRow>('move_card', {
        p_card_id: cardId,
        p_to: decision === 'approve' ? 'done' : 'revision',
        p_comment: comment ?? null,
      })
    },
  },

  students: {
    async list() {
      return rpc<StudentSummary[]>('get_students')
    },

    async invitations() {
      const sb = requireSupabase()
      const me = await getMe()
      const { data, error } = await sb
        .from('invitations')
        .select('*')
        .eq('curator_id', me.id)
        .order('created_at', { ascending: false })
      if (error) translateError(error)
      return ((data ?? []) as InvitationRow[]).map(mapInvitation)
    },

    async invite(email) {
      const row = await rpc<InvitationRow>('invite_student', {
        p_email: email?.trim() || null,
      })
      return mapInvitation(row)
    },

    async revokeInvitation(id) {
      const sb = requireSupabase()
      const { error } = await sb.from('invitations').update({ status: 'revoked' }).eq('id', id)
      if (error) translateError(error)
    },

    async acceptInvitation(token) {
      return rpc<{ curatorName: string }>('accept_invitation', { p_token: token })
    },

    async remove(studentId) {
      await rpc<void>('remove_student', { p_student: studentId })
    },
  },

  dashboard: {
    async student(): Promise<StudentDashboard> {
      const me = await getMe()
      const [board, activity, notifications] = await Promise.all([
        getBoard(),
        getActivity(),
        listNotifications(),
      ])
      return buildStudentDashboard(me, board, activity, notifications)
    },

    async curator(): Promise<CuratorDashboard> {
      const [students, queue, analytics, activity, notifications] = await Promise.all([
        rpc<StudentSummary[]>('get_students'),
        rpc<ReviewItem[]>('get_review_queue'),
        rpc<AnalyticsMetrics>('get_analytics', {}),
        getActivity(),
        listNotifications(),
      ])
      return buildCuratorDashboard(students, queue, analytics, activity, notifications)
    },
  },

  analytics: {
    async get(filters) {
      return rpc<AnalyticsMetrics>('get_analytics', {
        p_from: filters.from ?? null,
        p_to: filters.to ?? null,
        p_student: filters.studentId ?? null,
      })
    },
  },

  notifications: {
    async list() {
      return listNotifications()
    },

    async markRead(id) {
      const sb = requireSupabase()
      const { error } = await sb
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id)
      if (error) translateError(error)
    },

    async markAllRead() {
      const sb = requireSupabase()
      const me = await getMe()
      const { error } = await sb
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', me.id)
        .is('read_at', null)
      if (error) translateError(error)
    },
  },

  async search(query) {
    return rpc<{ cards: CardWithMeta[]; students: Profile[] }>('search_cards', {
      p_query: query,
    })
  },

  reminders: {
    async run() {
      return rpc<number>('run_reminders')
    },
  },

  realtime: {
    subscribe(callback) {
      const sb = requireSupabase()
      const channel = sb
        .channel('vector-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () =>
          callback(),
        )
        .on('postgres_changes', { event: '*', schema: 'public', table: 'cards' }, () =>
          callback(),
        )
        .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () =>
          callback(),
        )
        .subscribe()
      return () => {
        void sb.removeChannel(channel)
      }
    },
  },
}

export const supabaseAdapter = supabaseApi
