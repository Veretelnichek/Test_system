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
  Profile,
  ReviewItem,
  SignUpInput,
  StudentDashboard,
  StudentSummary,
} from '@/types'

export interface SignUpResult {
  session: AuthSession | null
  requiresEmailConfirmation: boolean
  pendingApproval: boolean
}

export interface ModuleInput {
  title: string
  description?: string
  color?: string
}

export interface CardInput {
  moduleId: string
  title: string
  description: string
  deadline?: string | null
}

export interface Api {
  mode: 'local' | 'supabase'
  auth: {
    getSession(): Promise<AuthSession | null>
    signIn(email: string, password: string): Promise<AuthSession>
    signUp(input: SignUpInput): Promise<SignUpResult>
    signOut(): Promise<void>
    requestPasswordReset(email: string): Promise<{ devLink?: string }>
    updatePassword(password: string, token?: string | null): Promise<void>
    resendConfirmation(email: string): Promise<void>
    onAuthStateChange(callback: (session: AuthSession | null) => void): () => void
  }
  profile: {
    update(input: { firstName: string; lastName: string; avatarUrl?: string | null }): Promise<Profile>
  }
  boards: {
    my(): Promise<BoardData>
    forStudent(studentId: string): Promise<BoardData>
    list(): Promise<BoardSummary[]>
  }
  modules: {
    create(boardId: string, input: ModuleInput): Promise<Module>
    update(moduleId: string, input: Partial<ModuleInput>): Promise<Module>
    remove(moduleId: string): Promise<void>
  }
  cards: {
    list(boardId: string): Promise<CardWithMeta[]>
    get(cardId: string): Promise<CardDetail>
    create(input: CardInput): Promise<Card>
    update(cardId: string, input: Partial<CardInput>): Promise<Card>
    move(cardId: string, toStatus: CardStatus, comment?: string): Promise<void>
    addComment(cardId: string, text: string): Promise<Comment>
  }
  reviews: {
    queue(): Promise<ReviewItem[]>
    decide(cardId: string, decision: 'approve' | 'return', comment?: string): Promise<void>
  }
  students: {
    list(): Promise<StudentSummary[]>
    invitations(): Promise<Invitation[]>
    invite(email?: string): Promise<Invitation>
    revokeInvitation(id: string): Promise<void>
    acceptInvitation(token: string): Promise<{ curatorName: string }>
    remove(studentId: string): Promise<void>
  }
  dashboard: {
    student(): Promise<StudentDashboard>
    curator(): Promise<CuratorDashboard>
  }
  analytics: {
    get(filters: AnalyticsFilters): Promise<AnalyticsMetrics>
  }
  notifications: {
    list(): Promise<AppNotification[]>
    markRead(id: string): Promise<void>
    markAllRead(): Promise<void>
  }
  search(query: string): Promise<{ cards: CardWithMeta[]; students: Profile[] }>
  reminders: {
    run(): Promise<number>
  }
  realtime: {
    subscribe(callback: () => void): () => void
  }
  resetDemoData?(): void
}
