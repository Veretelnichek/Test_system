import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Avatar, Badge } from '@/components/ui/data'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/overlay'
import { NotificationsBell } from './notifications-bell'
import { GlobalSearch } from './global-search'
import { ROUTE_META } from './nav-config'
import { useAuth } from '@/features/auth/auth-context'
import { ROLE_LABEL } from '@/lib/constants'
import { fullName } from '@/lib/utils'

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchOpen, setSearchOpen] = useState(false)

  const isBoardDetail = location.pathname.startsWith('/app/boards/')
  const meta = isBoardDetail
    ? { title: 'Доска ученика', section: 'Кураторство' }
    : ROUTE_META[location.pathname] ?? { title: 'Рабочее пространство', section: 'Vector' }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen((value) => !value)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const name = profile ? fullName(profile.firstName, profile.lastName) : 'Пользователь'

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-ink-900/85 backdrop-blur-xl">
        <div className="flex h-16 items-center gap-2.5 px-4 sm:gap-3 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={onOpenMenu}
            className="rounded-lg border border-white/[0.09] px-2.5 py-1.5 text-[11px] font-medium text-mist-400 transition-colors hover:bg-white/[0.06] hover:text-white sm:hidden"
            aria-label="Открыть навигацию"
          >
            Меню
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-mist-500">
              <span>{meta.section}</span>
              <span className="text-mist-600">/</span>
              <span className="truncate text-mist-400">{meta.title}</span>
            </div>
            <h2 className="truncate text-[14px] font-semibold tracking-[-0.01em] text-white">
              {meta.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="hidden h-9 w-[220px] items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 text-left text-[12.5px] text-mist-500 transition-colors hover:border-white/[0.14] hover:bg-white/[0.04] lg:flex"
          >
            <span>Поиск</span>
            <span className="kbd">Ctrl K</span>
          </button>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="rounded-lg border border-white/[0.09] px-2 py-1.5 text-[11px] font-medium text-mist-400 transition-colors hover:bg-white/[0.06] hover:text-white lg:hidden"
            aria-label="Поиск"
          >
            Поиск
          </button>

          <NotificationsBell />

          <div className="mx-0.5 hidden h-6 w-px bg-white/[0.08] sm:block" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 rounded-xl p-1 pr-1.5 transition-colors hover:bg-white/[0.05]"
                aria-label="Меню профиля"
              >
                <Avatar name={name} src={profile?.avatarUrl} size="sm" />
                <span className="hidden max-w-[120px] truncate text-[12.5px] font-medium text-mist-200 sm:block">
                  {profile?.firstName}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <div className="px-2.5 py-2">
                <p className="truncate text-[13px] font-semibold text-white">{name}</p>
                <p className="truncate text-[11.5px] text-mist-500">{profile?.email}</p>
                <Badge tone={profile?.role === 'curator' ? 'brand' : 'muted'} className="mt-2">
                  {profile ? ROLE_LABEL[profile.role] : ''}
                </Badge>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Аккаунт</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => navigate('/app/profile')}>
                Профиль и настройки
              </DropdownMenuItem>
              {profile?.role === 'student' ? (
                <DropdownMenuItem onSelect={() => navigate('/app/join')}>
                  Присоединиться к куратору
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                danger
                onSelect={() => {
                  void signOut().then(() => navigate('/login', { replace: true }))
                }}
              >
                Выйти
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  )
}
