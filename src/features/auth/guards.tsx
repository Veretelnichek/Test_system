import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth, homePath } from './auth-context'
import { LogoMark } from '@/components/ui/logo'
import type { Role } from '@/types'

export function FullScreenLoader({ label = 'Загружаем рабочее пространство' }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink-900">
      <div className="relative">
        <LogoMark className="h-11 w-11" />
        <span className="absolute inset-0 -z-10 animate-ping rounded-[10px] bg-brand-500/20" />
      </div>
      <div className="flex items-center gap-2 text-[13px] text-mist-400">
        <span
          aria-hidden
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-mist-400 border-t-transparent"
        />
        {label}
      </div>
    </div>
  )
}

export function RequireAuth() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullScreenLoader />
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  if (!session.profile.approved) return <Navigate to="/pending" replace />
  return <Outlet />
}

export function RoleRoute({ role }: { role: Role }) {
  const { profile } = useAuth()
  if (!profile) return <Navigate to="/login" replace />
  if (profile.role !== role) return <Navigate to={homePath(profile.role)} replace />
  return <Outlet />
}
