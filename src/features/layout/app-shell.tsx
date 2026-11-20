import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Sheet, SheetContent } from '@/components/ui/overlay'
import { SidebarContent } from './sidebar'
import { Topbar } from './topbar'
import { useAuth } from '@/features/auth/auth-context'
import { api } from '@/services/api'
import { qk, INVALIDATION_KEYS } from '@/lib/query-keys'
import { cn } from '@/lib/utils'

function MobileTabBar({ onMore }: { onMore: () => void }) {
  const { profile } = useAuth()
  const role = profile?.role ?? 'student'

  const studentTabs = [
    { to: '/app/home', label: 'Главная' },
    { to: '/app/board', label: 'Доска' },
    { to: '/app/modules', label: 'Модули' },
    { to: '/app/notifications', label: 'События' },
    { to: '/app/profile', label: 'Профиль' },
  ]
  const curatorTabs = [
    { to: '/app/overview', label: 'Обзор' },
    { to: '/app/students', label: 'Ученики' },
    { to: '/app/reviews', label: 'Проверки' },
    { to: '/app/analytics', label: 'Аналитика' },
  ]
  const tabs = role === 'curator' ? curatorTabs : studentTabs

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.08] bg-ink-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      aria-label="Мобильная навигация"
    >
      <div className="flex h-16 items-stretch">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center justify-center gap-1 px-1 text-center text-[10.5px] font-medium transition-colors',
                isActive ? 'text-brand-300' : 'text-mist-500 hover:text-mist-200',
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
        {role === 'curator' ? (
          <button
            type="button"
            onClick={onMore}
            className="flex flex-1 flex-col items-center justify-center px-1 text-[10.5px] font-medium text-mist-500 transition-colors hover:text-mist-200"
          >
            Ещё
          </button>
        ) : null}
      </div>
    </nav>
  )
}

export function AppShell() {
  const queryClient = useQueryClient()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('vector.sidebar') === '1')
  const [mobileOpen, setMobileOpen] = useState(false)

  const toggleSidebar = () => {
    setCollapsed((value) => {
      localStorage.setItem('vector.sidebar', value ? '0' : '1')
      return !value
    })
  }

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    let timer: number | undefined
    const unsubscribe = api.realtime.subscribe(() => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        INVALIDATION_KEYS.forEach((key) => {
          void queryClient.invalidateQueries({ queryKey: key })
        })
      }, 400)
    })
    return () => {
      unsubscribe()
      window.clearTimeout(timer)
    }
  }, [queryClient])

  useEffect(() => {
    const run = async () => {
      try {
        const created = await api.reminders.run()
        if (created > 0) {
          await queryClient.invalidateQueries({ queryKey: qk.notifications })
        }
      } catch {
        // Напоминания обслуживаются сервером; локальная ошибка не блокирует интерфейс.
      }
    }
    void run()
    const interval = window.setInterval(run, 5 * 60 * 1000)
    return () => window.clearInterval(interval)
  }, [queryClient])

  return (
    <div className="min-h-screen bg-ink-900">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden border-r border-white/[0.06] transition-[width] duration-200 md:block',
          collapsed ? 'w-[76px]' : 'w-[260px]',
        )}
      >
        <SidebarContent collapsed={collapsed} onToggle={toggleSidebar} />
      </aside>

      <div
        className={cn(
          'flex min-h-screen flex-col transition-[padding] duration-200',
          collapsed ? 'md:pl-[76px]' : 'md:pl-[260px]',
        )}
      >
        <Topbar onOpenMenu={() => setMobileOpen(true)} />
        <main className="flex-1">
          <Outlet />
        </main>
      </div>

      <MobileTabBar onMore={() => setMobileOpen(true)} />

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" hideClose className="w-[284px] border-r border-white/10 p-0">
          <SidebarContent
            collapsed={false}
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </div>
  )
}
