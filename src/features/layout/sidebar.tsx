import { NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Avatar } from '@/components/ui/data'
import { Tooltip } from '@/components/ui/overlay'
import { Logo, LogoMark } from '@/components/ui/logo'
import { api } from '@/services/api'
import { qk } from '@/lib/query-keys'
import { ROLE_LABEL } from '@/lib/constants'
import { cn, fullName } from '@/lib/utils'
import { useAuth } from '@/features/auth/auth-context'
import { useUnreadCount } from '@/features/notifications/use-notifications'
import { navFor, type NavItem } from './nav-config'

function SidebarLink({
  item,
  collapsed,
  count,
  onNavigate,
}: {
  item: NavItem
  collapsed: boolean
  count: number
  onNavigate?: () => void
}) {
  const link = (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn('nav-item relative', isActive && 'nav-item-active', collapsed && 'justify-center px-0')
      }
    >
      {({ isActive }) => (
        <>
          {isActive ? (
            <span className="absolute left-0 h-5 w-[3px] rounded-r-full bg-brand-400" />
          ) : null}
          {collapsed ? null : <span className="flex-1 truncate">{item.label}</span>}
          {collapsed ? (
            <span className="text-[10px] font-semibold uppercase text-mist-500">
              {item.label.slice(0, 2)}
            </span>
          ) : null}
          {collapsed ? null : count > 0 ? (
            <span
              className={cn(
                'flex h-5 min-w-5 items-center justify-center rounded-md px-1.5 text-[10.5px] font-semibold',
                item.badge === 'reviews'
                  ? 'bg-accent-500/20 text-accent-300'
                  : 'bg-white/[0.08] text-mist-300',
              )}
            >
              {count > 99 ? '99+' : count}
            </span>
          ) : null}
          {collapsed && count > 0 ? (
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-accent-400" />
          ) : null}
        </>
      )}
    </NavLink>
  )

  if (!collapsed) return link
  return (
    <Tooltip content={item.label} side="right">
      {link}
    </Tooltip>
  )
}

export function SidebarContent({
  collapsed,
  onToggle,
  onNavigate,
}: {
  collapsed: boolean
  onToggle?: () => void
  onNavigate?: () => void
}) {
  const { profile, signOut } = useAuth()
  const role = profile?.role ?? 'student'
  const { main, account } = navFor(role)
  const unread = useUnreadCount()
  const { data: queue } = useQuery({
    queryKey: qk.reviews,
    queryFn: () => api.reviews.queue(),
    enabled: role === 'curator',
    staleTime: 30_000,
  })

  const countFor = (item: NavItem) => {
    if (item.badge === 'reviews') return queue?.length ?? 0
    if (item.to === '/app/notifications') return unread
    return 0
  }

  const name = profile ? fullName(profile.firstName, profile.lastName) : 'Пользователь'

  return (
    <div className="flex h-full flex-col bg-ink-950">
      <div
        className={cn(
          'flex h-16 shrink-0 items-center border-b border-white/[0.06] px-4',
          collapsed ? 'justify-center' : 'justify-between',
        )}
      >
        {collapsed ? <LogoMark /> : <Logo />}
        {!collapsed && onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            className="rounded-lg px-2 py-1 text-[11px] font-medium text-mist-400 transition-colors hover:bg-white/[0.06] hover:text-white"
            aria-label="Свернуть боковую панель"
          >
            Свернуть
          </button>
        ) : null}
      </div>

      {collapsed && onToggle ? (
        <div className="flex justify-center pt-2">
          <Tooltip content="Развернуть панель" side="right">
            <button
              type="button"
              onClick={onToggle}
              className="rounded-lg px-2 py-1 text-[11px] font-medium text-mist-400 transition-colors hover:bg-white/[0.06] hover:text-white"
              aria-label="Развернуть боковую панель"
            >
              Открыть
            </button>
          </Tooltip>
        </div>
      ) : null}

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Основная навигация">
        <p
          className={cn(
            'mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-mist-600',
            collapsed && 'sr-only',
          )}
        >
          Рабочее пространство
        </p>
        <div className="space-y-1">
          {main.map((item) => (
            <SidebarLink
              key={item.to}
              item={item}
              collapsed={collapsed}
              count={countFor(item)}
              onNavigate={onNavigate}
            />
          ))}
        </div>

        <p
          className={cn(
            'mb-1.5 mt-6 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-mist-600',
            collapsed && 'sr-only',
          )}
        >
          Аккаунт
        </p>
        <div className="space-y-1">
          {account.map((item) => (
            <SidebarLink
              key={item.to}
              item={item}
              collapsed={collapsed}
              count={countFor(item)}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </nav>

      <div className="shrink-0 border-t border-white/[0.06] p-3">
        <div
          className={cn(
            'flex items-center gap-2.5 rounded-xl p-2',
            collapsed && 'flex-col gap-2 p-0',
          )}
        >
          <Avatar name={name} src={profile?.avatarUrl} size="sm" />
          {collapsed ? null : (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-semibold text-mist-100">{name}</p>
              <p className="truncate text-[10.5px] text-mist-500">
                {profile ? ROLE_LABEL[profile.role] : ''}
              </p>
            </div>
          )}
          <Tooltip content="Выйти из аккаунта" side={collapsed ? 'right' : 'top'}>
            <button
              type="button"
              onClick={() => void signOut()}
              className="shrink-0 rounded-lg border border-white/[0.09] px-2 py-1.5 text-[11px] font-medium text-mist-400 transition-colors hover:bg-white/[0.06] hover:text-white"
              aria-label="Выйти из аккаунта"
            >
              Выйти
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}
