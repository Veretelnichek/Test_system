import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/overlay'
import { Avatar, Badge, EmptyState } from '@/components/ui/data'
import { api } from '@/services/api'
import { qk } from '@/lib/query-keys'
import { STATUS_MAP } from '@/lib/constants'
import { useAuth } from '@/features/auth/auth-context'
import { cn } from '@/lib/utils'

export function GlobalSearch({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const role = profile?.role ?? 'student'
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 260)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setDebounced('')
    }
  }, [open])

  const { data, isFetching } = useQuery({
    queryKey: qk.search(debounced),
    queryFn: () => api.search(debounced),
    enabled: open && debounced.length >= 2,
    staleTime: 20_000,
  })

  const openCard = (cardId: string, studentId: string) => {
    onOpenChange(false)
    if (role === 'curator' && studentId) navigate(`/app/boards/${studentId}?card=${cardId}`)
    else navigate(`/app/board?card=${cardId}`)
  }

  const hasResults = Boolean(data && (data.cards.length > 0 || data.students.length > 0))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[14%] max-w-[620px] translate-y-0 p-0" hideClose>
        <DialogHeader title="Поиск по платформе" className="sr-only" />
        <div className="flex items-center gap-2.5 border-b border-white/[0.07] px-4">
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск: задание, модуль или ученик…"
            className="h-12 w-full bg-transparent text-[13.5px] text-mist-100 outline-none placeholder:text-mist-500"
            aria-label="Поисковый запрос"
          />
          {isFetching ? (
            <span
              aria-hidden
              className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-mist-400 border-t-transparent"
            />
          ) : null}
          <span className="kbd shrink-0">Esc</span>
        </div>

        <div className="max-h-[min(56vh,420px)] overflow-y-auto p-2">
          {debounced.length < 2 ? (
            <div className="px-3 py-8 text-center">
              <p className="text-[13px] font-medium text-mist-200">Начните вводить запрос</p>
              <p className="mt-1 text-[12px] text-mist-500">
                Поиск работает по названиям, описаниям и модулям
                {role === 'curator' ? ', а также по ученикам' : ''}.
              </p>
            </div>
          ) : hasResults && data ? (
            <div className="space-y-3">
              {data.cards.length > 0 ? (
                <div>
                  <p className="px-2 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-mist-500">
                    Задания · {data.cards.length}
                  </p>
                  <div className="space-y-0.5">
                    {data.cards.map((card) => {
                      const status = STATUS_MAP[card.status]
                      return (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() => openCard(card.id, card.studentId)}
                          className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/[0.05]"
                        >
                          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', status.dot)} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium text-mist-100">
                              {card.title}
                            </span>
                            <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-mist-500">
                              <span className="truncate">{card.moduleTitle}</span>
                              {role === 'curator' ? (
                                <>
                                  <span>·</span>
                                  <span className="truncate">{card.studentName}</span>
                                </>
                              ) : null}
                            </span>
                          </span>
                          <Badge tone="outline" className="hidden sm:inline-flex">
                            {status.short}
                          </Badge>
                          <span className="text-[10.5px] font-medium text-mist-500">Открыть</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              {data.students.length > 0 ? (
                <div>
                  <p className="px-2 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-mist-500">
                    Ученики · {data.students.length}
                  </p>
                  <div className="space-y-0.5">
                    {data.students.map((student) => (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => {
                          onOpenChange(false)
                          navigate(`/app/boards/${student.id}`)
                        }}
                        className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/[0.05]"
                      >
                        <Avatar
                          name={`${student.firstName} ${student.lastName}`}
                          src={student.avatarUrl}
                          size="sm"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-mist-100">
                            {student.firstName} {student.lastName}
                          </span>
                          <span className="block truncate text-[11px] text-mist-500">
                            {student.email}
                          </span>
                        </span>
                        <span className="text-[10.5px] font-medium text-mist-500">Открыть</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : !isFetching ? (
            <EmptyState
              compact
              title="Ничего не найдено"
              description="Попробуйте другой запрос или проверьте раскладку."
            />
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-white/[0.07] px-4 py-2.5 text-[11px] text-mist-500">
          <span>
            {role === 'curator' ? 'Поиск по вашим ученикам' : 'Поиск по вашим заданиям'}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="kbd">Ctrl</span>
            <span className="kbd">K</span>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
