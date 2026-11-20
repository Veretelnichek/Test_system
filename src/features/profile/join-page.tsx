import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowRight, KeyRound, Link2, TriangleAlert, UserRoundCheck } from 'lucide-react'
import { Page, PageHeader } from '@/features/layout/page'
import { EmptyState, Panel } from '@/components/ui/data'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/form'
import { api } from '@/services/api'
import { INVALIDATION_KEYS } from '@/lib/query-keys'
import { useAuth } from '@/features/auth/auth-context'

export function JoinPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { profile, refresh } = useAuth()
  const [code, setCode] = useState((params.get('code') ?? params.get('invite') ?? '').toUpperCase())
  const [error, setError] = useState<string | null>(null)

  const accept = useMutation({
    mutationFn: (token: string) => api.students.acceptInvitation(token),
    onSuccess: async ({ curatorName }) => {
      INVALIDATION_KEYS.forEach((key) => {
        void queryClient.invalidateQueries({ queryKey: key })
      })
      await refresh()
      toast.success(`Вы присоединились к куратору: ${curatorName}`)
      navigate('/app/home', { replace: true })
    },
    onError: (mutationError) => {
      setError(
        mutationError instanceof Error ? mutationError.message : 'Не удалось принять приглашение',
      )
    },
  })

  if (profile?.role !== 'student') {
    return (
      <Page>
        <EmptyState
          icon={<TriangleAlert className="h-5 w-5 text-accent-300" />}
          title="Присоединение доступно ученикам"
          description="Кураторы приглашают учеников через раздел «Ученики»."
          action={<Button onClick={() => navigate('/app/overview')}>На главную</Button>}
        />
      </Page>
    )
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const token = code.trim().toUpperCase()
    if (token.length < 4) {
      setError('Введите код приглашения')
      return
    }
    setError(null)
    accept.mutate(token)
  }

  return (
    <Page className="max-w-[720px]">
      <PageHeader
        eyebrow="Доступ"
        title="Присоединиться к куратору"
        description="Введите код, который выдал куратор. После подтверждения появится доска с заданиями и обратной связью."
      />

      <Panel className="p-5 sm:p-6">
        <form onSubmit={submit} className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-brand-500/20 bg-brand-500/[0.06] p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brand-500/25 bg-brand-500/[0.1] text-brand-300">
              <Link2 className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[12.5px] font-medium text-brand-100">Где взять код</p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-mist-400">
                Куратор создаёт приглашение в разделе «Ученики» и отправляет код или ссылку. Срок
                действия приглашения — 7 дней.
              </p>
            </div>
          </div>

          <Field label="Код приглашения" htmlFor="invite-code" error={error ?? undefined}>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-500" />
              <Input
                id="invite-code"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="VECTOR24"
                autoComplete="off"
                spellCheck={false}
                className="pl-9 font-mono tracking-[0.18em]"
              />
            </div>
          </Field>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] text-mist-500">
              Текущая связь с куратором будет заменена новой.
            </p>
            <Button type="submit" loading={accept.isPending}>
              <UserRoundCheck className="h-4 w-4" />
              Присоединиться
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </Panel>

      <div className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.015] px-4 py-3 text-[11.5px] leading-relaxed text-mist-500">
        В демо-режиме доступны коды <b className="text-mist-300">VECTOR24</b> и{' '}
        <b className="text-mist-300">STUDY365</b>.
      </div>
    </Page>
  )
}
