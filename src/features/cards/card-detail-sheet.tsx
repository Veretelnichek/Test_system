import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/overlay'
import { Avatar, Badge, EmptyState, Skeleton } from '@/components/ui/data'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/form'
import { StatusBadge } from './status-badge'
import { api } from '@/services/api'
import { qk, INVALIDATION_KEYS } from '@/lib/query-keys'
import { REVIEW_MIN_COMMENT, STATUS_MAP } from '@/lib/constants'
import { useAuth } from '@/features/auth/auth-context'
import { cn, formatDate, formatDateTime, hoursSince, timeAgo } from '@/lib/utils'
import type { CardStatus } from '@/types'

function MetaItem({
  label,
  value,
  hint,
}: {
  label: string
  value: React.ReactNode
  hint?: string
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-[0.1em] text-mist-500">{label}</p>
      <div className="mt-1 text-[12.5px] font-medium text-mist-100">{value}</div>
      {hint ? <p className="mt-0.5 text-[10.5px] text-mist-500">{hint}</p> : null}
    </div>
  )
}

function nextStudentStatus(status: CardStatus): CardStatus | null {
  if (status === 'backlog') return 'in_progress'
  if (status === 'in_progress' || status === 'revision') return 'review'
  return null
}

export function CardDetailSheet({
  cardId,
  onClose,
  initialMode = 'view',
}: {
  cardId: string | null
  onClose: () => void
  initialMode?: 'view' | 'return'
}) {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [comment, setComment] = useState('')
  const [returnMode, setReturnMode] = useState(initialMode === 'return')
  const [returnComment, setReturnComment] = useState('')
  const [returnError, setReturnError] = useState<string | null>(null)

  useEffect(() => {
    setReturnMode(initialMode === 'return')
    setReturnComment('')
    setReturnError(null)
    setComment('')
  }, [cardId, initialMode])

  const { data, isLoading, isError } = useQuery({
    queryKey: qk.card(cardId ?? 'none'),
    queryFn: () => api.cards.get(cardId!),
    enabled: Boolean(cardId),
  })

  const invalidate = () => {
    INVALIDATION_KEYS.forEach((key) => {
      void queryClient.invalidateQueries({ queryKey: key })
    })
    if (cardId) void queryClient.invalidateQueries({ queryKey: qk.card(cardId) })
  }

  const move = useMutation({
    mutationFn: ({ to, text }: { to: CardStatus; text?: string }) =>
      api.cards.move(cardId!, to, text),
    onSuccess: (_result, variables) => {
      invalidate()
      setReturnMode(false)
      setReturnComment('')
      setReturnError(null)
      toast.success(
        variables.to === 'done'
          ? 'Задание принято'
          : variables.to === 'revision'
            ? 'Задание возвращено на доработку'
            : variables.to === 'review'
              ? 'Задание отправлено на проверку'
              : 'Статус обновлён',
      )
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Не удалось изменить статус')
    },
  })

  const addComment = useMutation({
    mutationFn: (text: string) => api.cards.addComment(cardId!, text),
    onSuccess: () => {
      setComment('')
      invalidate()
      toast.success('Комментарий добавлен')
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Не удалось добавить комментарий')
    },
  })

  const card = data?.card
  const role = profile?.role ?? 'student'
  const isStudentOwner = role === 'student' && card?.assigneeId === profile?.id
  const studentNext = card ? nextStudentStatus(card.status) : null

  const submitReturn = () => {
    const value = returnComment.trim()
    if (value.length < REVIEW_MIN_COMMENT) {
      setReturnError(`Комментарий должен содержать минимум ${REVIEW_MIN_COMMENT} символов`)
      return
    }
    move.mutate({ to: 'revision', text: value })
  }

  const submitComment = () => {
    const value = comment.trim()
    if (!value) return
    addComment.mutate(value)
  }

  return (
    <Sheet open={Boolean(cardId)} onOpenChange={(open) => (open ? null : onClose())}>
      <SheetContent className="sm:max-w-[620px]">
        {isLoading ? (
          <div className="space-y-4 p-6 pt-16">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-8 w-4/5" />
            <Skeleton className="h-24 w-full" />
            <div className="grid grid-cols-2 gap-2">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          </div>
        ) : isError || !data || !card ? (
          <div className="p-6 pt-16">
            <EmptyState
              title="Задание недоступно"
              description="Возможно, оно было удалено или у вас нет прав на просмотр."
              action={<Button onClick={onClose}>Закрыть</Button>}
            />
          </div>
        ) : (
          <div className="flex h-full flex-col">
            <div className="border-b border-white/[0.07] px-5 pb-4 pr-14 pt-5">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={card.status} />
                <Badge tone="outline" dot="" className="border-white/10">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: card.moduleColor }}
                  />
                  {card.moduleTitle}
                </Badge>
                {card.isOverdue ? <Badge tone="accent">Просрочено</Badge> : null}
              </div>
              <h2 className="mt-3 text-[19px] font-semibold leading-snug tracking-[-0.02em] text-white">
                {card.title}
              </h2>
              {role === 'curator' ? (
                <p className="mt-1 text-[11.5px] text-mist-400">
                  {card.studentName} · {card.studentId ? 'доска ученика' : ''}
                </p>
              ) : null}
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="px-5 py-4">
                {card.description ? (
                  <p className="prose-note">{card.description}</p>
                ) : (
                  <p className="text-[12.5px] italic text-mist-500">Описание не заполнено</p>
                )}

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <MetaItem
                    label="Исполнитель"
                    value={
                      <span className="flex items-center gap-1.5">
                        <Avatar name={card.assigneeName} src={card.assigneeAvatar} size="xs" />
                        <span className="truncate">{card.assigneeName}</span>
                      </span>
                    }
                  />
                  <MetaItem
                    label="Дедлайн"
                    value={card.deadline ? formatDate(card.deadline) : 'Без дедлайна'}
                    hint={card.deadline ? timeAgo(card.deadline) : undefined}
                  />
                  <MetaItem
                    label="В текущем статусе"
                    value={`${Math.max(1, Math.round(hoursSince(card.statusSince)))} ч`}
                    hint={`с ${formatDateTime(card.statusSince)}`}
                  />
                  <MetaItem
                    label="Комментарии"
                    value={card.commentsCount}
                    hint={`создано ${formatDate(card.createdAt)}`}
                  />
                </div>

                <div className="mt-4 rounded-xl border border-white/[0.07] bg-ink-950/40 p-3">
                  {role === 'curator' && card.status === 'review' ? (
                    returnMode ? (
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-[12.5px] font-semibold text-white">
                            Возврат на доработку
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setReturnMode(false)
                              setReturnError(null)
                            }}
                            className="text-[11.5px] text-mist-400 hover:text-mist-100"
                          >
                            Отмена
                          </button>
                        </div>
                        <Textarea
                          value={returnComment}
                          onChange={(event) => {
                            setReturnComment(event.target.value)
                            setReturnError(null)
                          }}
                          placeholder="Что нужно доработать? Комментарий обязателен и должен содержать минимум 10 символов."
                          className="min-h-[100px] bg-ink-900"
                          aria-label="Комментарий к возврату"
                          autoFocus
                        />
                        <div className="mt-2 flex items-center justify-between">
                          <span
                            className={cn(
                              'text-[10.5px]',
                              returnComment.trim().length < REVIEW_MIN_COMMENT
                                ? 'text-mist-500'
                                : 'text-emerald-400',
                            )}
                          >
                            {returnComment.trim().length} / минимум {REVIEW_MIN_COMMENT}
                          </span>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={submitReturn}
                            loading={move.isPending}
                            disabled={returnComment.trim().length < REVIEW_MIN_COMMENT}
                          >
                            Вернуть на доработку
                          </Button>
                        </div>
                        {returnError ? (
                          <p className="mt-1.5 text-[11.5px] text-accent-300">{returnError}</p>
                        ) : null}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-[12.5px] font-semibold text-white">Нужно решение</p>
                          <p className="text-[11px] text-mist-400">
                            Проверьте работу и примите или верните с комментарием.
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Button size="sm" variant="danger" onClick={() => setReturnMode(true)}>
                            Вернуть
                          </Button>
                          <Button
                            size="sm"
                            className="bg-emerald-500 hover:bg-emerald-400"
                            onClick={() => move.mutate({ to: 'done' })}
                            loading={move.isPending}
                          >
                            Принять
                          </Button>
                        </div>
                      </div>
                    )
                  ) : null}

                  {isStudentOwner && studentNext ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-[12.5px] font-semibold text-white">
                          {studentNext === 'review' ? 'Работа готова?' : 'Готовы начать?'}
                        </p>
                        <p className="text-[11px] text-mist-400">
                          {studentNext === 'review'
                            ? 'Отправьте задание куратору — он проверит и даст обратную связь.'
                            : 'Возьмите задание в работу, чтобы отметить прогресс.'}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={studentNext === 'review' ? 'accent' : 'primary'}
                        className="shrink-0"
                        onClick={() => move.mutate({ to: studentNext })}
                        loading={move.isPending}
                      >
                        {studentNext === 'review' ? 'Сдать на проверку' : 'Взять в работу'}
                      </Button>
                    </div>
                  ) : null}

                  {card.status === 'review' && role === 'student' ? (
                    <p className="text-[12px] leading-relaxed text-mist-300">
                      Задание ожидает проверки куратором. Можно добавить уточнение в комментариях.
                    </p>
                  ) : null}

                  {card.status === 'done' ? (
                    <p className="text-[12px] text-emerald-300">Задание принято куратором.</p>
                  ) : null}

                  {role === 'curator' && card.status !== 'review' ? (
                    <p className="text-[11.5px] leading-relaxed text-mist-400">
                      Куратор принимает решения по заданиям из колонки «На проверке».
                    </p>
                  ) : null}
                </div>

                <Tabs defaultValue="comments" className="mt-4">
                  <TabsList className="w-full justify-start">
                    <TabsTrigger value="comments">
                      Обсуждение
                      <span className="ml-1 text-mist-500">{data.comments.length}</span>
                    </TabsTrigger>
                    <TabsTrigger value="history">
                      История
                      <span className="ml-1 text-mist-500">{data.events.length}</span>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="comments">
                    <div className="space-y-3">
                      {data.comments.length ? (
                        data.comments.map((item) => (
                          <div key={item.id} className="flex gap-2.5">
                            <Avatar name={item.authorName} src={item.authorAvatar} size="sm" />
                            <div className="min-w-0 flex-1 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[12px] font-semibold text-white">
                                  {item.authorName}
                                </span>
                                <Badge
                                  tone={item.authorRole === 'curator' ? 'brand' : 'muted'}
                                  className="px-1.5 py-0 text-[9.5px]"
                                >
                                  {item.authorRole === 'curator' ? 'Куратор' : 'Ученик'}
                                </Badge>
                                <span className="text-[10px] text-mist-500">
                                  {timeAgo(item.createdAt)}
                                </span>
                              </div>
                              <p className="mt-1 whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-mist-200">
                                {item.text}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <EmptyState
                          compact
                          title="Комментариев пока нет"
                          description="Задайте вопрос или оставьте уточнение по заданию."
                        />
                      )}

                      <div className="rounded-xl border border-white/[0.08] bg-ink-950/50 p-2">
                        <Textarea
                          value={comment}
                          onChange={(event) => setComment(event.target.value)}
                          placeholder="Написать комментарий…"
                          className="min-h-[72px] border-0 bg-transparent p-1.5 focus:ring-0"
                          aria-label="Новый комментарий"
                        />
                        <div className="flex items-center justify-between px-1 pb-0.5">
                          <span className="text-[10px] text-mist-500">До 4000 символов</span>
                          <Button
                            size="sm"
                            onClick={submitComment}
                            disabled={!comment.trim()}
                            loading={addComment.isPending}
                          >
                            Отправить
                          </Button>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="history">
                    <div className="space-y-0">
                      {[...data.events].reverse().map((event, index) => (
                        <div key={event.id} className="relative flex gap-3 pb-4">
                          {index < data.events.length - 1 ? (
                            <span className="absolute left-[13px] top-6 h-full w-px bg-white/[0.08]" />
                          ) : null}
                          <span className="relative z-10 mt-0.5 flex h-[27px] w-[27px] shrink-0 items-center justify-center rounded-full border border-white/10 bg-ink-850">
                            <span
                              className={cn(
                                'h-2 w-2 rounded-full',
                                STATUS_MAP[event.toStatus].dot,
                              )}
                            />
                          </span>
                          <div className="min-w-0 flex-1 pt-0.5">
                            <p className="text-[12px] text-mist-200">
                              <span className="font-medium text-white">{event.actorName}</span>{' '}
                              {event.fromStatus ? (
                                <>
                                  перевёл(а) из{' '}
                                  <span className="text-mist-300">
                                    «{STATUS_MAP[event.fromStatus].title}»
                                  </span>{' '}
                                  в{' '}
                                </>
                              ) : (
                                'создал(а) задание в '
                              )}
                              <span className="font-medium text-mist-100">
                                «{STATUS_MAP[event.toStatus].title}»
                              </span>
                            </p>
                            <p className="mt-0.5 text-[10.5px] text-mist-500">
                              {formatDateTime(event.createdAt)} · {timeAgo(event.createdAt)}
                            </p>
                            {event.comment ? (
                              <p className="mt-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-[11.5px] leading-relaxed text-mist-300">
                                {event.comment}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>

            <div className="border-t border-white/[0.07] px-5 py-3">
              <div className="flex items-center justify-between text-[10.5px] text-mist-500">
                <span>Последнее изменение: {formatDateTime(card.updatedAt)}</span>
                <span className="inline-flex items-center gap-1.5">
                  {move.isPending || addComment.isPending ? (
                    <>
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/25 border-t-brand-300" />
                      Сохранение…
                    </>
                  ) : (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Синхронизировано
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
