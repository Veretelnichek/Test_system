import { useQueries, useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  ClipboardList,
  Columns3,
  Filter,
  MessageSquare,
  Search,
  TriangleAlert,
  X,
} from 'lucide-react'
import { Page, PageHeader } from '@/features/layout/page'
import { Avatar, Badge, EmptyState, Panel, Progress, Skeleton } from '@/components/ui/data'
import { Button } from '@/components/ui/button'
import { Input, SimpleSelect } from '@/components/ui/form'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/overlay'
import { StatusBadge } from '@/features/cards/status-badge'
import { api } from '@/services/api'
import { qk } from '@/lib/query-keys'
import { CARD_STATUSES } from '@/lib/constants'
import { filterCards } from '@/services/shared/derive'
import { cn, formatDate, timeAgo } from '@/lib/utils'
import type { CardStatus, CardWithMeta } from '@/types'

export function BoardsPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'tasks' ? 'tasks' : 'boards'

  const boardsQuery = useQuery({
    queryKey: qk.boardList,
    queryFn: () => api.boards.list(),
  })

  const summaries = boardsQuery.data ?? []
  const boardResults = useQueries({
    queries: summaries.map((summary) => ({
      queryKey: qk.board(summary.student.id),
      queryFn: () => api.boards.forStudent(summary.student.id),
      enabled: tab === 'tasks',
      staleTime: 30_000,
    })),
  })

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const setTab = (value: string) => {
    const next = new URLSearchParams(params)
    if (value === 'boards') next.delete('tab')
    else next.set('tab', value)
    setParams(next, { replace: true })
  }

  const query = params.get('q') ?? ''
  const studentId = params.get('student') ?? ''
  const moduleId = params.get('module') ?? ''
  const status = (params.get('status') ?? '') as CardStatus | ''
  const deadline = params.get('deadline') ?? 'all'
  const overdue = params.get('overdue') === '1'
  const hasFilters = Boolean(
    query || studentId || moduleId || status || deadline !== 'all' || overdue,
  )

  const allCards: CardWithMeta[] = boardResults.flatMap((result) => result.data?.cards ?? [])
  const uniqueModules = Array.from(
    new Map(
      boardResults
        .flatMap((result) => result.data?.modules ?? [])
        .map((module) => [module.id, module]),
    ).values(),
  )

  const filteredCards = filterCards(allCards, {
    query,
    moduleId,
    status,
    deadline,
    overdue,
    assigneeId: studentId,
  })

  const tasksLoading = boardResults.some((result) => result.isLoading)
  const visibleSummaries = summaries.filter((summary) =>
    query
      ? `${summary.student.firstName} ${summary.student.lastName} ${summary.student.email}`
          .toLowerCase()
          .includes(query.toLowerCase())
      : true,
  )

  const resetFilters = () => {
    const next = new URLSearchParams()
    if (tab === 'tasks') next.set('tab', 'tasks')
    setParams(next, { replace: true })
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Кураторство"
        title="Доски учеников"
        description="Все закреплённые ученики и их задания в одном месте. Фильтры сохраняются в адресе страницы."
        actions={
          <Button variant="secondary" onClick={() => navigate('/app/analytics')}>
            <BarChart3 className="h-4 w-4" />
            Аналитика
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="boards">
              <Columns3 className="h-3.5 w-3.5" />
              Доски
              <span className="ml-0.5 text-mist-500">{summaries.length}</span>
            </TabsTrigger>
            <TabsTrigger value="tasks">
              <ClipboardList className="h-3.5 w-3.5" />
              Все задания
            </TabsTrigger>
          </TabsList>

          <div className="relative w-full sm:w-[250px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mist-500" />
            <Input
              value={query}
              onChange={(event) => setParam('q', event.target.value)}
              placeholder={tab === 'tasks' ? 'Поиск по заданиям…' : 'Поиск по ученикам…'}
              className="h-9 pl-8 text-[12.5px]"
              aria-label="Поиск"
            />
          </div>
        </div>

        <TabsContent value="boards" className="mt-0">
          {boardsQuery.isLoading ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-[196px] rounded-2xl" />
              ))}
            </div>
          ) : boardsQuery.isError ? (
            <EmptyState
              icon={<TriangleAlert className="h-5 w-5 text-accent-300" />}
              title="Не удалось загрузить доски"
              description="Проверьте соединение и повторите попытку."
              action={<Button onClick={() => void boardsQuery.refetch()}>Повторить</Button>}
            />
          ) : summaries.length === 0 ? (
            <EmptyState
              icon={<Columns3 className="h-5 w-5" />}
              title="Досок пока нет"
              description="Пригласите ученика — его доска появится здесь."
              action={<Button onClick={() => navigate('/app/students')}>К ученикам</Button>}
            />
          ) : visibleSummaries.length === 0 ? (
            <EmptyState
              icon={<Search className="h-5 w-5" />}
              title="Ученики не найдены"
              description="Попробуйте изменить поисковый запрос."
              action={
                <Button variant="secondary" onClick={() => setParam('q', '')}>
                  Очистить поиск
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visibleSummaries.map((summary) => (
                <button
                  key={summary.student.id}
                  type="button"
                  onClick={() => navigate(`/app/boards/${summary.student.id}`)}
                  className="panel panel-hover group flex flex-col p-4 text-left"
                >
                  <div className="flex items-start gap-3">
                    <Avatar
                      name={`${summary.student.firstName} ${summary.student.lastName}`}
                      src={summary.student.avatarUrl}
                      size="lg"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-semibold text-white">
                        {summary.student.firstName} {summary.student.lastName}
                      </p>
                      <p className="truncate text-[11px] text-mist-500">{summary.student.email}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {summary.review > 0 ? (
                          <Badge tone="brand">{summary.review} на проверке</Badge>
                        ) : (
                          <Badge tone="muted">нет проверок</Badge>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-mist-600 transition-transform group-hover:translate-x-0.5" />
                  </div>

                  <div className="mt-4">
                    <div className="mb-1.5 flex items-center justify-between text-[11px] text-mist-400">
                      <span>
                        {summary.done} из {summary.total} готово
                      </span>
                      <span className="font-semibold text-mist-200">{summary.percent}%</span>
                    </div>
                    <Progress value={summary.percent} size="sm" />
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-2.5 text-[10.5px] text-mist-500">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-3 w-3" />
                      {summary.lastActivityAt ? timeAgo(summary.lastActivityAt) : 'нет активности'}
                    </span>
                    <span>Открыть доску</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tasks" className="mt-0">
          <div className="panel mb-3 flex flex-wrap items-center gap-2 p-2.5">
            <SimpleSelect
              value={studentId || 'all'}
              onValueChange={(value) => setParam('student', value === 'all' ? '' : value)}
              options={[
                { value: 'all', label: 'Все ученики' },
                ...summaries.map((summary) => ({
                  value: summary.student.id,
                  label: `${summary.student.firstName} ${summary.student.lastName}`,
                })),
              ]}
              className="h-9 w-[170px] text-[12.5px]"
              aria-label="Фильтр по ученику"
            />
            <SimpleSelect
              value={moduleId || 'all'}
              onValueChange={(value) => setParam('module', value === 'all' ? '' : value)}
              options={[
                { value: 'all', label: 'Все модули' },
                ...uniqueModules.map((module) => ({ value: module.id, label: module.title })),
              ]}
              className="h-9 w-[180px] text-[12.5px]"
              aria-label="Фильтр по модулю"
            />
            <SimpleSelect
              value={status || 'all'}
              onValueChange={(value) => setParam('status', value === 'all' ? '' : value)}
              options={[
                { value: 'all', label: 'Все статусы' },
                ...CARD_STATUSES.map((item) => ({ value: item.id, label: item.title })),
              ]}
              className="h-9 w-[150px] text-[12.5px]"
              aria-label="Фильтр по статусу"
            />
            <SimpleSelect
              value={deadline}
              onValueChange={(value) => setParam('deadline', value === 'all' ? '' : value)}
              options={[
                { value: 'all', label: 'Любой дедлайн' },
                { value: 'overdue', label: 'Просроченные' },
                { value: 'week', label: 'На этой неделе' },
                { value: 'none', label: 'Без дедлайна' },
              ]}
              className="h-9 w-[165px] text-[12.5px]"
              aria-label="Фильтр по дедлайну"
            />
            <button
              type="button"
              onClick={() => setParam('overdue', overdue ? '' : '1')}
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-[12px] font-medium transition-colors',
                overdue
                  ? 'border-accent-500/40 bg-accent-500/[0.12] text-accent-300'
                  : 'border-white/[0.09] bg-white/[0.03] text-mist-300 hover:bg-white/[0.06]',
              )}
              aria-pressed={overdue}
            >
              <Filter className="h-3.5 w-3.5" />
              Просрочка
            </button>
            {hasFilters ? (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9">
                <X className="h-3.5 w-3.5" />
                Сбросить
              </Button>
            ) : null}
            <span className="ml-auto text-[11px] text-mist-500">
              Найдено: <b className="text-mist-200">{filteredCards.length}</b>
            </span>
          </div>

          {tasksLoading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          ) : filteredCards.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="h-5 w-5" />}
              title="Задания не найдены"
              description={
                allCards.length
                  ? 'Измените фильтры или сбросьте их.'
                  : 'На досках ваших учеников пока нет заданий.'
              }
              action={
                hasFilters ? (
                  <Button variant="secondary" onClick={resetFilters}>
                    Сбросить фильтры
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <Panel className="overflow-hidden">
              <div className="hidden grid-cols-[minmax(220px,1.6fr)_150px_minmax(140px,1fr)_150px_130px_90px_32px] gap-3 border-b border-white/[0.07] px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-mist-500 xl:grid">
                <span>Задание</span>
                <span>Ученик</span>
                <span>Модуль</span>
                <span>Статус</span>
                <span>Дедлайн</span>
                <span>Обновлено</span>
                <span />
              </div>
              {filteredCards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => navigate(`/app/boards/${card.studentId}?card=${card.id}`)}
                  className="table-row flex w-full flex-col gap-2 px-4 py-3 text-left xl:grid xl:grid-cols-[minmax(220px,1.6fr)_150px_minmax(140px,1fr)_150px_130px_90px_32px] xl:items-center xl:gap-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-medium text-mist-100">{card.title}</p>
                    <div className="mt-0.5 flex items-center gap-2 text-[10.5px] text-mist-500 xl:hidden">
                      <span>{card.studentName}</span>
                      <span>·</span>
                      <span className="truncate">{card.moduleTitle}</span>
                    </div>
                  </div>
                  <div className="hidden min-w-0 items-center gap-2 xl:flex">
                    <Avatar name={card.studentName} src={card.assigneeAvatar} size="xs" />
                    <span className="truncate text-[11.5px] text-mist-300">{card.studentName}</span>
                  </div>
                  <div className="hidden min-w-0 items-center gap-1.5 xl:flex">
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: card.moduleColor }}
                    />
                    <span className="truncate text-[11px] text-mist-400">{card.moduleTitle}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={card.status} />
                    {card.status === 'review' && card.waitingHours > 24 ? (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-accent-300">
                        <AlertTriangle className="h-3 w-3" />
                        {card.waitingHours} ч
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-mist-400">
                    <span className={cn('xl:hidden', card.isOverdue && 'text-accent-300')}>
                      {card.deadline ? formatDate(card.deadline) : 'Без дедлайна'}
                    </span>
                    <span className={cn('hidden xl:inline', card.isOverdue && 'text-accent-300')}>
                      {card.deadline ? formatDate(card.deadline) : '—'}
                    </span>
                    {card.commentsCount > 0 ? (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-mist-500">
                        <MessageSquare className="h-3 w-3" />
                        {card.commentsCount}
                      </span>
                    ) : null}
                  </div>
                  <span className="hidden text-[10.5px] text-mist-500 xl:block">
                    {timeAgo(card.updatedAt)}
                  </span>
                  <ArrowRight className="hidden h-3.5 w-3.5 text-mist-600 xl:block" />
                </button>
              ))}
            </Panel>
          )}
        </TabsContent>
      </Tabs>
    </Page>
  )
}
