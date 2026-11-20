import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  KanbanSquare,
  Layers,
  MessageSquare,
  RotateCcw,
  Sparkles,
  Timer,
  TriangleAlert,
} from 'lucide-react'
import { Page, PageHeader } from '@/features/layout/page'
import { Avatar, Badge, EmptyState, Panel, PanelHeader, Progress, Skeleton } from '@/components/ui/data'
import { Button } from '@/components/ui/button'
import { StatusBadge, DeadlineLabel } from '@/features/cards/status-badge'
import { api } from '@/services/api'
import { qk } from '@/lib/query-keys'
import { useAuth } from '@/features/auth/auth-context'
import { format, formatDistanceToNowStrict } from 'date-fns'
import { ru } from 'date-fns/locale'
import { cn, fullName, percent, timeAgo } from '@/lib/utils'
import type { CardWithMeta } from '@/types'

function greeting() {
  const hour = new Date().getHours()
  if (hour < 6) return 'Доброй ночи'
  if (hour < 12) return 'Доброе утро'
  if (hour < 18) return 'Добрый день'
  return 'Добрый вечер'
}

function StatTile({
  label,
  value,
  icon,
  tone,
  hint,
}: {
  label: string
  value: number
  icon: React.ReactNode
  tone: string
  hint?: string
}) {
  return (
    <div className="panel flex items-center gap-3 p-3.5">
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border', tone)}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[19px] font-semibold leading-none tracking-[-0.02em] text-white">{value}</p>
        <p className="mt-1 truncate text-[11.5px] text-mist-400">{label}</p>
        {hint ? <p className="text-[10px] text-mist-500">{hint}</p> : null}
      </div>
    </div>
  )
}

function AttentionRow({ card, onOpen }: { card: CardWithMeta; onOpen: () => void }) {
  const stalled = card.status === 'in_progress' && card.waitingHours === 0
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-left transition-colors hover:border-white/[0.12] hover:bg-white/[0.04]"
    >
      <span
        className={cn(
          'h-8 w-1 shrink-0 rounded-full',
          card.status === 'revision' || card.isOverdue
            ? 'bg-accent-500'
            : stalled
              ? 'bg-amber-400'
              : 'bg-brand-500',
        )}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-medium text-mist-100">{card.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] text-mist-500">
          <span className="truncate">{card.moduleTitle}</span>
          <span>·</span>
          <DeadlineLabel date={card.deadline} />
        </span>
      </span>
      <StatusBadge status={card.status} className="hidden shrink-0 sm:inline-flex" />
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-mist-600 transition-transform group-hover:translate-x-0.5" />
    </button>
  )
}

export function StudentDashboard() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: qk.studentDashboard,
    queryFn: () => api.dashboard.student(),
  })

  if (isLoading) {
    return (
      <Page>
        <Skeleton className="mb-3 h-3 w-32" />
        <Skeleton className="mb-2 h-8 w-72" />
        <Skeleton className="mb-6 h-4 w-96 max-w-full" />
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[76px] rounded-2xl" />
          ))}
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </Page>
    )
  }

  if (isError || !data) {
    return (
      <Page>
        <EmptyState
          icon={<TriangleAlert className="h-5 w-5 text-accent-300" />}
          title="Не удалось загрузить сводку"
          description="Проверьте соединение и попробуйте снова. Данные не потеряны."
          action={<Button onClick={() => void refetch()}>Повторить</Button>}
        />
      </Page>
    )
  }

  const name = profile?.firstName ?? data.profile.firstName
  const total = data.total
  const progress = percent(data.done, total)
  const nextDeadline = data.deadlines[0]
  const stalled = data.stalled[0]

  return (
    <Page>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-1.5 text-[11.5px] text-mist-400">
            <Sparkles className="h-3.5 w-3.5 text-brand-400" />
            {format(new Date(), 'EEEE, d MMMM', { locale: ru })}
          </span>
        }
        title={`${greeting()}, ${name}`}
        description={
          total === 0
            ? 'Программа ещё не наполнена заданиями. Куратор скоро добавит первые модули.'
            : `${data.inProgress} в работе, ${data.review} на проверке и ${data.revision} на доработке. ${
                nextDeadline ? 'Ближайший дедлайн уже на подходе.' : 'Держите спокойный темп.'
              }`
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/app/modules')}>
              <Layers className="h-4 w-4" />
              Мои модули
            </Button>
            <Button onClick={() => navigate('/app/board')}>
              <KanbanSquare className="h-4 w-4" />
              Открыть доску
            </Button>
          </>
        }
      />

      {stalled ? (
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/[0.07] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-400/10 text-amber-300">
              <Timer className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[13px] font-semibold text-amber-100">
                Задание стоит на месте. Продолжить?
              </p>
              <p className="mt-0.5 text-[12px] text-mist-300">
                «{stalled.title}» не менялось больше 48 часов.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            className="shrink-0 bg-amber-400 text-ink-950 hover:bg-amber-300"
            onClick={() => navigate(`/app/board?card=${stalled.id}`)}
          >
            Вернуться к заданию
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
        <Panel className="relative overflow-hidden border-brand-500/[0.18] p-5 sm:p-6">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-brand-500/[0.13] blur-[70px]" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="eyebrow text-brand-300/80">Программа обучения</span>
                <Badge tone="brand">{data.modules.length} модулей</Badge>
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-1">
                <span className="text-[42px] font-semibold leading-none tracking-[-0.04em] text-white">
                  {progress}%
                </span>
                <span className="mb-1 text-[12.5px] text-mist-400">
                  {data.done} из {total} заданий завершено
                </span>
              </div>
              <Progress value={progress} size="lg" className="mt-4" label="Общий прогресс программы" />

              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[11.5px]">
                <span className="inline-flex items-center gap-1.5 text-mist-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                  В работе <b className="font-semibold text-white">{data.inProgress}</b>
                </span>
                <span className="inline-flex items-center gap-1.5 text-mist-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-300" />
                  На проверке <b className="font-semibold text-white">{data.review}</b>
                </span>
                <span className="inline-flex items-center gap-1.5 text-mist-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent-500" />
                  Доработка <b className="font-semibold text-white">{data.revision}</b>
                </span>
                <span className="inline-flex items-center gap-1.5 text-mist-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Готово <b className="font-semibold text-white">{data.done}</b>
                </span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-4 sm:flex-col sm:items-end">
              <div
                className="relative flex h-[104px] w-[104px] items-center justify-center rounded-full"
                style={{
                  background: `conic-gradient(#0297DE ${progress * 3.6}deg, rgba(255,255,255,0.07) 0deg)`,
                }}
                aria-hidden
              >
                <div className="flex h-[88px] w-[88px] flex-col items-center justify-center rounded-full bg-ink-850">
                  <span className="text-[20px] font-semibold text-white">{data.done}</span>
                  <span className="text-[9.5px] uppercase tracking-wider text-mist-500">готово</span>
                </div>
              </div>
              {nextDeadline ? (
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-mist-500">Ближайший дедлайн</p>
                  <p className="mt-0.5 text-[12px] font-medium text-mist-200">
                    {formatDistanceToNowStrict(new Date(nextDeadline.deadline!), {
                      addSuffix: true,
                      locale: ru,
                    })}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </Panel>

        <Panel className="flex flex-col">
          <PanelHeader
            title="Требует внимания"
            description="Задания, где нужен ваш следующий шаг"
            action={
              <Badge tone={data.attention.length ? 'accent' : 'muted'}>
                {data.attention.length}
              </Badge>
            }
          />
          <div className="flex-1 space-y-2 p-4 pt-3">
            {data.attention.length ? (
              data.attention.map((card) => (
                <AttentionRow
                  key={card.id}
                  card={card}
                  onOpen={() => navigate(`/app/board?card=${card.id}`)}
                />
              ))
            ) : (
              <EmptyState
                compact
                icon={<CheckCircle2 className="h-4 w-4 text-emerald-300" />}
                title="Всё под контролем"
                description="Нет просрочек и заданий на доработке."
              />
            )}
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="В работе"
          value={data.inProgress}
          icon={<Clock3 className="h-4 w-4" />}
          tone="border-brand-500/25 bg-brand-500/[0.1] text-brand-300"
        />
        <StatTile
          label="На проверке"
          value={data.review}
          icon={<ClipboardCheck className="h-4 w-4" />}
          tone="border-brand-400/25 bg-brand-400/[0.08] text-brand-200"
        />
        <StatTile
          label="На доработке"
          value={data.revision}
          icon={<RotateCcw className="h-4 w-4" />}
          tone="border-accent-500/25 bg-accent-500/[0.1] text-accent-300"
        />
        <StatTile
          label="Выполнено"
          value={data.done}
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="border-emerald-500/25 bg-emerald-500/[0.1] text-emerald-300"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <Panel>
          <PanelHeader
            title="Прогресс по модулям"
            description="Завершённые задания к общему количеству"
            icon={<Layers className="h-4 w-4" />}
            action={
              <Button variant="ghost" size="sm" onClick={() => navigate('/app/modules')}>
                Все модули
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            }
          />
          <div className="grid gap-2.5 p-4 pt-3 sm:grid-cols-2">
            {data.modules.length ? (
              data.modules.map((item) => (
                <button
                  key={item.module.id}
                  type="button"
                  onClick={() => navigate(`/app/board?module=${item.module.id}`)}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-left transition-colors hover:border-white/[0.12] hover:bg-white/[0.04]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: item.module.color }}
                      />
                      <span className="truncate text-[12.5px] font-medium text-mist-100">
                        {item.module.title}
                      </span>
                    </div>
                    <span className="shrink-0 text-[11.5px] font-semibold text-mist-300">
                      {item.percent}%
                    </span>
                  </div>
                  <Progress value={item.percent} size="sm" className="mt-2.5" />
                  <div className="mt-2 flex items-center gap-2 text-[10.5px] text-mist-500">
                    <span>
                      {item.done} / {item.total}
                    </span>
                    {item.review > 0 ? <span>· {item.review} на проверке</span> : null}
                    {item.revision > 0 ? (
                      <span className="text-accent-300/80">· {item.revision} на доработке</span>
                    ) : null}
                  </div>
                </button>
              ))
            ) : (
              <div className="sm:col-span-2">
                <EmptyState
                  compact
                  icon={<Layers className="h-4 w-4" />}
                  title="Модулей пока нет"
                  description="Куратор добавит модули, и здесь появится прогресс."
                />
              </div>
            )}
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Ближайшие дедлайны"
            description="Сроки по незавершённым заданиям"
            icon={<Clock3 className="h-4 w-4" />}
          />
          <div className="divide-y divide-white/[0.05] px-4 pb-2 pt-1">
            {data.deadlines.length ? (
              data.deadlines.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => navigate(`/app/board?card=${card.id}`)}
                  className="flex w-full items-center justify-between gap-3 py-2.5 text-left"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-medium text-mist-100">{card.title}</p>
                    <p className="mt-0.5 truncate text-[10.5px] text-mist-500">{card.moduleTitle}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <DeadlineLabel date={card.deadline} />
                    <p
                      className={cn(
                        'mt-0.5 text-[10px]',
                        card.isOverdue ? 'text-accent-300' : 'text-mist-500',
                      )}
                    >
                      {formatDistanceToNowStrict(new Date(card.deadline!), {
                        addSuffix: true,
                        locale: ru,
                      })}
                    </p>
                  </div>
                </button>
              ))
            ) : (
              <div className="py-6 text-center text-[12px] text-mist-500">
                Ближайших дедлайнов нет
              </div>
            )}
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Последние действия куратора"
            description="Проверки и обратная связь"
            icon={<ClipboardCheck className="h-4 w-4" />}
          />
          <div className="space-y-1 p-3 pt-2">
            {data.curatorActions.length ? (
              data.curatorActions.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => navigate(`/app/board?card=${event.cardId}`)}
                  className="flex w-full items-start gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-white/[0.03]"
                >
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-mist-300">
                    {event.toStatus === 'done' ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                    ) : event.toStatus === 'revision' ? (
                      <RotateCcw className="h-3.5 w-3.5 text-accent-300" />
                    ) : (
                      <MessageSquare className="h-3.5 w-3.5 text-brand-300" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] text-mist-200">
                      {event.toStatus === 'done'
                        ? 'Задание принято'
                        : event.toStatus === 'revision'
                          ? 'Задание возвращено на доработку'
                          : 'Обновление статуса'}{' '}
                      <span className="font-medium text-white">«{event.cardTitle}»</span>
                    </span>
                    {event.comment ? (
                      <span className="mt-0.5 line-clamp-2 block text-[11px] leading-relaxed text-mist-500">
                        {event.comment}
                      </span>
                    ) : null}
                    <span className="mt-0.5 block text-[10.5px] text-mist-600">
                      {event.actorName} · {timeAgo(event.createdAt)}
                    </span>
                  </span>
                </button>
              ))
            ) : (
              <EmptyState
                compact
                icon={<ClipboardCheck className="h-4 w-4" />}
                title="Пока без проверок"
                description="Действия куратора появятся здесь."
              />
            )}
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Актуальные уведомления"
            description="Важные события по обучению"
            icon={<Bell className="h-4 w-4" />}
            action={
              <Button variant="ghost" size="sm" onClick={() => navigate('/app/notifications')}>
                Все
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            }
          />
          <div className="space-y-2 p-4 pt-3">
            {data.notifications.length ? (
              data.notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="flex items-start gap-2.5 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5"
                >
                  <span
                    className={cn(
                      'mt-1 h-1.5 w-1.5 shrink-0 rounded-full',
                      notification.readAt ? 'bg-mist-600' : 'bg-brand-400',
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium text-mist-200">
                      {typeof notification.payload.cardTitle === 'string'
                        ? notification.payload.cardTitle
                        : 'Событие по заданию'}
                    </p>
                    <p className="mt-0.5 text-[10.5px] text-mist-500">
                      {timeAgo(notification.createdAt)}
                    </p>
                  </div>
                  {!notification.readAt ? (
                    <span className="mt-1 shrink-0 rounded bg-brand-500/15 px-1.5 py-0.5 text-[9.5px] font-semibold text-brand-300">
                      новое
                    </span>
                  ) : null}
                </div>
              ))
            ) : (
              <EmptyState
                compact
                icon={<Bell className="h-4 w-4" />}
                title="Уведомлений нет"
                description="Здесь появятся события по заданиям."
              />
            )}
          </div>
        </Panel>
      </div>

      <div className="mt-5 flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.015] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Avatar name={fullName(data.profile.firstName, data.profile.lastName)} size="sm" />
          <p className="text-[11.5px] text-mist-400">
            Прогресс рассчитывается по реальным статусам заданий и обновляется автоматически.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/app/board')}>
          К заданиям
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </Page>
  )
}
