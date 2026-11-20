import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/ui/logo'
import { useAuth, homePath } from './auth-context'

export function PendingPage() {
  const { session, loading, refresh, signOut } = useAuth()
  const navigate = useNavigate()
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!session) navigate('/login', { replace: true })
    else if (session.profile.approved) navigate(homePath(session.profile.role), { replace: true })
  }, [session, loading, navigate])

  const check = async () => {
    setChecking(true)
    try {
      await refresh()
      toast.message('Статус проверен. Если администратор подтвердил доступ, вы попадёте в кабинет.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-ink-900 px-5 py-10">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[380px] w-[600px] -translate-x-1/2 rounded-full bg-brand-500/[0.12] blur-[130px]" />

      <div className="relative w-full max-w-[480px]">
        <div className="mb-7 flex justify-center">
          <Logo />
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-ink-850/90 p-6 shadow-raised backdrop-blur">
          <h1 className="text-[21px] font-semibold tracking-[-0.02em] text-white">
            Заявка на рассмотрении
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-mist-400">
            Аккаунт куратора создан, но доступ к рабочим данным откроется после подтверждения
            администратором. Это защищает учеников от несогласованного доступа.
          </p>

          <div className="mt-5 space-y-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
            <div className="flex items-center gap-2.5 text-[12.5px] text-mist-200">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
              Email подтверждён: {session?.profile.email ?? '—'}
            </div>
            <div className="flex items-center gap-2.5 text-[12.5px] text-mist-200">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
              Роль: куратор
            </div>
            <div className="flex items-center gap-2.5 text-[12.5px] text-mist-400">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
              Статус: ожидает подтверждения
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-2">
            <Button onClick={check} loading={checking}>
              Проверить статус
            </Button>
            <Button variant="ghost" onClick={() => void signOut()}>
              Выйти из аккаунта
            </Button>
          </div>
        </div>

        <p className="mt-5 text-center text-[11.5px] leading-relaxed text-mist-500">
          Администратор подтверждает доступ командой{' '}
          <code className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10.5px]">
            select public.admin_approve_curator('email')
          </code>{' '}
          в Supabase SQL Editor.
        </p>
      </div>
    </div>
  )
}
