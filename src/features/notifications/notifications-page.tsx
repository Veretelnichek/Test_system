import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Bell, BellOff, CheckCheck, Inbox, TriangleAlert } from 'lucide-react'
import { Page, PageHeader } from '@/features/layout/page'
import { EmptyState, Panel, Skeleton } from '@/components/ui/data'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/overlay'
import { NotificationItem } from '@/features/notifications/notification-item'
import {
  useNotificationMutations,
  useNotifications,
} from '@/features/notifications/use-notifications'

export function NotificationsPage() {
  const [params, setParams] = useSearchParams()
  const filter = params.get('filter') === 'unread' ? 'unread' : 'all'
  const { data, isLoading, isError, refetch } = useNotifications()
  const { markAllRead } = useNotificationMutations()

  const notifications = useMemo(
    () => [...(data ?? [])].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [data],
  )
  const unread = notifications.filter((item) => !item.readAt)
  const visible = filter === 'unread' ? unread : notifications

  const setFilter = (value: string) => {
    const next = new URLSearchParams(params)
    if (value === 'all') next.delete('filter')
    else next.set('filter', value)
    setParams(next, { replace: true })
  }

  const markAll = () => {
    markAllRead.mutate(undefined, {
      onSuccess: () => toast.success('Все уведомления прочитаны'),
      onError: (error) =>
        toast.error(error instanceof Error ? error.message : 'Не удалось обновить уведомления'),
    })
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Центр событий"
        title="Уведомления"
        description="Проверки, возвраты, дедлайны и напоминания о заданиях, которые давно не двигались."
        actions={
          <Button
            variant="secondary"
            onClick={markAll}
            loading={markAllRead.isPending}
            disabled={unread.length === 0}
          >
            <CheckCheck className="h-4 w-4" />
            Прочитать все
          </Button>
        }
      />

      <Tabs value={filter} onValueChange={setFilter}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="all">
              <Inbox className="h-3.5 w-3.5" />
              Все
              <span className="ml-0.5 text-mist-500">{notifications.length}</span>
            </TabsTrigger>
            <TabsTrigger value="unread">
              <Bell className="h-3.5 w-3.5" />
              Непрочитанные
              {unread.length ? (
                <span className="ml-0.5 rounded-md bg-brand-500/20 px-1.5 text-[10px] font-bold text-brand-200">
                  {unread.length}
                </span>
              ) : null}
            </TabsTrigger>
          </TabsList>
          <span className="hidden text-[11px] text-mist-500 sm:block">
            Уведомления приходят автоматически
          </span>
        </div>

        <TabsContent value={filter} className="mt-0">
          <Panel className="overflow-hidden">
            {isLoading ? (
              <div className="space-y-1 p-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-[62px] rounded-xl" />
                ))}
              </div>
            ) : isError ? (
              <div className="p-4">
                <EmptyState
                  icon={<TriangleAlert className="h-5 w-5 text-accent-300" />}
                  title="Не удалось загрузить уведомления"
                  description="Проверьте соединение и повторите попытку."
                  action={<Button onClick={() => void refetch()}>Повторить</Button>}
                />
              </div>
            ) : visible.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={
                    filter === 'unread' ? (
                      <BellOff className="h-5 w-5" />
                    ) : (
                      <Bell className="h-5 w-5" />
                    )
                  }
                  title={filter === 'unread' ? 'Непрочитанных нет' : 'Пока нет уведомлений'}
                  description={
                    filter === 'unread'
                      ? 'Вы просмотрели все события. Новые появятся здесь.'
                      : 'Как только куратор проверит задание или приблизится дедлайн, вы увидите событие здесь.'
                  }
                  action={
                    filter === 'unread' ? (
                      <Button variant="secondary" onClick={() => setFilter('all')}>
                        Показать все
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04] p-1.5">
                {visible.map((notification) => (
                  <NotificationItem key={notification.id} notification={notification} />
                ))}
              </div>
            )}
          </Panel>
        </TabsContent>
      </Tabs>
    </Page>
  )
}
