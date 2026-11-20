import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Page, PageHeader } from '@/features/layout/page'
import { Badge, EmptyState, Panel, Progress, Skeleton } from '@/components/ui/data'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/features/cards/status-badge'
import { api } from '@/services/api'
import { qk } from '@/lib/query-keys'
import { cn } from '@/lib/utils'

export function ModulesPage() {
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: qk.studentDashboard,
    queryFn: () => api.dashboard.student(),
  })

  if (isLoading) {
    return (
      <Page>
        <Skeleton className="mb-2 h-8 w-56" />
        <Skeleton className="mb-6 h-4 w-96 max-w-full" />
        <Skeleton className="mb-4 h-24 rounded-2xl" />
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      </Page>
    )
  }

  if (isError || !data) {
    return (
      <Page>
        <EmptyState
          title="Не удалось загрузить модули"
          description="Попробуйте обновить страницу."
          action={<Button onClick={() => void refetch()}>Повторить</Button>}
        />
      </Page>
    )
  }

  const totalCards = data.modules.reduce((acc, item) => acc + item.total, 0)
  const doneCards = data.modules.reduce((acc, item) => acc + item.done, 0)

  return (
    <Page>
      <PageHeader
        eyebrow={<span className="eyebrow">Программа</span>}
        title="Мои модули"
        description="Структура обучения и прогресс по каждому направлению. Процент считается по принятым заданиям."
        actions={
          <Button variant="secondary" onClick={() => navigate('/app/board')}>
            Открыть доску
          </Button>
        }
      />

      <Panel className="mb-5 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div
            className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full"
            style={{
              background: `conic-gradient(#0297DE ${
                totalCards ? (doneCards / totalCards) * 360 : 0
              }deg, rgba(255,255,255,0.07) 0deg)`,
            }}
            aria-hidden
          >
            <div className="flex h-[52px] w-[52px] flex-col items-center justify-center rounded-full bg-ink-850">
              <span className="text-[15px] font-semibold text-white">
                {totalCards ? Math.round((doneCards / totalCards) * 100) : 0}%
              </span>
            </div>
          </div>
          <div>
            <p className="text-[14px] font-semibold text-white">
              {data.modules.length} модулей · {totalCards} заданий
            </p>
            <p className="mt-0.5 text-[12px] text-mist-400">
              Завершено {doneCards}. В работе {data.inProgress}, на проверке {data.review}.
            </p>
          </div>
        </div>
        <div className="w-full max-w-[260px]">
          <div className="mb-1.5 flex items-center justify-between text-[11px] text-mist-400">
            <span>Общий прогресс</span>
            <span className="font-semibold text-mist-200">
              {totalCards ? Math.round((doneCards / totalCards) * 100) : 0}%
            </span>
          </div>
          <Progress value={totalCards ? (doneCards / totalCards) * 100 : 0} />
        </div>
      </Panel>

      {data.modules.length === 0 ? (
        <EmptyState
          title="Модулей пока нет"
          description="Когда куратор добавит модули и задания, здесь появится структура программы."
          action={<Button onClick={() => navigate('/app/board')}>Перейти к доске</Button>}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.modules.map((item) => {
            const moduleCards = data.modules.find((m) => m.module.id === item.module.id)
            return (
              <Panel key={item.module.id} className="flex flex-col overflow-hidden">
                <div className="flex items-start gap-3 border-b border-white/[0.06] px-5 py-4">
                  <span
                    className="mt-1 h-8 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: item.module.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-[14px] font-semibold leading-snug text-white">
                        {item.module.title}
                      </h2>
                      <Badge tone={item.percent === 100 ? 'success' : 'brand'}>
                        {item.percent}%
                      </Badge>
                    </div>
                    {item.module.description ? (
                      <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-mist-400">
                        {item.module.description}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex-1 px-5 py-4">
                  <div className="mb-3">
                    <div className="mb-1.5 flex items-center justify-between text-[11px] text-mist-400">
                      <span>
                        {item.done} из {item.total} завершено
                      </span>
                      <span>{item.percent}%</span>
                    </div>
                    <Progress
                      value={item.percent}
                      tone={item.percent === 100 ? 'success' : 'brand'}
                    />
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone="brand" dot="bg-brand-500">
                      В работе {item.inProgress}
                    </Badge>
                    <Badge tone="brand" dot="bg-brand-300">
                      На проверке {item.review}
                    </Badge>
                    <Badge tone="accent" dot="bg-accent-500">
                      Доработка {item.revision}
                    </Badge>
                    <Badge tone="muted" dot="bg-mist-400">
                      Бэклог {item.backlog}
                    </Badge>
                    {moduleCards?.done ? (
                      <Badge tone="success" dot="bg-emerald-400">
                        Готово {moduleCards.done}
                      </Badge>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-3">
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-mist-500">
                    {item.percent === 100 ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        Модуль завершён
                      </>
                    ) : (
                      <>
                        <BookOpen className="h-3.5 w-3.5" />
                        Осталось {item.total - item.done} заданий
                      </>
                    )}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/app/board?module=${item.module.id}`)}
                  >
                    Открыть задания
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Panel>
            )
          })}
        </div>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {(['backlog', 'in_progress', 'review'] as const).map((status) => (
          <div
            key={status}
            className={cn(
              'flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.015] px-3 py-2.5',
            )}
          >
            <StatusBadge status={status} />
            <span className="text-[13px] font-semibold text-white">
              {status === 'backlog'
                ? data.backlog
                : status === 'in_progress'
                  ? data.inProgress
                  : data.review}
            </span>
          </div>
        ))}
      </div>
    </Page>
  )
}
