import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/services/api'
import { qk } from '@/lib/query-keys'
import { useAuth } from '@/features/auth/auth-context'

export function useNotifications() {
  const { profile } = useAuth()
  return useQuery({
    queryKey: qk.notifications,
    queryFn: () => api.notifications.list(),
    enabled: Boolean(profile),
    staleTime: 15_000,
    refetchInterval: 60_000,
  })
}

export function useUnreadCount() {
  const { data } = useNotifications()
  return data?.filter((n) => !n.readAt).length ?? 0
}

export function useNotificationMutations() {
  const queryClient = useQueryClient()
  const markRead = useMutation({
    mutationFn: (id: string) => api.notifications.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.notifications }),
  })
  const markAllRead = useMutation({
    mutationFn: () => api.notifications.markAllRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.notifications }),
  })
  return { markRead, markAllRead }
}
