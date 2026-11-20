import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { AuthAlert, AuthHeading, AuthShell } from './auth-layout'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/form'
import { useAuth, homePath } from './auth-context'
import { signInSchema, type SignInValues } from '@/lib/validation'
import { api, isLocalMode } from '@/services/api'
import { DEMO_CURATOR_EMAIL, DEMO_PASSWORD, DEMO_STUDENT_EMAIL } from '@/lib/constants'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { session, refresh } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [demoLoading, setDemoLoading] = useState<'student' | 'curator' | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  })

  const from = (location.state as { from?: string } | null)?.from

  useEffect(() => {
    if (session?.profile.approved) {
      navigate(from ?? homePath(session.profile.role), { replace: true })
    }
  }, [session, navigate, from])

  const submit = handleSubmit(async (values) => {
    setError(null)
    try {
      const result = await api.auth.signIn(values.email, values.password)
      await refresh()
      toast.success(`С возвращением, ${result.profile.firstName}`)
      navigate(from ?? homePath(result.profile.role), { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось выполнить вход')
    }
  })

  const signInDemo = async (role: 'student' | 'curator') => {
    setError(null)
    setDemoLoading(role)
    try {
      const email = role === 'student' ? DEMO_STUDENT_EMAIL : DEMO_CURATOR_EMAIL
      const result = await api.auth.signIn(email, DEMO_PASSWORD)
      await refresh()
      toast.success(`Демо-режим: ${result.profile.firstName} ${result.profile.lastName}`)
      navigate(homePath(result.profile.role), { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Демо-аккаунт недоступен')
    } finally {
      setDemoLoading(null)
    }
  }

  return (
    <AuthShell>
      <AuthHeading
        title="Вход в рабочее пространство"
        subtitle="Введите корпоративный email и пароль, чтобы продолжить."
      />

      {error ? <AuthAlert>{error}</AuthAlert> : null}

      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.ru"
            aria-invalid={Boolean(errors.email)}
            {...register('email')}
          />
        </Field>

        <Field label="Пароль" htmlFor="password" error={errors.password?.message}>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Ваш пароль"
              className="pr-20"
              aria-invalid={Boolean(errors.password)}
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-1.5 top-1/2 flex h-7 -translate-y-1/2 items-center rounded-lg px-2 text-[12px] font-medium text-mist-400 transition-colors hover:bg-white/[0.06] hover:text-white"
              aria-pressed={showPassword}
            >
              {showPassword ? 'Скрыть' : 'Показать'}
            </button>
          </div>
        </Field>

        <div className="flex items-center justify-between pt-0.5">
          <span className="hint">Минимум 8 символов</span>
          <Link
            to="/forgot-password"
            className="text-[12.5px] font-medium text-brand-300 transition-colors hover:text-brand-200"
          >
            Забыли пароль?
          </Link>
        </div>

        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Войти
        </Button>
      </form>

      {isLocalMode ? (
        <div className="mt-6">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-white/[0.07]" />
            <span className="text-[11px] uppercase tracking-[0.12em] text-mist-500">
              Демо-доступ
            </span>
            <div className="h-px flex-1 bg-white/[0.07]" />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => signInDemo('student')}
              disabled={demoLoading !== null || isSubmitting}
            >
              {demoLoading === 'student' ? 'Загрузка…' : 'Войти как ученик'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => signInDemo('curator')}
              disabled={demoLoading !== null || isSubmitting}
            >
              {demoLoading === 'curator' ? 'Загрузка…' : 'Войти как куратор'}
            </Button>
          </div>

          <p className="mt-2.5 text-[11.5px] leading-relaxed text-mist-500">
            Демо использует реальную авторизацию и локальную базу с тестовыми данными.
            Подключите Supabase, чтобы работать с облаком.
          </p>
        </div>
      ) : null}

      <p className="mt-7 text-center text-[13px] text-mist-400">
        Нет аккаунта?{' '}
        <Link
          to="/register"
          className="font-medium text-brand-300 transition-colors hover:text-brand-200"
        >
          Зарегистрироваться
        </Link>
      </p>
    </AuthShell>
  )
}
