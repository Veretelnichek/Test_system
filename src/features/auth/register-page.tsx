import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { AuthAlert, AuthHeading, AuthShell } from './auth-layout'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/form'
import { registerSchema, type RegisterValues } from '@/lib/validation'
import { api, isLocalMode } from '@/services/api'
import { useAuth, homePath } from './auth-context'
import { cn } from '@/lib/utils'

function PasswordStrength({ value }: { value: string }) {
  const checks = [
    value.length >= 8,
    /[A-Za-zА-Яа-я]/.test(value) && /\d/.test(value),
    /[A-ZА-Я]/.test(value),
    /[^A-Za-zА-Яа-я0-9]/.test(value),
  ]
  const score = checks.filter(Boolean).length
  const labels = ['Слишком простой', 'Простой', 'Хороший', 'Надёжный']
  const colors = ['bg-accent-500', 'bg-amber-400', 'bg-brand-400', 'bg-emerald-400']
  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors',
              index < score ? colors[Math.max(0, score - 1)] : 'bg-white/[0.08]',
            )}
          />
        ))}
      </div>
      <p className="mt-1.5 text-[11.5px] text-mist-500">
        {value ? labels[Math.max(0, score - 1)] : 'Минимум 8 символов, буквы и цифры'}
      </p>
    </div>
  )
}

export function RegisterPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { refresh } = useAuth()
  const inviteFromLink = (params.get('invite') ?? params.get('code') ?? '').toUpperCase()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [resending, setResending] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: 'student',
      consent: false,
      inviteCode: inviteFromLink,
    },
  })

  const role = watch('role')
  const password = watch('password')

  const submit = handleSubmit(async (values) => {
    setError(null)
    try {
      const result = await api.auth.signUp({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        password: values.password,
        role: values.role,
      })

      if (result.requiresEmailConfirmation) {
        if (values.inviteCode?.trim()) {
          localStorage.setItem('vector.pendingInvite', values.inviteCode.trim().toUpperCase())
        }
        setSentTo(values.email)
        return
      }

      if (result.pendingApproval) {
        await refresh()
        navigate('/pending', { replace: true })
        return
      }

      if (values.inviteCode?.trim()) {
        try {
          const { curatorName } = await api.students.acceptInvitation(values.inviteCode)
          toast.success(`Вы присоединились к куратору: ${curatorName}`)
        } catch (inviteError) {
          toast.error(
            inviteError instanceof Error
              ? inviteError.message
              : 'Не удалось применить код приглашения',
          )
        }
      }

      await refresh()
      toast.success('Аккаунт создан. Добро пожаловать в Vector!')
      navigate(result.session ? homePath(result.session.profile.role) : '/login', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать аккаунт')
    }
  })

  const resend = async () => {
    if (!sentTo) return
    setResending(true)
    try {
      await api.auth.resendConfirmation(sentTo)
      toast.success('Письмо отправлено повторно')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось отправить письмо')
    } finally {
      setResending(false)
    }
  }

  if (sentTo) {
    return (
      <AuthShell>
        <div className="rounded-2xl border border-white/[0.08] bg-ink-850/70 p-6 text-center shadow-soft">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-500/25 bg-brand-500/[0.12] text-[18px] font-semibold text-brand-300">
            @
          </div>
          <h1 className="text-[20px] font-semibold text-white">Подтвердите email</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-mist-400">
            Мы отправили письмо на <span className="font-medium text-mist-100">{sentTo}</span>.
            Перейдите по ссылке, чтобы активировать аккаунт
            {role === 'curator' ? ' — после подтверждения заявку рассмотрит администратор' : ''}.
          </p>
          <div className="mt-5 space-y-2">
            <Button variant="secondary" className="w-full" onClick={resend} loading={resending}>
              Отправить письмо повторно
            </Button>
            <Button className="w-full" onClick={() => navigate('/login')}>
              Перейти ко входу
            </Button>
          </div>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <AuthHeading
        title="Создать аккаунт"
        subtitle="Присоединяйтесь как ученик или запросите доступ куратора."
      />

      {error ? <AuthAlert>{error}</AuthAlert> : null}

      <form onSubmit={submit} noValidate className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Имя" htmlFor="firstName" error={errors.firstName?.message}>
            <Input
              id="firstName"
              autoComplete="given-name"
              placeholder="Илья"
              aria-invalid={Boolean(errors.firstName)}
              {...register('firstName')}
            />
          </Field>
          <Field label="Фамилия" htmlFor="lastName" error={errors.lastName?.message}>
            <Input
              id="lastName"
              autoComplete="family-name"
              placeholder="Морозов"
              aria-invalid={Boolean(errors.lastName)}
              {...register('lastName')}
            />
          </Field>
        </div>

        <Field label="Email" htmlFor="reg-email" error={errors.email?.message}>
          <Input
            id="reg-email"
            type="email"
            autoComplete="email"
            placeholder="you@company.ru"
            aria-invalid={Boolean(errors.email)}
            {...register('email')}
          />
        </Field>

        <Field label="Пароль" htmlFor="reg-password" error={errors.password?.message}>
          <div className="relative">
            <Input
              id="reg-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Придумайте пароль"
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
          <PasswordStrength value={password ?? ''} />
        </Field>

        <Field
          label="Повторите пароль"
          htmlFor="confirmPassword"
          error={errors.confirmPassword?.message}
        >
          <Input
            id="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Ещё раз"
            aria-invalid={Boolean(errors.confirmPassword)}
            {...register('confirmPassword')}
          />
        </Field>

        <fieldset>
          <legend className="label">Роль</legend>
          <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Роль аккаунта">
            <button
              type="button"
              role="radio"
              aria-checked={role === 'student'}
              onClick={() => setValue('role', 'student', { shouldValidate: true })}
              className={cn(
                'rounded-xl border p-3 text-left transition-colors',
                role === 'student'
                  ? 'border-brand-500/50 bg-brand-500/[0.1]'
                  : 'border-white/[0.09] bg-white/[0.02] hover:border-white/[0.16]',
              )}
            >
              <span className="block text-[13px] font-semibold text-white">Ученик</span>
              <span className="mt-0.5 block text-[11.5px] leading-snug text-mist-400">
                Доска, задания и прогресс
              </span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={role === 'curator'}
              onClick={() => setValue('role', 'curator', { shouldValidate: true })}
              className={cn(
                'rounded-xl border p-3 text-left transition-colors',
                role === 'curator'
                  ? 'border-brand-500/50 bg-brand-500/[0.1]'
                  : 'border-white/[0.09] bg-white/[0.02] hover:border-white/[0.16]',
              )}
            >
              <span className="block text-[13px] font-semibold text-white">Куратор</span>
              <span className="mt-0.5 block text-[11.5px] leading-snug text-mist-400">
                Проверки и аналитика
              </span>
            </button>
          </div>
        </fieldset>

        {role === 'curator' ? (
          <div className="rounded-xl border border-brand-500/20 bg-brand-500/[0.06] px-3 py-2.5 text-[11.5px] leading-relaxed text-mist-300">
            Доступ куратора активируется администратором после проверки. До подтверждения вход
            в рабочее пространство недоступен.
          </div>
        ) : (
          <Field
            label="Код приглашения куратора"
            htmlFor="inviteCode"
            error={errors.inviteCode?.message}
            hint="Необязательно. Код можно ввести позже в профиле."
          >
            <Input
              id="inviteCode"
              placeholder="Например, VECTOR24"
              className="font-mono uppercase tracking-wider"
              {...register('inviteCode')}
            />
          </Field>
        )}

        <label className="flex cursor-pointer items-start gap-2.5 text-[12px] leading-relaxed text-mist-400">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-ink-950 accent-brand-500"
            {...register('consent')}
          />
          <span>
            Я согласен с условиями использования и обработкой персональных данных.
            {errors.consent?.message ? (
              <span className="mt-1 block text-accent-400">{errors.consent.message}</span>
            ) : null}
          </span>
        </label>

        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Создать аккаунт
        </Button>
      </form>

      <p className="mt-6 text-center text-[13px] text-mist-400">
        Уже есть аккаунт?{' '}
        <Link
          to="/login"
          className="font-medium text-brand-300 transition-colors hover:text-brand-200"
        >
          Войти
        </Link>
      </p>

      <p className="mt-4 text-center text-[11px] text-mist-500">
        {isLocalMode
          ? 'Локальный режим: письма не отправляются, аккаунт активен сразу'
          : 'Подтверждение email через Supabase Auth'}
      </p>
    </AuthShell>
  )
}
