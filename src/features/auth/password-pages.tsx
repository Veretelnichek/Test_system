import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { AuthAlert, AuthHeading, AuthShell } from './auth-layout'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/form'
import { forgotSchema, resetSchema, type ResetValues } from '@/lib/validation'
import { api, isLocalMode } from '@/services/api'
import { useAuth, homePath } from './auth-context'

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [devLink, setDevLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ email: string }>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  })

  const submit = handleSubmit(async (values) => {
    setError(null)
    try {
      const result = await api.auth.requestPasswordReset(values.email)
      setDevLink(result.devLink ?? null)
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить письмо')
    }
  })

  if (sent) {
    return (
      <AuthShell>
        <div className="rounded-2xl border border-white/[0.08] bg-ink-850/70 p-6 shadow-soft">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/[0.1] text-[17px] font-semibold text-emerald-300">
            @
          </div>
          <h1 className="text-[21px] font-semibold text-white">Проверьте почту</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-mist-400">
            Если аккаунт с таким email существует, мы отправили ссылку для восстановления пароля.
            Ссылка действует ограниченное время.
          </p>

          {devLink ? (
            <div className="mt-4 rounded-xl border border-brand-500/25 bg-brand-500/[0.07] p-3">
              <p className="text-[11.5px] leading-relaxed text-mist-300">
                Локальный режим не отправляет письма. Используйте ссылку для сброса:
              </p>
              <a
                href={devLink}
                className="mt-2 inline-flex break-all text-[12px] font-medium text-brand-300 underline decoration-brand-500/40 underline-offset-2 hover:text-brand-200"
              >
                {devLink}
              </a>
            </div>
          ) : null}

          <div className="mt-5 flex flex-col gap-2">
            <Link to="/login">
              <Button variant="secondary" className="w-full">
                Вернуться ко входу
              </Button>
            </Link>
            <button
              type="button"
              onClick={() => setSent(false)}
              className="text-[12px] text-mist-500 transition-colors hover:text-mist-200"
            >
              Отправить на другой email
            </button>
          </div>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <Link
        to="/login"
        className="mb-5 inline-block text-[12.5px] text-mist-400 transition-colors hover:text-mist-100"
      >
        Назад ко входу
      </Link>
      <AuthHeading
        title="Восстановление пароля"
        subtitle="Укажите email аккаунта — мы отправим ссылку для создания нового пароля."
      />

      {error ? <AuthAlert>{error}</AuthAlert> : null}

      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="Email" htmlFor="forgot-email" error={errors.email?.message}>
          <Input
            id="forgot-email"
            type="email"
            autoComplete="email"
            placeholder="you@company.ru"
            {...register('email')}
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Отправить ссылку
        </Button>
      </form>
    </AuthShell>
  )
}

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const navigate = useNavigate()
  const { session, refresh } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  const invalid = isLocalMode ? !token : !token && !session

  const submit = handleSubmit(async (values) => {
    setError(null)
    try {
      await api.auth.updatePassword(values.password, token)
      await refresh()
      setDone(true)
      toast.success('Пароль обновлён')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось изменить пароль')
    }
  })

  if (invalid) {
    return (
      <AuthShell>
        <div className="rounded-2xl border border-white/[0.08] bg-ink-850/70 p-6 text-center shadow-soft">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-accent-500/25 bg-accent-500/[0.1] text-[18px] font-semibold text-accent-300">
            !
          </div>
          <h1 className="text-[20px] font-semibold text-white">Ссылка недействительна</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-mist-400">
            Ссылка для восстановления истекла или была использована. Запросите новую.
          </p>
          <Link to="/forgot-password" className="mt-5 block">
            <Button className="w-full">Запросить новую ссылку</Button>
          </Link>
        </div>
      </AuthShell>
    )
  }

  if (done) {
    return (
      <AuthShell>
        <div className="rounded-2xl border border-white/[0.08] bg-ink-850/70 p-6 text-center shadow-soft">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/[0.1] text-[18px] font-semibold text-emerald-300">
            OK
          </div>
          <h1 className="text-[20px] font-semibold text-white">Пароль обновлён</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-mist-400">
            Теперь можно войти в приложение с новым паролем.
          </p>
          <Button
            className="mt-5 w-full"
            onClick={() => navigate(session ? homePath(session.profile.role) : '/login')}
          >
            Продолжить
          </Button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl border border-brand-500/25 bg-brand-500/[0.1] text-[15px] font-semibold text-brand-300">
        NEW
      </div>
      <AuthHeading
        title="Новый пароль"
        subtitle="Придумайте надёжный пароль: минимум 8 символов, буквы и цифры."
      />

      {error ? <AuthAlert>{error}</AuthAlert> : null}

      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="Пароль" htmlFor="new-password" error={errors.password?.message}>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            placeholder="Новый пароль"
            {...register('password')}
          />
        </Field>
        <Field
          label="Повторите пароль"
          htmlFor="new-password-confirm"
          error={errors.confirmPassword?.message}
        >
          <Input
            id="new-password-confirm"
            type="password"
            autoComplete="new-password"
            placeholder="Ещё раз"
            {...register('confirmPassword')}
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Сохранить пароль
        </Button>
      </form>
    </AuthShell>
  )
}
