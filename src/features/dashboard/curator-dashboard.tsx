import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  MessageSquare,
  Timer,
  TriangleAlert,
  Users,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Page, PageHeader } from '@/features/layout/page'
import { Avatar, Badge, EmptyState, Panel, PanelHeader, Progress, Skeleton } from '@/components/ui/data'
import { Button } from '@/components/ui/button'
import { api } from '@/services/api'
import { qk, INVALIDATION_KEYS } from '@/lib/query-keys'
import { REVIEW_OVERDUE_HOURS } from '@/lib/constants'
import { cn, timeAgo } from '@/lib/utils'
import type { ReviewItem } from '@/types'

function formatHours(value: number | null) {
  if (value === null || Number.isNaN(value)) return '—'
  if (value < 1) return `${Math.round(value * 60)} мин`
  if (value < 24) return `${value.toFixed(1)} ч`
  return `${(value / 24).toFixed(1)} д`
}

function Metric({
  label,
  value,
  icon,
  tone,
  hint,
}: {
  label: string
  value: string | number
  icon: React.ReactNode
  tone: string
  hint?: string
}) {
  return (
    <div className="panel p-4">
      <div className="flex items-start justify-between">
        <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg border', tone)}>
          {icon}
        </span>
        {hint ? <span className="text-[10.5px] text-mist-500">{hint}</span> : null}
      </div>
      <p className="mt-3 text-[24px] font-semibold leading-none tracking-[-0.03em] text-white">
        {value}
      </p>
      <p className="mt-1.5 text-[11.5px] text-mist-400">{label}</p>
    </div>
  )
}

function QueueRow({ item, onOpen, onApprove, approving }: {
  item: ReviewItem
  onOpen: () => void
  onApprove: () => void
  approving: boolean
}) {
  const overdue = item.waitingHours > REVIEW_OVERDUE_HOURS
  return (
    <div
      className={cn(
        'group flex flex-col gap-2 rounded-xl border px-3 py-3 transition-colors sm:flex-row sm:items-center',
        overdue
          ? 'border-accent-500/30 bg-accent-500/[0.055]'
          : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]',
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Avatar name={item.studentName} src={item.assigneeAvatar} size="sm" />
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onOpen}
            className="block max-w-full truncate text-left text-[12.5px] font-medium text-mist-100 hover:text-white"
          >
            {item.title}
          </button>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px] text-mist-500">
            <span className="truncate">{item.studentName}</span>
            <span>·</span>
            <span className="truncate">{item.moduleTitle}</span>
            {item.commentsCount > 0 ? (
              <span className="inline-flex items-center gap-1">
                · <MessageSquare className="h-2.5 w-2.5" /> {item.commentsCount}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:shrink-0">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10.5px] font-semibold',
            overdue
              ? 'border-accent-500/30 bg-accent-500/10 text-accent-300'
              : 'border-white/10 bg-white/[0.04] text-mist-300',
          )}
        >
          {overdue ? <AlertTriangle className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}
          {item.waitingHours} ч
        </span>
        <Button
          size="sm"
          variant="secondary"
          onClick={onApprove}
          loading={approving}
          className="border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-200 hover:bg-emerald-500/[0.14]"
        >
          <Check className="h-3.5 w-3.5" />
          Принять
        </Button>
        <Button size="sm" variant="ghost" onClick={onOpen} aria-label="Открыть задание">
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

export function CuratorDashboard() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: qk.curatorDashboard,
    queryFn: () => api.dashboard.curator(),
  })

  const approve = useMutation({
    mutationFn: (cardId: string) => api.reviews.decide(cardId, 'approve'),
    onSuccess: () => {
      INVALIDATION_KEYS.forEach((key) => {
        void queryClient.invalidateQueries({ queryKey: key })
      })
      toast.success('Задание принято')
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Не удалось принять задание')
    },
  })

  if (isLoading) {
    return (
      <Page>
        <Skeleton className="mb-2 h-8 w-48" />
        <Skeleton className="mb-6 h-4 w-96 max-w-full" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[104px] rounded-2xl" />
          ))}
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <Skeleton className="h-[330px] rounded-2xl" />
          <Skeleton className="h-[330px] rounded-2xl" />
        </div>
      </Page>
    )
  }

  if (isError || !data) {
    return (
      <Page>
        <EmptyState
          icon={<TriangleAlert className="h-5 w-5 text-accent-300" />}
          title="Не удалось загрузить обзор"
          description="Проверьте соединение и попробуйте снова."
          action={<Button onClick={() => void refetch()}>Повторить</Button>}
        />
      </Page>
    )
  }

  const overdueQueue = data.reviewQueue.filter((q) => q.waitingHours > REVIEW_OVERDUE_HOURS)

  return (
    <Page>
      <PageHeader
        eyebrow={<span className="eyebrow">Кураторство</span>}
        title="Обзор образовательного процесса"
        description="Сначала — проверки, затем всё остальное. Данные обновляются по мере работы учеников."
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/app/analytics')}>
              <BarChart3 className="h-4 w-4" />
              Аналитика
            </Button>
            <Button
              variant={overdueQueue.length ? 'accent' : 'primary'}
              onClick={() => navigate('/app/reviews')}
            >
              <ClipboardCheck className="h-4 w-4" />
              Очередь проверки
              {data.inReview > 0 ? (
                <span className="ml-0.5 rounded-md bg-white/20 px-1.5 py-0.5 text-[10.5px] font-bold">
                  {data.inReview}
                </span>
              ) : null}
            </Button>
          </>
        }
      />

      {overdueQueue.length ? (
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-accent-500/30 bg-accent-500/[0.07] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-accent-500/35 bg-accent-500/15 text-accent-300">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[13px] font-semibold text-accent-100">
                {overdueQueue.length} проверк
                {overdueQueue.length === 1 ? 'а' : overdueQueue.length < 5 ? 'и' : ''} ждёт более 24 часов
              </p>
              <p className="mt-0.5 text-[12px] text-mist-300">
                Ученики ждут обратную связь. Начните с самого долгого ожидания.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="accent"
            className="shrink-0"
            onClick={() => navigate('/app/reviews?overdue=1')}
          >
            Разобрать очередь
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Metric
          label="Активные ученики"
          value={data.activeStudents}
          icon={<Users className="h-4 w-4" />}
          tone="border-brand-500/25 bg-brand-500/[0.1] text-brand-300"
          hint="закреплены"
        />
        <Metric
          label="Всего заданий"
          value={data.totalCards}
          icon={<ClipboardList className="h-4 w-4" />}
          tone="border-white/10 bg-white/[0.04] text-mist-300"
          hint="на досках"
        />
        <Metric
          label="На проверке"
          value={data.inReview}
          icon={<ClipboardCheck className="h-4 w-4" />}
          tone="border-brand-400/25 bg-brand-400/[0.09] text-brand-200"
          hint="сейчас"
        />
        <Metric
          label="Просроченные проверки"
          value={data.overdueReviews}
          icon={<AlertTriangle className="h-4 w-4" />}
          tone={
            data.overdueReviews
              ? 'border-accent-500/30 bg-accent-500/[0.12] text-accent-300'
              : 'border-white/10 bg-white/[0.04] text-mist-400'
          }
          hint="> 24 ч"
        />
        <Metric
          label="Среднее время проверки"
          value={formatHours(data.avgReviewHours)}
          icon={<Timer className="h-4 w-4" />}
          tone="border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-300"
          hint="за период"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Panel>
          <PanelHeader
            title="Ждут проверки"
            description="Сначала задания с самым долгим ожиданием"
            icon={<ClipboardCheck className="h-4 w-4" />}
            action={
              <Button variant="ghost" size="sm" onClick={() => navigate('/app/reviews')}>
                Вся очередь
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            }
          />
          <div className="space-y-2 p-4 pt-3">
            {data.reviewQueue.length ? (
              data.reviewQueue
                .slice(0, 5)
                .map((item) => (
                  <QueueRow
                    key={item.id}
                    item={item}
                    onOpen={() => navigate(`/app/reviews?card=${item.id}`)}
                    onApprove={() => approve.mutate(item.id)}
                    approving={approve.isPending && approve.variables === item.id}
                  />
                ))
            ) : (
              <EmptyState
                compact
                icon={<CheckCircle2 className="h-4 w-4 text-emerald-300" />}
                title="Очередь пуста"
                description="Все отправленные задания проверены."
              />
            )}
          </div>
        </Panel>

        <Panel className="flex flex-col">
          <PanelHeader
            title="Динамика выполнения"
            description="Отправки и принятые задания за 7 дней"
            icon={<BarChart3 className="h-4 w-4" />}
          />
          <div className="flex flex-1 flex-col px-2 pb-4 pt-2">
            <div className="mb-1 flex items-center gap-4 px-3 text-[10.5px] text-mist-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-brand-500" />
                На проверку
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-emerald-400" />
                Принято
              </span>
            </div>
            <div className="h-[210px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.weekly} barGap={3} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value: string) => value.slice(8, 10)}
                    tick={{ fill: '#7C90AE', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    dy={6}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: '#7C90AE', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={34}
                  />
                  <ReTooltip
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                    contentStyle={{
                      background: '#111F45',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 10,
                      fontSize: 11,
                      color: '#E6EDF7',
                    }}
                    labelFormatter={(value) => `Дата: ${value}`}
                  />
                  <Bar dataKey="submitted" name="На проверку" fill="#0297DE" radius={[3, 3, 0, 0]} maxBarSize={14} />
                  <Bar dataKey="completed" name="Принято" fill="#34D399" radius={[3, 3, 0, 0]} maxBarSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-auto grid grid-cols-2 gap-2 px-3 pt-2">
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
                <p className="text-[10px] text-mist-500">Принято за неделю</p>
                <p className="mt-0.5 text-[16px] font-semibold text-white">{data.completedThisWeek}</p>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
                <p className="text-[10px] text-mist-500">Всего на проверке</p>
                <p className="mt-0.5 text-[16px] font-semibold text-white">{data.inReview}</p>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Panel>
          <PanelHeader
            title="Ученики и прогресс"
            description="Реальный процент завершённых заданий"
            icon={<Users className="h-4 w-4" />}
            action={
              <Button variant="ghost" size="sm" onClick={() => navigate('/app/students')}>
                Все ученики
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            }
          />
          <div className="divide-y divide-white/[0.05] px-4 pb-2 pt-1">
            {data.students.length ? (
              data.students.map((student) => (
                <button
                  key={student.profile.id}
                  type="button"
                  onClick={() => navigate(`/app/boards/${student.profile.id}`)}
                  className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-white/[0.02]"
                >
                  <Avatar
                    name={`${student.profile.firstName} ${student.profile.lastName}`}
                    src={student.profile.avatarUrl}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[12.5px] font-medium text-mist-100">
                        {student.profile.firstName} {student.profile.lastName}
                      </p>
                      <span className="shrink-0 text-[11px] font-semibold text-mist-300">
                        {student.percent}%
                      </span>
                    </div>
                    <Progress value={student.percent} size="sm" className="mt-1.5" />
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-mist-500">
                      <span>{student.done} готово</span>
                      <span>·</span>
                      <span>{student.inProgress} в работе</span>
                      {student.review > 0 ? (
                        <>
                          <span>·</span>
                          <span className="text-brand-300">{student.review} на проверке</span>
                        </>
                      ) : null}
                      {student.overdue > 0 ? (
                        <>
                          <span>·</span>
                          <span className="text-accent-300">{student.overdue} просрочено</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-mist-600" />
                </button>
              ))
            ) : (
              <EmptyState
                compact
                icon={<Users className="h-4 w-4" />}
                title="Учеников пока нет"
                description="Пригласите первого ученика по коду."
                action={
                  <Button size="sm" onClick={() => navigate('/app/students')}>
                    Пригласить
                  </Button>
                }
              />
            )}
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Последние действия"
            description="Что происходило на досках учеников"
            icon={<Clock3 className="h-4 w-4" />}
          />
          <div className="space-y-1 p-3 pt-2">
            {data.recentActivity.length ? (
              data.recentActivity.map((event) => (
                <div key={event.id} className="flex items-start gap-2.5 rounded-xl px-2 py-2">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
                    {event.toStatus === 'review' ? (
                      <ClipboardCheck className="h-3.5 w-3.5 text-brand-300" />
                    ) : event.toStatus === 'done' ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                    ) : (
                      <Clock3 className="h-3.5 w-3.5 text-mist-300" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] leading-snug text-mist-200">
                      <span className="font-medium text-white">{event.actorName}</span>{' '}
                      {event.toStatus === 'review'
                        ? 'отправил(а) на проверку'
                        : event.toStatus === 'done'
                          ? 'принял(а) задание'
                          : event.toStatus === 'revision'
                            ? 'вернул(а) на доработку'
                            : 'изменил(а) статус'}{' '}
                      <span className="text-mist-300">«{event.cardTitle}»</span>
                    </p>
                    <p className="mt-0.5 text-[10.5px] text-mist-600">
                      {event.studentName} · {timeAgo(event.createdAt)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                compact
                icon={<Clock3 className="h-4 w-4" />}
                title="Пока нет действий"
                description="Активность учеников появится здесь."
              />
            )}
          </div>
        </Panel>
      </div>

      <div className="mt-5 flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.015] px-4 py-3">
        <p className="text-[11.5px] text-mist-500">
          Метрики рассчитываются по событиям статусов. Просроченной считается проверка дольше{' '}
          {REVIEW_OVERDUE_HOURS} часов.
        </p>
        <Badge tone="muted" className="hidden sm:inline-flex">
          Realtime
        </Badge>
      </div>
    </Page>
  )
}
