import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  TriangleAlert,
} from 'lucide-react'
import { Page, PageHeader } from '@/features/layout/page'
import { Avatar, Badge, EmptyState, Skeleton } from '@/components/ui/data'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/overlay'
import { Textarea } from '@/components/ui/form'
import { CardDetailSheet } from '@/features/cards/card-detail-sheet'
import { api } from '@/services/api'
import { qk, INVALIDATION_KEYS } from '@/lib/query-keys'
import { REVIEW_MIN_COMMENT, REVIEW_OVERDUE_HOURS } from '@/lib/constants'
import { cn, formatDateTime } from '@/lib/utils'
import type { ReviewItem } from '@/types'

export function ReviewsPage() {
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const overdueOnly = params.get('overdue') === '1'
  const [returnItem, setReturnItem] = useState<ReviewItem | null>(null)
  const [returnComment, setReturnComment] = useState('')
  const [returnError, setReturnError] = useState<string | null>(null)

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: qk.reviews,
    queryFn: () => api.reviews.queue(),
    refetchInterval: 60_000,
  })

  const invalidate = () => {
    INVALIDATION_KEYS.forEach((key) => {
      void queryClient.invalidateQueries({ queryKey: key })
    })
  }

  const approve = useMutation({
    mutationFn: (cardId: string) => api.reviews.decide(cardId, 'approve'),
    onMutate: async (cardId) => {
      await queryClient.cancelQueries({ queryKey: qk.reviews })
      const previous = queryClient.getQueryData<ReviewItem[]>(qk.reviews)
      if (previous) {
        queryClient.setQueryData(
          qk.reviews,
          previous.filter((item) => item.id !== cardId),
        )
      }
      return { previous }
    },
    onError: (error, _cardId, context) => {
      if (context?.previous) queryClient.setQueryData(qk.reviews, context.previous)
      toast.error(error instanceof Error ? error.message : 'Не удалось принять задание')
    },
    onSuccess: () => toast.success('Задание принято'),
    onSettled: () => invalidate(),
  })

  const returnTask = useMutation({
    mutationFn: ({ cardId, comment }: { cardId: string; comment: string }) =>
      api.reviews.decide(cardId, 'return', comment),
    onSuccess: () => {
      toast.success('Задание возвращено на доработку')
      setReturnItem(null)
      setReturnComment('')
      setReturnError(null)
      invalidate()
    },
    onError: (error) => {
      setReturnError(error instanceof Error ? error.message : 'Не удалось вернуть задание')
    },
  })

  const submitReturn = () => {
    if (!returnItem) return
    const value = returnComment.trim()
    if (value.length < REVIEW_MIN_COMMENT) {
      setReturnError(`Комментарий должен содержать минимум ${REVIEW_MIN_COMMENT} символов`)
      return
    }
    returnTask.mutate({ cardId: returnItem.id, comment: value })
  }

  const queue = data ?? []
  const overdueCount = queue.filter((item) => item.waitingHours > REVIEW_OVERDUE_HOURS).length
  const filtered = overdueOnly
    ? queue.filter((item) => item.waitingHours > REVIEW_OVERDUE_HOURS)
    : queue

  const setOverdue = (value: boolean) => {
    const next = new URLSearchParams(params)
    if (value) next.set('overdue', '1')
    else next.delete('overdue')
    next.delete('card')
    setParams(next, { replace: true })
  }

  const openCard = (cardId: string) => {
    const next = new URLSearchParams(params)
    next.set('card', cardId)
    setParams(next, { replace: true })
  }

  const closeCard = () => {
    const next = new URLSearchParams(params)
    next.delete('card')
    setParams(next, { replace: true })
  }

  return (
    <Page>
      <PageHeader
        eyebrow={<span className="eyebrow">Проверки</span>}
        title="Ждут проверки"
        description="Централизованная очередь: сначала задания с самым долгим ожиданием. Просроченными считаются проверки дольше 24 часов."
        actions={
          <Button variant="secondary" onClick={() => void refetch()} loading={isFetching}>
            <RefreshCw className="h-4 w-4" />
            Обновить
          </Button>
        }
      />

      {overdueCount > 0 ? (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-accent-500/30 bg-accent-500/[0.07] px-4 py-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-accent-500/35 bg-accent-500/15 text-accent-300">
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[13px] font-semibold text-accent-100">
              {overdueCount} проверк{overdueCount === 1 ? 'а' : overdueCount < 5 ? 'и' : ''} ожидает
              более {REVIEW_OVERDUE_HOURS} часов
            </p>
            <p className="mt-0.5 text-[12px] text-mist-300">
              Ученики не могут двигаться дальше без обратной связи. Начните с верхней карточки.
            </p>
          </div>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOverdue(false)}
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-medium transition-colors',
            !overdueOnly
              ? 'border-brand-500/40 bg-brand-500/[0.12] text-brand-200'
              : 'border-white/[0.08] bg-white/[0.02] text-mist-400 hover:text-mist-100',
          )}
          aria-pressed={!overdueOnly}
        >
          Все
          <span className="rounded bg-white/10 px-1 text-[10px]">{queue.length}</span>
        </button>
        <button
          type="button"
          onClick={() => setOverdue(true)}
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-medium transition-colors',
            overdueOnly
              ? 'border-accent-500/40 bg-accent-500/[0.12] text-accent-300'
              : 'border-white/[0.08] bg-white/[0.02] text-mist-400 hover:text-mist-100',
          )}
          aria-pressed={overdueOnly}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Просроченные
          <span className="rounded bg-white/10 px-1 text-[10px]">{overdueCount}</span>
        </button>
        <span className="ml-auto text-[11px] text-mist-500">
          Отсортировано по времени ожидания
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[92px] rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          icon={<TriangleAlert className="h-5 w-5 text-accent-300" />}
          title="Не удалось загрузить очередь"
          description="Проверьте соединение и повторите попытку."
          action={<Button onClick={() => void refetch()}>Повторить</Button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-300" />}
          title={overdueOnly ? 'Просроченных проверок нет' : 'Очередь пуста'}
          description={
            overdueOnly
              ? 'Все задания проверены вовремя. Хорошая работа.'
              : 'Как только ученик отправит задание на проверку, оно появится здесь.'
          }
          action={
            overdueOnly ? (
              <Button variant="secondary" onClick={() => setOverdue(false)}>
                Показать все
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-2.5">
          {filtered.map((item) => {
            const overdue = item.waitingHours > REVIEW_OVERDUE_HOURS
            return (
              <div
                key={item.id}
                className={cn(
                  'panel flex flex-col gap-3 p-3.5 transition-colors sm:flex-row sm:items-center',
                  overdue
                    ? 'border-accent-500/30 bg-accent-500/[0.045] hover:border-accent-500/45'
                    : 'panel-hover',
                )}
              >
                <button
                  type="button"
                  onClick={() => openCard(item.id)}
                  className="flex min-w-0 flex-1 items-start gap-3 text-left"
                >
                  <Avatar name={item.studentName} src={item.assigneeAvatar} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-[13px] font-semibold text-mist-100 hover:text-white">
                        {item.title}
                      </p>
                      {overdue ? (
                        <Badge tone="accent">
                          <AlertTriangle className="h-3 w-3" />
                          просрочено
                        </Badge>
                      ) : null}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-mist-400">
                      <span className="font-medium text-mist-300">{item.studentName}</span>
                      <span className="text-mist-600">·</span>
                      <span className="truncate">{item.moduleTitle}</span>
                      <span className="text-mist-600">·</span>
                      <span>отправлено {formatDateTime(item.submittedAt)}</span>
                      {item.commentsCount > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          {item.commentsCount}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>

                <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                  <span
                    className={cn(
                      'inline-flex min-w-[86px] items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-semibold',
                      overdue
                        ? 'border-accent-500/35 bg-accent-500/10 text-accent-300'
                        : 'border-white/10 bg-white/[0.04] text-mist-300',
                    )}
                    title="Время ожидания проверки"
                  >
                    {overdue ? <AlertTriangle className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
                    {item.waitingHours} ч
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setReturnItem(item)
                      setReturnComment('')
                      setReturnError(null)
                    }}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Вернуть
                  </Button>
                  <Button
                    size="sm"
                    className="bg-emerald-500 hover:bg-emerald-400"
                    onClick={() => approve.mutate(item.id)}
                    loading={approve.isPending && approve.variables === item.id}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Принять
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openCard(item.id)}>
                    Открыть
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between rounded-xl border border-white/[0.05] bg-white/[0.015] px-3 py-2.5 text-[10.5px] text-mist-500">
        <span className="inline-flex items-center gap-1.5">
          <ClipboardCheck className="h-3.5 w-3.5" />
          При возврате обязателен комментарий не короче {REVIEW_MIN_COMMENT} символов
        </span>
        <span>{queue.length} в очереди</span>
      </div>

      <Dialog
        open={Boolean(returnItem)}
        onOpenChange={(open) => {
          if (!open) {
            setReturnItem(null)
            setReturnError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader
            title="Вернуть на доработку"
            description={
              returnItem
                ? `«${returnItem.title}» · ${returnItem.studentName}`
                : undefined
            }
          />
          <Textarea
            value={returnComment}
            onChange={(event) => {
              setReturnComment(event.target.value)
              setReturnError(null)
            }}
            placeholder="Что нужно доработать? Комментарий увидит ученик."
            className="min-h-[120px]"
            autoFocus
            aria-label="Комментарий к возврату"
          />
          <div className="mt-2 flex items-center justify-between">
            <span
              className={cn(
                'text-[11px]',
                returnComment.trim().length < REVIEW_MIN_COMMENT
                  ? 'text-mist-500'
                  : 'text-emerald-400',
              )}
            >
              {returnComment.trim().length} / минимум {REVIEW_MIN_COMMENT}
            </span>
            {returnError ? <span className="text-[11px] text-accent-300">{returnError}</span> : null}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReturnItem(null)}>
              Отмена
            </Button>
            <Button
              variant="danger"
              onClick={submitReturn}
              loading={returnTask.isPending}
              disabled={returnComment.trim().length < REVIEW_MIN_COMMENT}
            >
              <RotateCcw className="h-4 w-4" />
              Вернуть на доработку
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CardDetailSheet cardId={params.get('card')} onClose={closeCard} />
    </Page>
  )
}
