import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Page } from '@/features/layout/page'
import { EmptyState, Progress, Skeleton } from '@/components/ui/data'
import { Button } from '@/components/ui/button'
import { Input, SimpleSelect } from '@/components/ui/form'
import { CardDetailSheet } from '@/features/cards/card-detail-sheet'
import { DeadlineLabel } from '@/features/cards/status-badge'
import { CreateCardDialog } from './create-card-dialog'
import { ManageModulesDialog } from './manage-modules-dialog'
import { api } from '@/services/api'
import { qk, INVALIDATION_KEYS } from '@/lib/query-keys'
import { CARD_STATUSES, REVIEW_OVERDUE_HOURS } from '@/lib/constants'
import { filterCards } from '@/services/shared/derive'
import { useAuth } from '@/features/auth/auth-context'
import { cn, fullName, percent } from '@/lib/utils'
import type { BoardData, CardStatus, CardWithMeta, Role } from '@/types'

function canDrop(role: Role, from: CardStatus, to: CardStatus) {
  if (from === to) return false
  if (role === 'student') {
    return (
      (from === 'backlog' && to === 'in_progress') ||
      (from === 'in_progress' && to === 'review') ||
      (from === 'revision' && to === 'review')
    )
  }
  return from === 'review' && (to === 'done' || to === 'revision')
}

function transitionError(role: Role, from: CardStatus, to: CardStatus) {
  if (role === 'student') {
    if (to === 'done') return 'Только куратор может перевести задание в «Готово»'
    if (from === 'review') return 'Задание уже на проверке — дождитесь решения куратора'
    return 'Недопустимый переход: ученик может взять задание, сдать его или отправить повторно'
  }
  return 'Куратор может принимать или возвращать задания только из «На проверке»'
}

function CardTile({
  card,
  onOpen,
  draggable,
  onAdvance,
  role,
}: {
  card: CardWithMeta
  onOpen: () => void
  draggable: boolean
  onAdvance?: () => void
  role: Role
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    disabled: !draggable,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...listeners}
      {...attributes}
      onClick={() => {
        if (!isDragging) onOpen()
      }}
      className={cn(
        'group relative cursor-pointer rounded-xl border border-white/[0.08] bg-ink-850 p-3 shadow-soft transition-colors hover:border-white/[0.16] hover:bg-ink-800',
        draggable && 'active:cursor-grabbing',
        isDragging && 'opacity-30',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-[10px] font-medium text-mist-400">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: card.moduleColor }}
          />
          <span className="truncate">{card.moduleTitle}</span>
        </span>
        {card.isOverdue ? (
          <span className="shrink-0 text-[9.5px] font-semibold uppercase text-accent-300">
            срок
          </span>
        ) : null}
      </div>

      <p className="mt-1.5 line-clamp-2 text-[12.5px] font-medium leading-snug text-mist-100">
        {card.title}
      </p>

      {card.status === 'review' ? (
        <div
          className={cn(
            'mt-2 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold',
            card.waitingHours > REVIEW_OVERDUE_HOURS
              ? 'border-accent-500/30 bg-accent-500/10 text-accent-300'
              : 'border-brand-500/25 bg-brand-500/[0.08] text-brand-200',
          )}
        >
          ждёт {card.waitingHours} ч
        </div>
      ) : null}

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <DeadlineLabel date={card.deadline} done={card.status === 'done'} />
        <div className="flex items-center gap-2">
          {card.commentsCount > 0 ? (
            <span className="inline-flex items-center gap-0.5 text-[10.5px] text-mist-500">
              <span className="text-[9.5px] uppercase tracking-[0.08em]">комм.</span>
              {card.commentsCount}
            </span>
          ) : null}
          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white/10 bg-brand-500/20 text-[8.5px] font-semibold text-brand-100">
            {fullName(card.assigneeName.split(' ')[0], card.assigneeName.split(' ')[1])
              .split(' ')
              .map((part) => part[0])
              .join('')
              .slice(0, 2)}
          </span>
        </div>
      </div>

      {onAdvance ? (
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            onAdvance()
          }}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.04] py-1.5 text-[10.5px] font-medium text-mist-200 transition-colors hover:bg-white/[0.08] md:hidden"
        >
          {card.status === 'backlog'
            ? 'Взять в работу'
            : card.status === 'revision'
              ? 'Отправить повторно'
              : 'Сдать на проверку'}
        </button>
      ) : null}

      {role === 'curator' && card.status === 'review' ? (
        <p className="mt-2 text-[9.5px] text-mist-600">Перетащите в «Готово» или откройте карточку</p>
      ) : null}
    </div>
  )
}

function BoardColumn({
  status,
  cards,
  role,
  activeFrom,
  dragging,
  onOpen,
  onAdvance,
  onAdd,
}: {
  status: CardStatus
  cards: CardWithMeta[]
  role: Role
  activeFrom: CardStatus | null
  dragging: boolean
  onOpen: (cardId: string) => void
  onAdvance: (card: CardWithMeta) => void
  onAdd?: () => void
}) {
  const meta = CARD_STATUSES.find((item) => item.id === status)!
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const valid = activeFrom ? canDrop(role, activeFrom, status) : false

  return (
    <section
      ref={setNodeRef}
      className={cn(
        'flex w-[286px] shrink-0 snap-start flex-col rounded-2xl border border-white/[0.07] bg-ink-950/40 transition-colors lg:w-auto lg:min-w-[230px] lg:flex-1',
        dragging && valid && 'border-brand-500/40 bg-brand-500/[0.045]',
        isOver && valid && 'border-brand-400/70 bg-brand-500/[0.09]',
        isOver && !valid && 'border-accent-500/40 bg-accent-500/[0.04]',
      )}
    >
      <header className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2.5">
        <span className={cn('h-2 w-2 shrink-0 rounded-full', meta.dot)} />
        <h3 className="flex-1 truncate text-[12px] font-semibold text-mist-100">{meta.title}</h3>
        <span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-white/[0.06] px-1.5 text-[10.5px] font-semibold text-mist-300">
          {cards.length}
        </span>
        {onAdd ? (
          <button
            type="button"
            onClick={onAdd}
            className="flex h-6 items-center justify-center rounded-md px-1.5 text-[10.5px] font-medium text-mist-500 transition-colors hover:bg-white/[0.06] hover:text-white"
            aria-label={`Добавить задание в «${meta.title}»`}
          >
            Добавить
          </button>
        ) : null}
      </header>

      <div className="flex-1 space-y-2 p-2">
        {cards.length ? (
          cards.map((card) => (
            <CardTile
              key={card.id}
              card={card}
              role={role}
              draggable={
                role === 'curator'
                  ? card.status === 'review'
                  : card.status === 'backlog' ||
                    card.status === 'in_progress' ||
                    card.status === 'revision'
              }
              onOpen={() => onOpen(card.id)}
              onAdvance={
                role === 'student' &&
                (card.status === 'backlog' ||
                  card.status === 'in_progress' ||
                  card.status === 'revision')
                  ? () => onAdvance(card)
                  : undefined
              }
            />
          ))
        ) : (
          <div
            className={cn(
              'flex min-h-[96px] flex-col items-center justify-center rounded-xl border border-dashed px-3 py-5 text-center',
              isOver && valid
                ? 'border-brand-400/50 bg-brand-500/[0.06]'
                : 'border-white/[0.07]',
            )}
          >
            <p className="text-[11px] text-mist-500">
              {isOver && valid ? 'Отпустите, чтобы переместить' : 'Нет заданий'}
            </p>
            {status === 'backlog' && onAdd ? (
              <button
                type="button"
                onClick={onAdd}
                className="mt-1.5 text-[11px] font-medium text-brand-300 hover:text-brand-200"
              >
                Добавить задание
              </button>
            ) : null}
          </div>
        )}
      </div>
    </section>
  )
}

export function BoardPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const { profile } = useAuth()
  const role: Role = profile?.role ?? 'student'
  const isCurator = role === 'curator'
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const [activeCard, setActiveCard] = useState<CardWithMeta | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [modulesOpen, setModulesOpen] = useState(false)
  const [detailMode, setDetailMode] = useState<'view' | 'return'>('view')

  const boardKey = qk.board(isCurator ? studentId : 'me')
  const { data, isLoading, isError, error } = useQuery({
    queryKey: boardKey,
    queryFn: () => (isCurator ? api.boards.forStudent(studentId!) : api.boards.my()),
    enabled: !isCurator || Boolean(studentId),
  })

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  )

  const invalidate = () => {
    INVALIDATION_KEYS.forEach((key) => {
      void queryClient.invalidateQueries({ queryKey: key })
    })
    void queryClient.invalidateQueries({ queryKey: boardKey })
  }

  const move = useMutation({
    mutationFn: ({ cardId, to }: { cardId: string; to: CardStatus }) =>
      api.cards.move(cardId, to),
    onMutate: async ({ cardId, to }) => {
      await queryClient.cancelQueries({ queryKey: boardKey })
      const previous = queryClient.getQueryData<BoardData>(boardKey)
      if (previous) {
        queryClient.setQueryData<BoardData>(boardKey, {
          ...previous,
          cards: previous.cards.map((card) =>
            card.id === cardId
              ? { ...card, status: to, statusSince: new Date().toISOString() }
              : card,
          ),
        })
      }
      return { previous }
    },
    onError: (mutationError, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(boardKey, context.previous)
      toast.error(mutationError instanceof Error ? mutationError.message : 'Не удалось изменить статус')
    },
    onSuccess: (_result, variables) => {
      toast.success(
        variables.to === 'review'
          ? 'Задание отправлено на проверку'
          : variables.to === 'in_progress'
            ? 'Задание взято в работу'
            : 'Статус обновлён',
      )
    },
    onSettled: () => invalidate(),
  })

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'card') next.delete('card')
    setParams(next, { replace: true })
  }

  const openCard = (cardId: string, mode: 'view' | 'return' = 'view') => {
    const next = new URLSearchParams(params)
    next.set('card', cardId)
    setDetailMode(mode)
    setParams(next, { replace: true })
  }

  const closeCard = () => {
    const next = new URLSearchParams(params)
    next.delete('card')
    setParams(next, { replace: true })
    setDetailMode('view')
  }

  if (isLoading) {
    return (
      <Page>
        <Skeleton className="mb-2 h-3 w-32" />
        <Skeleton className="mb-2 h-8 w-80 max-w-full" />
        <Skeleton className="mb-5 h-4 w-96 max-w-full" />
        <Skeleton className="mb-4 h-16 rounded-2xl" />
        <div className="flex gap-3 overflow-hidden">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[420px] min-w-[240px] flex-1 rounded-2xl" />
          ))}
        </div>
      </Page>
    )
  }

  if (isError || !data) {
    return (
      <Page>
        <EmptyState
          title="Доска недоступна"
          description={
            error instanceof Error
              ? error.message
              : 'Проверьте права доступа или вернитесь к списку досок.'
          }
          action={
            <Button onClick={() => navigate(isCurator ? '/app/boards' : '/app/home')}>
              {isCurator ? 'К списку досок' : 'На главную'}
            </Button>
          }
        />
      </Page>
    )
  }

  const query = params.get('q') ?? ''
  const moduleId = params.get('module') ?? ''
  const status = (params.get('status') ?? '') as CardStatus | ''
  const deadline = params.get('deadline') ?? 'all'
  const overdue = params.get('overdue') === '1'

  const filtered = filterCards(data.cards, {
    query,
    moduleId,
    status,
    deadline,
    overdue,
  })

  const done = data.cards.filter((card) => card.status === 'done').length
  const progress = percent(done, data.cards.length)
  const cardCounts = data.cards.reduce<Record<string, number>>((acc, card) => {
    acc[card.moduleId] = (acc[card.moduleId] ?? 0) + 1
    return acc
  }, {})
  const hasFilters = Boolean(query || moduleId || status || deadline !== 'all' || overdue)

  const resetFilters = () => {
    const next = new URLSearchParams()
    const card = params.get('card')
    if (card) next.set('card', card)
    setParams(next, { replace: true })
  }

  const handleDragStart = (event: DragStartEvent) => {
    const card = data.cards.find((item) => item.id === event.active.id)
    setActiveCard(card ?? null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const card = activeCard
    setActiveCard(null)
    if (!card || !event.over) return
    const to = event.over.id as CardStatus
    if (!CARD_STATUSES.some((item) => item.id === to)) return
    if (!canDrop(role, card.status, to)) {
      toast.error(transitionError(role, card.status, to))
      return
    }
    if (isCurator && to === 'revision') {
      openCard(card.id, 'return')
      toast.message('Добавьте комментарий — без него возврат невозможен')
      return
    }
    move.mutate({ cardId: card.id, to })
  }

  const quickAdvance = (card: CardWithMeta) => {
    const to: CardStatus =
      card.status === 'backlog'
        ? 'in_progress'
        : card.status === 'in_progress' || card.status === 'revision'
          ? 'review'
          : card.status
    if (to === card.status) return
    move.mutate({ cardId: card.id, to })
  }

  const cardParam = params.get('card')

  return (
    <Page>
      <div className="mb-5">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          {isCurator ? (
            <button
              type="button"
              onClick={() => navigate('/app/boards')}
              className="text-[11.5px] text-mist-400 transition-colors hover:text-mist-100"
            >
              Все доски
            </button>
          ) : null}
          <span className="text-[11.5px] text-mist-500">
            {isCurator ? `${data.student.email} · закреплён за вами` : 'Личная доска заданий'}
          </span>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-[22px] font-semibold tracking-[-0.025em] text-white sm:text-[26px]">
              {data.board.title}
            </h1>
            <p className="mt-1 text-[13px] text-mist-400">
              {data.cards.length} заданий · {done} готово · {data.cards.filter((c) => c.status === 'review').length} на проверке
              {data.cards.some((c) => c.isOverdue) ? (
                <span className="text-accent-300">
                  {' '}
                  · {data.cards.filter((c) => c.isOverdue).length} просрочено
                </span>
              ) : null}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => setModulesOpen(true)}>
              Модули
            </Button>
            <Button
              onClick={() => setCreateOpen(true)}
              disabled={data.modules.length === 0}
              title={data.modules.length === 0 ? 'Сначала создайте модуль' : undefined}
            >
              Новое задание
            </Button>
          </div>
        </div>
      </div>

      <div className="panel mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-white">{progress}%</span>
          <span className="text-[11px] text-mist-400">прогресс</span>
        </div>
        <Progress value={progress} size="sm" className="min-w-[120px] max-w-[280px] flex-1" />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
          {CARD_STATUSES.map((item) => (
            <span key={item.id} className="inline-flex items-center gap-1.5 text-mist-400">
              <span className={cn('h-1.5 w-1.5 rounded-full', item.dot)} />
              {item.title}
              <b className="font-semibold text-mist-200">
                {data.cards.filter((card) => card.status === item.id).length}
              </b>
            </span>
          ))}
        </div>
        {isCurator ? (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => navigate(`/app/analytics?student=${data.student.id}`)}
          >
            Аналитика ученика
          </Button>
        ) : null}
      </div>

      <div className="panel mb-4 flex flex-wrap items-center gap-2 p-2.5">
        <div className="relative min-w-[180px] flex-1 sm:max-w-[240px]">
          <Input
            value={query}
            onChange={(event) => setFilter('q', event.target.value)}
            placeholder="Поиск по заданиям…"
            className="h-9 text-[12.5px]"
            aria-label="Поиск по заданиям"
          />
        </div>
        <SimpleSelect
          value={moduleId || 'all'}
          onValueChange={(value) => setFilter('module', value === 'all' ? '' : value)}
          options={[
            { value: 'all', label: 'Все модули' },
            ...data.modules.map((module) => ({ value: module.id, label: module.title })),
          ]}
          className="h-9 w-[170px] text-[12.5px]"
          aria-label="Фильтр по модулю"
        />
        <SimpleSelect
          value={status || 'all'}
          onValueChange={(value) => setFilter('status', value === 'all' ? '' : value)}
          options={[
            { value: 'all', label: 'Все статусы' },
            ...CARD_STATUSES.map((item) => ({ value: item.id, label: item.title })),
          ]}
          className="h-9 w-[150px] text-[12.5px]"
          aria-label="Фильтр по статусу"
        />
        <SimpleSelect
          value={deadline}
          onValueChange={(value) => setFilter('deadline', value === 'all' ? '' : value)}
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
          onClick={() => setFilter('overdue', overdue ? '' : '1')}
          className={cn(
            'inline-flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-[12px] font-medium transition-colors',
            overdue
              ? 'border-accent-500/40 bg-accent-500/[0.12] text-accent-300'
              : 'border-white/[0.09] bg-white/[0.03] text-mist-300 hover:bg-white/[0.06]',
          )}
          aria-pressed={overdue}
        >
          Просрочка
        </button>
        {hasFilters ? (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9">
            Сбросить
          </Button>
        ) : null}
        <span className="ml-auto text-[11px] text-mist-500">
          Найдено: <b className="font-semibold text-mist-200">{filtered.length}</b>
        </span>
      </div>

      {data.modules.length === 0 ? (
        <EmptyState
          title="Доска пока пустая"
          description={
            isCurator
              ? 'Добавьте первый модуль, затем создайте задания для ученика.'
              : 'Создайте модуль и добавьте первые задания — или попросите куратора наполнить доску.'
          }
          action={
            <Button onClick={() => setModulesOpen(true)}>
              Создать модуль
            </Button>
          }
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveCard(null)}
        >
          <div className="scroll-x flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 lg:snap-none">
            {CARD_STATUSES.map((column) => (
              <BoardColumn
                key={column.id}
                status={column.id}
                cards={filtered.filter((card) => card.status === column.id)}
                role={role}
                activeFrom={activeCard?.status ?? null}
                dragging={Boolean(activeCard)}
                onOpen={openCard}
                onAdvance={quickAdvance}
                onAdd={column.id === 'backlog' ? () => setCreateOpen(true) : undefined}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={null}>
            {activeCard ? (
              <div className="w-[270px] rotate-1 rounded-xl border border-brand-500/40 bg-ink-850 p-3 shadow-raised">
                <p className="text-[10px] text-mist-400">{activeCard.moduleTitle}</p>
                <p className="mt-1 line-clamp-2 text-[12.5px] font-medium text-white">
                  {activeCard.title}
                </p>
                <p className="mt-2 text-[10px] text-brand-300">Переместить в другую колонку</p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.05] bg-white/[0.015] px-3 py-2.5 text-[10.5px] text-mist-500">
        <span>
          {isCurator
            ? 'Перетащите задание из «На проверке» в «Готово» или «На доработку». Возврат требует комментария.'
            : 'Перетащите карточку или используйте кнопку на мобильном. Статус «Готово» устанавливает куратор.'}
        </span>
        <span className="inline-flex items-center gap-1.5">
          Изменения сохраняются автоматически
        </span>
      </div>

      <CreateCardDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        modules={data.modules}
        defaultModuleId={moduleId || undefined}
      />
      <ManageModulesDialog
        open={modulesOpen}
        onOpenChange={setModulesOpen}
        boardId={data.board.id}
        modules={data.modules}
        cardCounts={cardCounts}
      />
      <CardDetailSheet
        cardId={cardParam}
        initialMode={detailMode}
        onClose={closeCard}
      />

      <div className="sr-only" aria-live="polite">
        {activeCard ? `Перетаскивается задание ${activeCard.title}` : ''}
      </div>
    </Page>
  )
}
