import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  RefreshCw,
  Timer,
  TrendingUp,
  Users,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Page, PageHeader } from '@/features/layout/page'
import { Avatar, EmptyState, Panel, PanelHeader, Progress, Skeleton } from '@/components/ui/data'
import { Button } from '@/components/ui/button'
import { SimpleSelect } from '@/components/ui/form'
import { api } from '@/services/api'
import { qk } from '@/lib/query-keys'
import { CARD_STATUSES, REVIEW_OVERDUE_HOURS } from '@/lib/constants'
import { cn, formatDate } from '@/lib/utils'
import type { AnalyticsFilters, CardStatus } from '@/types'

const STATUS_COLORS: Record<CardStatus, string> = {
  backlog: '#7C90AE',
  in_progress: '#0297DE',
  review: '#5AA9E6',
  revision: '#FC734D',
  done: '#34D399',
}

const TOOLTIP_STYLE = {
  background: '#111F45',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  fontSize: 11,
  color: '#E6EDF7',
} as const

function formatHours(value: number | null) {
  if (value === null || Number.isNaN(value)) return '—'
  if (value < 1) return `${Math.round(value * 60)} мин`
  if (value < 24) return `${value.toFixed(1)} ч`
  return `${(value / 24).toFixed(1)} д`
}

function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString()
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
      <div className="flex items-start justify-between gap-2">
        <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg border', tone)}>
          {icon}
        </span>
        {hint ? (
          <span className="text-right text-[10px] leading-tight text-mist-500">{hint}</span>
        ) : null}
      </div>
      <p className="mt-3 text-[24px] font-semibold leading-none tracking-[-0.03em] text-white">
        {value}
      </p>
      <p className="mt-1.5 text-[11.5px] text-mist-400">{label}</p>
    </div>
  )
}

export function AnalyticsPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  const period = ['7', '30', '90'].includes(params.get('period') ?? '')
    ? (params.get('period') as string)
    : '30'
  const studentId = params.get('student') ?? ''

  const filters = useMemo<AnalyticsFilters>(
    () => ({
      from: isoDaysAgo(Number(period)),
      to: new Date().toISOString(),
      studentId: studentId || undefined,
    }),
    [period, studentId],
  )

  const analyticsQuery = useQuery({
    queryKey: qk.analytics(filters),
    queryFn: () => api.analytics.get(filters),
  })

  const studentsQuery = useQuery({
    queryKey: qk.students,
    queryFn: () => api.students.list(),
  })

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const data = analyticsQuery.data
  const students = studentsQuery.data ?? []

  if (analyticsQuery.isLoading) {
    return (
      <Page>
        <Skeleton className="mb-2 h-8 w-56" />
        <Skeleton className="mb-6 h-4 w-[420px] max-w-full" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-[104px] rounded-2xl" />
          ))}
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
          <Skeleton className="h-[320px] rounded-2xl" />
          <Skeleton className="h-[320px] rounded-2xl" />
        </div>
      </Page>
    )
  }

  if (analyticsQuery.isError || !data) {
    return (
      <Page>
        <EmptyState
          icon={<AlertTriangle className="h-5 w-5 text-accent-300" />}
          title="Не удалось загрузить аналитику"
          description="Проверьте соединение и попробуйте снова."
          action={<Button onClick={() => void analyticsQuery.refetch()}>Повторить</Button>}
        />
      </Page>
    )
  }

  const totalByStatus = data.byStatus.reduce((acc, item) => acc + item.count, 0)
  const timeline = data.timeline.map((point) => ({
    ...point,
    label: `${point.date.slice(8, 10)}.${point.date.slice(5, 7)}`,
  }))
  const reviewTimes = data.reviewTimes
    .filter((item) => item.avgHours !== null)
    .sort((a, b) => (b.avgHours ?? 0) - (a.avgHours ?? 0))
  const statusDurations = data.statusDurations
    .slice()
    .sort((a, b) => b.avgHours - a.avgHours)
    .map((item) => ({
      ...item,
      title: CARD_STATUSES.find((status) => status.id === item.status)?.title ?? item.status,
    }))

  return (
    <Page>
      <PageHeader
        eyebrow="Кураторство"
        title="Аналитика обучения"
        description="Метрики по реальным событиям: цикл выполнения, время проверки, конверсия и просрочки."
        actions={
          <Button
            variant="secondary"
            onClick={() => void analyticsQuery.refetch()}
            loading={analyticsQuery.isFetching}
          >
            <RefreshCw className="h-4 w-4" />
            Обновить
          </Button>
        }
      />

      <div className="panel mb-4 flex flex-wrap items-center gap-2 p-2.5">
        <div className="flex items-center rounded-xl border border-white/[0.09] bg-white/[0.03] p-0.5">
          {[
            { value: '7', label: '7 дней' },
            { value: '30', label: '30 дней' },
            { value: '90', label: '90 дней' },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setParam('period', option.value === '30' ? '' : option.value)}
              className={cn(
                'rounded-[9px] px-3 py-1.5 text-[12px] font-medium transition-colors',
                period === option.value
                  ? 'bg-brand-500/15 text-brand-200'
                  : 'text-mist-400 hover:text-mist-100',
              )}
              aria-pressed={period === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>

        <SimpleSelect
          value={studentId || 'all'}
          onValueChange={(value) => setParam('student', value === 'all' ? '' : value)}
          options={[
            { value: 'all', label: 'Все ученики' },
            ...students.map((student) => ({
              value: student.profile.id,
              label: `${student.profile.firstName} ${student.profile.lastName}`,
            })),
          ]}
          className="h-9 w-[180px] text-[12.5px]"
          aria-label="Фильтр по ученику"
        />

        <span className="ml-auto text-[11px] text-mist-500">
          Период: {formatDate(filters.from)} — {formatDate(filters.to)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Metric
          label="Медианный цикл"
          value={formatHours(data.medianCycleHours)}
          icon={<Clock3 className="h-4 w-4" />}
          tone="border-brand-500/25 bg-brand-500/[0.1] text-brand-300"
          hint="в работе → проверка"
        />
        <Metric
          label="Среднее время проверки"
          value={formatHours(data.avgReviewHours)}
          icon={<Timer className="h-4 w-4" />}
          tone="border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-300"
          hint="по решениям куратора"
        />
        <Metric
          label="Конверсия в проверку"
          value={`${data.conversionRate}%`}
          icon={<TrendingUp className="h-4 w-4" />}
          tone="border-violet-500/25 bg-violet-500/[0.1] text-violet-300"
          hint="взятые в работу"
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
          hint={`> ${REVIEW_OVERDUE_HOURS} ч`}
        />
        <Metric
          label="Принято заданий"
          value={data.completedTasks}
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-300"
          hint="за период"
        />
        <Metric
          label="Отправлено на проверку"
          value={data.submittedTasks}
          icon={<ClipboardCheck className="h-4 w-4" />}
          tone="border-white/10 bg-white/[0.04] text-mist-300"
          hint="за период"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Panel>
          <PanelHeader
            title="Динамика по дням"
            description="Созданные, отправленные на проверку и принятые задания"
            icon={<BarChart3 className="h-4 w-4" />}
          />
          <div className="px-2 pb-4 pt-3">
            <div className="mb-2 flex flex-wrap items-center gap-4 px-3 text-[10.5px] text-mist-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-brand-500" />
                Отправлено
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-emerald-400" />
                Принято
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-mist-500" />
                Создано
              </span>
            </div>
            <div className="h-[260px] w-full">
              {timeline.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeline} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="analyticsSubmitted" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0297DE" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#0297DE" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="analyticsCompleted" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34D399" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="#34D399" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: '#7C90AE', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      dy={6}
                      minTickGap={18}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: '#7C90AE', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      width={34}
                    />
                    <ReTooltip
                      contentStyle={TOOLTIP_STYLE}
                      labelFormatter={(value) => `Дата: ${value}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="created"
                      name="Создано"
                      stroke="#7C90AE"
                      strokeWidth={1.5}
                      fill="transparent"
                      dot={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="submitted"
                      name="Отправлено"
                      stroke="#0297DE"
                      strokeWidth={2}
                      fill="url(#analyticsSubmitted)"
                      dot={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="completed"
                      name="Принято"
                      stroke="#34D399"
                      strokeWidth={2}
                      fill="url(#analyticsCompleted)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState compact title="Нет данных за период" description="Измените период." />
              )}
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Задания по статусам"
            description={`Всего на досках: ${totalByStatus}`}
            icon={<ClipboardCheck className="h-4 w-4" />}
          />
          <div className="flex flex-col items-center gap-3 p-4 pt-2 sm:flex-row xl:flex-col">
            <div className="relative h-[170px] w-[170px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.byStatus.filter((item) => item.count > 0)}
                    dataKey="count"
                    nameKey="status"
                    innerRadius={54}
                    outerRadius={78}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {data.byStatus
                      .filter((item) => item.count > 0)
                      .map((item) => (
                        <Cell key={item.status} fill={STATUS_COLORS[item.status]} />
                      ))}
                  </Pie>
                  <ReTooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value, name) => [
                      value,
                      CARD_STATUSES.find((status) => status.id === name)?.title ?? String(name),
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[22px] font-semibold leading-none text-white">
                  {totalByStatus}
                </span>
                <span className="mt-1 text-[10px] text-mist-500">заданий</span>
              </div>
            </div>
            <div className="w-full space-y-1.5">
              {data.byStatus.map((item) => {
                const meta = CARD_STATUSES.find((status) => status.id === item.status)
                const share = totalByStatus ? Math.round((item.count / totalByStatus) * 100) : 0
                return (
                  <div key={item.status} className="flex items-center gap-2 text-[11.5px]">
                    <span
                      className="h-2 w-2 shrink-0 rounded-sm"
                      style={{ backgroundColor: STATUS_COLORS[item.status] }}
                    />
                    <span className="min-w-0 flex-1 truncate text-mist-300">{meta?.title}</span>
                    <span className="tabular-nums text-mist-500">{share}%</span>
                    <span className="w-6 text-right font-semibold tabular-nums text-mist-100">
                      {item.count}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Среднее время проверки по ученикам"
            description="От отправки на проверку до решения куратора"
            icon={<Timer className="h-4 w-4" />}
          />
          <div className="px-2 pb-4 pt-3">
            {reviewTimes.length ? (
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={reviewTimes}
                    layout="vertical"
                    margin={{ top: 4, right: 20, left: 4, bottom: 0 }}
                    barCategoryGap={10}
                  >
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fill: '#7C90AE', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value: number) => `${Math.round(value)}ч`}
                    />
                    <YAxis
                      type="category"
                      dataKey="studentName"
                      width={118}
                      tick={{ fill: '#AFC0D8', fontSize: 10.5 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <ReTooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(value) => [formatHours(Number(value)), 'Среднее время']}
                      cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                    />
                    <Bar dataKey="avgHours" fill="#0297DE" radius={[0, 4, 4, 0]} maxBarSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState
                compact
                icon={<Timer className="h-4 w-4" />}
                title="Проверок пока нет"
                description="Данные появятся после первых решений куратора."
              />
            )}
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Среднее время в статусе"
            description="Сколько задания проводят в каждом статусе"
            icon={<Clock3 className="h-4 w-4" />}
          />
          <div className="space-y-3 p-4 pt-3">
            {statusDurations.length ? (
              statusDurations.map((item) => {
                const max = Math.max(...statusDurations.map((entry) => entry.avgHours), 1)
                return (
                  <div key={item.status}>
                    <div className="mb-1 flex items-center justify-between text-[11.5px]">
                      <span className="inline-flex items-center gap-1.5 text-mist-300">
                        <span
                          className="h-2 w-2 rounded-sm"
                          style={{ backgroundColor: STATUS_COLORS[item.status] }}
                        />
                        {item.title}
                      </span>
                      <span className="font-semibold text-mist-100">
                        {formatHours(item.avgHours)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(2, (item.avgHours / max) * 100)}%`,
                          backgroundColor: STATUS_COLORS[item.status],
                        }}
                      />
                    </div>
                  </div>
                )
              })
            ) : (
              <EmptyState
                compact
                icon={<Clock3 className="h-4 w-4" />}
                title="Недостаточно событий"
                description="Нужны переходы между статусами."
              />
            )}
          </div>
        </Panel>
      </div>

      <Panel className="mt-4 overflow-hidden">
        <PanelHeader
          title="Ученики"
          description="Прогресс и скорость проверки по каждому ученику"
          icon={<Users className="h-4 w-4" />}
        />
        <div className="mt-3 overflow-x-auto">
          <div className="min-w-[680px]">
            <div className="grid grid-cols-[minmax(190px,1.6fr)_110px_1fr_90px_90px_100px_110px] gap-3 border-y border-white/[0.07] bg-white/[0.015] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-mist-500">
              <span>Ученик</span>
              <span>Готово</span>
              <span>Прогресс</span>
              <span>В работе</span>
              <span>Проверка</span>
              <span>Просрочено</span>
              <span>Ср. проверка</span>
            </div>
            {data.students.length ? (
              data.students.map((student) => {
                const review = data.reviewTimes.find((item) => item.studentId === student.profile.id)
                return (
                  <button
                    key={student.profile.id}
                    type="button"
                    onClick={() => navigate(`/app/boards/${student.profile.id}`)}
                    className="table-row grid w-full grid-cols-[minmax(190px,1.6fr)_110px_1fr_90px_90px_100px_110px] items-center gap-3 px-4 py-2.5 text-left"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Avatar
                        name={`${student.profile.firstName} ${student.profile.lastName}`}
                        src={student.profile.avatarUrl}
                        size="xs"
                      />
                      <span className="truncate text-[12px] font-medium text-mist-100">
                        {student.profile.firstName} {student.profile.lastName}
                      </span>
                    </span>
                    <span className="text-[11.5px] text-mist-300">
                      {student.done} / {student.total}
                    </span>
                    <span className="flex items-center gap-2">
                      <Progress value={student.percent} size="sm" className="max-w-[120px]" />
                      <span className="w-8 text-[10.5px] tabular-nums text-mist-400">
                        {student.percent}%
                      </span>
                    </span>
                    <span className="text-[11.5px] text-brand-300">{student.inProgress}</span>
                    <span className="text-[11.5px] text-brand-200">{student.review}</span>
                    <span
                      className={cn(
                        'text-[11.5px]',
                        student.overdue ? 'font-semibold text-accent-300' : 'text-mist-500',
                      )}
                    >
                      {student.overdue}
                    </span>
                    <span className="flex items-center justify-between gap-1 text-[11.5px] text-mist-300">
                      {review ? formatHours(review.avgHours) : '—'}
                      <ArrowRight className="h-3 w-3 text-mist-600" />
                    </span>
                  </button>
                )
              })
            ) : (
              <div className="p-4">
                <EmptyState
                  compact
                  icon={<Users className="h-4 w-4" />}
                  title="Нет учеников"
                  description="Пригласите учеников, чтобы увидеть метрики."
                />
              </div>
            )}
          </div>
        </div>
      </Panel>
    </Page>
  )
}
