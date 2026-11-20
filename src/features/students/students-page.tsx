import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Copy,
  Link2,
  Mail,
  Plus,
  Search,
  Ticket,
  TriangleAlert,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react'
import { Page, PageHeader } from '@/features/layout/page'
import { Avatar, Badge, EmptyState, Panel, Progress, Skeleton } from '@/components/ui/data'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/form'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from '@/components/ui/overlay'
import { api } from '@/services/api'
import { qk, INVALIDATION_KEYS } from '@/lib/query-keys'
import { cn, formatDate, timeAgo } from '@/lib/utils'
import type { Invitation, StudentSummary } from '@/types'

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success('Скопировано в буфер обмена')
  } catch {
    toast.error('Не удалось скопировать — выделите текст вручную')
  }
}

function invitationStatus(status: Invitation['status']) {
  switch (status) {
    case 'pending':
      return <Badge tone="brand">Ожидает</Badge>
    case 'accepted':
      return <Badge tone="success">Принято</Badge>
    case 'revoked':
      return <Badge tone="muted">Отозвано</Badge>
    case 'expired':
      return <Badge tone="accent">Истекло</Badge>
  }
}

export function StudentsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [createdInvitation, setCreatedInvitation] = useState<Invitation | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [unlinkStudent, setUnlinkStudent] = useState<StudentSummary | null>(null)

  const studentsQuery = useQuery({
    queryKey: qk.students,
    queryFn: () => api.students.list(),
  })
  const invitationsQuery = useQuery({
    queryKey: qk.invitations,
    queryFn: () => api.students.invitations(),
  })

  const invalidate = () => {
    INVALIDATION_KEYS.forEach((key) => {
      void queryClient.invalidateQueries({ queryKey: key })
    })
  }

  const invite = useMutation({
    mutationFn: () => api.students.invite(email.trim() || undefined),
    onSuccess: (invitation) => {
      setCreatedInvitation(invitation)
      setEmail('')
      setInviteError(null)
      invalidate()
    },
    onError: (error) => {
      setInviteError(error instanceof Error ? error.message : 'Не удалось создать приглашение')
    },
  })

  const revoke = useMutation({
    mutationFn: (id: string) => api.students.revokeInvitation(id),
    onSuccess: () => {
      invalidate()
      toast.success('Приглашение отозвано')
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Не удалось отозвать приглашение'),
  })

  const remove = useMutation({
    mutationFn: (studentId: string) => api.students.remove(studentId),
    onSuccess: () => {
      invalidate()
      setUnlinkStudent(null)
      toast.success('Ученик откреплён')
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Не удалось открепить ученика'),
  })

  const students = studentsQuery.data ?? []
  const invitations = invitationsQuery.data ?? []
  const pendingInvitations = invitations.filter((item) => item.status === 'pending')
  const value = query.trim().toLowerCase()
  const filtered = students.filter((student) =>
    value
      ? `${student.profile.firstName} ${student.profile.lastName} ${student.profile.email}`
          .toLowerCase()
          .includes(value)
      : true,
  )

  const averageProgress = students.length
    ? Math.round(students.reduce((acc, s) => acc + s.percent, 0) / students.length)
    : 0
  const totalReview = students.reduce((acc, s) => acc + s.review, 0)
  const totalOverdue = students.reduce((acc, s) => acc + s.overdue, 0)

  const inviteLink = createdInvitation
    ? `${window.location.origin}/register?invite=${createdInvitation.token}`
    : ''

  const openInvite = () => {
    setCreatedInvitation(null)
    setEmail('')
    setInviteError(null)
    setInviteOpen(true)
  }

  return (
    <Page>
      <PageHeader
        eyebrow={<span className="eyebrow">Кураторство</span>}
        title="Ученики"
        description="Закреплённые ученики, их прогресс и приглашения. Доступ к чужим ученикам закрыт политиками RLS."
        actions={
          <Button onClick={openInvite}>
            <UserPlus className="h-4 w-4" />
            Пригласить ученика
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: 'Закреплено учеников',
            value: students.length,
            icon: <Users className="h-4 w-4" />,
            tone: 'border-brand-500/25 bg-brand-500/[0.1] text-brand-300',
          },
          {
            label: 'Средний прогресс',
            value: `${averageProgress}%`,
            icon: <ArrowRight className="h-4 w-4" />,
            tone: 'border-white/10 bg-white/[0.04] text-mist-300',
          },
          {
            label: 'Ждут проверки',
            value: totalReview,
            icon: <Ticket className="h-4 w-4" />,
            tone: 'border-brand-400/25 bg-brand-400/[0.08] text-brand-200',
          },
          {
            label: 'Просрочено заданий',
            value: totalOverdue,
            icon: <AlertTriangle className="h-4 w-4" />,
            tone: totalOverdue
              ? 'border-accent-500/30 bg-accent-500/[0.1] text-accent-300'
              : 'border-white/10 bg-white/[0.04] text-mist-400',
          },
        ].map((metric) => (
          <div key={metric.label} className="panel flex items-center gap-3 p-3.5">
            <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl border', metric.tone)}>
              {metric.icon}
            </span>
            <div>
              <p className="text-[19px] font-semibold leading-none text-white">{metric.value}</p>
              <p className="mt-1 text-[11px] text-mist-400">{metric.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-[300px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mist-500" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по имени или email…"
            className="pl-8"
            aria-label="Поиск учеников"
          />
        </div>
        <span className="text-[11.5px] text-mist-500">
          Найдено: <b className="text-mist-200">{filtered.length}</b>
        </span>
      </div>

      {studentsQuery.isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[76px] rounded-2xl" />
          ))}
        </div>
      ) : studentsQuery.isError ? (
        <EmptyState
          icon={<TriangleAlert className="h-5 w-5 text-accent-300" />}
          title="Не удалось загрузить учеников"
          description="Проверьте соединение и повторите."
          action={<Button onClick={() => void studentsQuery.refetch()}>Повторить</Button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title={students.length ? 'Ничего не найдено' : 'Пока нет учеников'}
          description={
            students.length
              ? 'Попробуйте изменить поисковый запрос.'
              : 'Пригласите первого ученика: отправьте ему код или ссылку для регистрации.'
          }
          action={
            students.length ? undefined : (
              <Button onClick={openInvite}>
                <UserPlus className="h-4 w-4" />
                Пригласить ученика
              </Button>
            )
          }
        />
      ) : (
        <Panel className="overflow-hidden">
          <div className="hidden grid-cols-[minmax(200px,1.4fr)_minmax(160px,1fr)_120px_120px_130px_92px] gap-3 border-b border-white/[0.07] px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-mist-500 lg:grid">
            <span>Ученик</span>
            <span>Прогресс</span>
            <span>Задания</span>
            <span>Проверки</span>
            <span>Активность</span>
            <span />
          </div>
          {filtered.map((student) => (
            <div
              key={student.profile.id}
              className="group flex flex-col gap-3 border-b border-white/[0.05] px-4 py-3 last:border-0 lg:grid lg:grid-cols-[minmax(200px,1.4fr)_minmax(160px,1fr)_120px_120px_130px_92px] lg:items-center lg:gap-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar
                  name={`${student.profile.firstName} ${student.profile.lastName}`}
                  src={student.profile.avatarUrl}
                  size="md"
                />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-mist-100">
                    {student.profile.firstName} {student.profile.lastName}
                  </p>
                  <p className="truncate text-[11px] text-mist-500">{student.profile.email}</p>
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-[10.5px] text-mist-500">
                  <span>{student.percent}%</span>
                  <span>
                    {student.done}/{student.total}
                  </span>
                </div>
                <Progress
                  value={student.percent}
                  tone={student.overdue > 0 ? 'accent' : 'brand'}
                  size="sm"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5 lg:block">
                <Badge tone="muted" className="lg:hidden">
                  {student.total} заданий
                </Badge>
                <span className="hidden text-[12px] text-mist-200 lg:block">{student.total}</span>
                <span className="hidden text-[10.5px] text-mist-500 lg:block">
                  {student.inProgress} в работе
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {student.review > 0 ? (
                  <Badge tone="brand">{student.review} на проверке</Badge>
                ) : (
                  <span className="text-[11px] text-mist-600">—</span>
                )}
                {student.overdue > 0 ? (
                  <Badge tone="accent">{student.overdue} просрочено</Badge>
                ) : null}
              </div>

              <div className="text-[11px] text-mist-400">
                {student.lastActivityAt ? timeAgo(student.lastActivityAt) : 'Нет активности'}
              </div>

              <div className="flex items-center gap-1.5 lg:justify-end">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate(`/app/boards/${student.profile.id}`)}
                >
                  Доска
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
                <button
                  type="button"
                  onClick={() => setUnlinkStudent(student)}
                  className="icon-btn h-8 w-8 text-mist-500 hover:text-accent-300"
                  aria-label={`Открепить ${student.profile.firstName} ${student.profile.lastName}`}
                  title="Открепить ученика"
                >
                  <UserMinus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </Panel>
      )}

      <div className="mt-6">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-[14.5px] font-semibold text-white">Приглашения</h2>
            <p className="mt-0.5 text-[12px] text-mist-400">
              Код действует 7 дней. Ученик вводит его при регистрации или в профиле.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={openInvite}>
            <Plus className="h-3.5 w-3.5" />
            Новое
          </Button>
        </div>

        {invitationsQuery.isLoading ? (
          <Skeleton className="h-24 rounded-2xl" />
        ) : invitations.length === 0 ? (
          <EmptyState
            compact
            icon={<Link2 className="h-4 w-4" />}
            title="Приглашений пока нет"
            description="Создайте код и передайте его ученику."
          />
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {invitations.slice(0, 6).map((invitation) => (
              <div
                key={invitation.id}
                className="panel flex items-center gap-3 p-3"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-mist-300">
                  <Ticket className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-[13px] font-semibold tracking-wider text-white">
                      {invitation.token}
                    </p>
                    {invitationStatus(invitation.status)}
                  </div>
                  <p className="mt-0.5 truncate text-[10.5px] text-mist-500">
                    {invitation.email ?? 'Код без привязки к email'} · до {formatDate(invitation.expiresAt)}
                  </p>
                </div>
                {invitation.status === 'pending' ? (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        void copyText(`${window.location.origin}/register?invite=${invitation.token}`)
                      }
                      className="icon-btn h-8 w-8"
                      aria-label="Скопировать ссылку приглашения"
                      title="Скопировать ссылку"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => revoke.mutate(invitation.id)}
                      className="icon-btn h-8 w-8 text-mist-500 hover:text-accent-300"
                      aria-label="Отозвать приглашение"
                      title="Отозвать"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : null}
              </div>
            ))}
          </div>
        )}
        {pendingInvitations.length > 0 ? (
          <p className="mt-2 text-[10.5px] text-mist-500">
            Активных приглашений: {pendingInvitations.length}. Отправка email не выполняется
            автоматически — передайте код или ссылку ученику.
          </p>
        ) : null}
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader
            title={createdInvitation ? 'Приглашение создано' : 'Пригласить ученика'}
            description={
              createdInvitation
                ? 'Передайте ученику код или ссылку. После регистрации он будет закреплён за вами.'
                : 'Можно привязать приглашение к email — тогда код сработает только для него.'
            }
          />
          {createdInvitation ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-brand-500/25 bg-brand-500/[0.07] p-4 text-center">
                <p className="text-[10.5px] uppercase tracking-[0.12em] text-mist-400">Код приглашения</p>
                <p className="mt-1 font-mono text-[26px] font-semibold tracking-[0.2em] text-white">
                  {createdInvitation.token}
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2"
                  onClick={() => void copyText(createdInvitation.token)}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Скопировать код
                </Button>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                <p className="text-[10.5px] text-mist-500">Ссылка для регистрации</p>
                <div className="mt-1 flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate font-mono text-[11px] text-brand-300">
                    {inviteLink}
                  </p>
                  <Button size="sm" variant="ghost" onClick={() => void copyText(inviteLink)}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {createdInvitation.email ? (
                <p className="flex items-center gap-1.5 text-[11px] text-mist-400">
                  <Mail className="h-3.5 w-3.5" />
                  Привязано к {createdInvitation.email}
                </p>
              ) : null}
              <DialogFooter>
                <Button variant="secondary" onClick={openInvite}>
                  Создать ещё
                </Button>
                <Button onClick={() => setInviteOpen(false)}>
                  <Check className="h-4 w-4" />
                  Готово
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                setInviteError(null)
                invite.mutate()
              }}
              className="space-y-3"
            >
              <div>
                <label htmlFor="invite-email" className="label">
                  Email ученика <span className="font-normal text-mist-500">(необязательно)</span>
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-500" />
                  <Input
                    id="invite-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="student@example.com"
                    className="pl-9"
                  />
                </div>
                <p className="hint mt-1.5">
                  Если email указан, код сработает только для этого адреса.
                </p>
              </div>
              {inviteError ? (
                <p className="text-[12px] text-accent-300">{inviteError}</p>
              ) : null}
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setInviteOpen(false)}>
                  Отмена
                </Button>
                <Button type="submit" loading={invite.isPending}>
                  <Plus className="h-4 w-4" />
                  Создать приглашение
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(unlinkStudent)} onOpenChange={(open) => (open ? null : setUnlinkStudent(null))}>
        <DialogContent>
          <DialogHeader
            title="Открепить ученика?"
            description={
              unlinkStudent
                ? `${unlinkStudent.profile.firstName} ${unlinkStudent.profile.lastName} потеряет доступ к вашим проверкам. Доска, задания и история сохранятся.`
                : undefined
            }
          />
          <p className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-[12px] leading-relaxed text-mist-400">
            Ученик сможет присоединиться к другому куратору по новому коду приглашения. Это
            соответствует сценарию смены куратора.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setUnlinkStudent(null)}>
              Отмена
            </Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() => unlinkStudent && remove.mutate(unlinkStudent.profile.id)}
            >
              <UserMinus className="h-4 w-4" />
              Открепить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  )
}
