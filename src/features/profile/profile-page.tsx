import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  AlertTriangle,
  CalendarDays,
  KeyRound,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
  UserRound,
  UserRoundPlus,
} from 'lucide-react'
import { Page, PageHeader } from '@/features/layout/page'
import { Avatar, Badge, Panel, PanelHeader } from '@/components/ui/data'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/form'
import { useAuth } from '@/features/auth/auth-context'
import { api, isLocalMode } from '@/services/api'
import { passwordChangeSchema, profileSchema } from '@/lib/validation'
import type { PasswordChangeValues, ProfileValues } from '@/lib/validation'
import { ROLE_LABEL } from '@/lib/constants'
import { formatDate, fullName } from '@/lib/utils'

export function ProfilePage() {
  const navigate = useNavigate()
  const { profile, refresh, signOut } = useAuth()

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: profile?.firstName ?? '',
      lastName: profile?.lastName ?? '',
    },
  })

  const passwordForm = useForm<PasswordChangeValues>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  const resetProfileForm = profileForm.reset
  useEffect(() => {
    if (!profile) return
    resetProfileForm({ firstName: profile.firstName, lastName: profile.lastName })
  }, [profile, resetProfileForm])

  if (!profile) return null

  const saveProfile = profileForm.handleSubmit(async (values) => {
    try {
      await api.profile.update(values)
      await refresh()
      toast.success('Профиль обновлён')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось сохранить профиль')
    }
  })

  const changePassword = passwordForm.handleSubmit(async (values) => {
    try {
      await api.auth.updatePassword(values.password)
      passwordForm.reset()
      toast.success('Пароль изменён')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось изменить пароль')
    }
  })

  const logout = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  const resetDemo = () => {
    if (!api.resetDemoData) return
    if (!window.confirm('Сбросить демо-данные? Все изменения будут потеряны, потребуется вход заново.')) {
      return
    }
    api.resetDemoData()
    void signOut().finally(() => navigate('/login', { replace: true }))
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Аккаунт"
        title="Профиль"
        description="Личные данные, безопасность и управление доступом к платформе."
        actions={
          <Button variant="secondary" onClick={() => void logout()}>
            <LogOut className="h-4 w-4" />
            Выйти
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel className="p-5">
          <div className="flex items-start gap-4">
            <Avatar
              name={fullName(profile.firstName, profile.lastName)}
              src={profile.avatarUrl}
              size="xl"
            />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[17px] font-semibold text-white">
                {fullName(profile.firstName, profile.lastName)}
              </h2>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] text-mist-400">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                {profile.email}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone={profile.role === 'curator' ? 'brand' : 'default'}>
                  {ROLE_LABEL[profile.role]}
                </Badge>
                {profile.role === 'curator' ? (
                  <Badge tone={profile.approved ? 'success' : 'accent'}>
                    {profile.approved ? 'Подтверждён' : 'Ожидает подтверждения'}
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-2.5 border-t border-white/[0.06] pt-4 text-[12px]">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-mist-500">
                <CalendarDays className="h-3.5 w-3.5" />
                В платформе с
              </span>
              <span className="text-mist-200">{formatDate(profile.createdAt, 'd MMMM yyyy')}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-mist-500">
                <ShieldCheck className="h-3.5 w-3.5" />
                Доступ
              </span>
              <span className="text-mist-200">
                {profile.role === 'curator' ? 'Управление учениками' : 'Личная доска заданий'}
              </span>
            </div>
          </div>

          {profile.role === 'student' ? (
            <div className="mt-5 rounded-xl border border-brand-500/20 bg-brand-500/[0.06] p-3">
              <p className="text-[12px] font-medium text-brand-100">Смена куратора</p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-mist-400">
                Введите новый код приглашения — текущая связь с куратором будет заменена.
              </p>
              <Button
                size="sm"
                variant="secondary"
                className="mt-2.5"
                onClick={() => navigate('/app/join')}
              >
                <UserRoundPlus className="h-3.5 w-3.5" />
                Присоединиться по коду
              </Button>
            </div>
          ) : null}

          {isLocalMode ? (
            <div className="mt-5 rounded-xl border border-accent-500/25 bg-accent-500/[0.06] p-3">
              <p className="flex items-center gap-1.5 text-[12px] font-medium text-accent-200">
                <AlertTriangle className="h-3.5 w-3.5" />
                Демо-режим
              </p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-mist-400">
                Данные хранятся в localStorage браузера. Сброс вернёт исходных учеников, задания и
                приглашения.
              </p>
              <Button size="sm" variant="danger" className="mt-2.5" onClick={resetDemo}>
                <RefreshCw className="h-3.5 w-3.5" />
                Сбросить демо-данные
              </Button>
            </div>
          ) : null}
        </Panel>

        <div className="space-y-4">
          <Panel>
            <PanelHeader
              title="Личные данные"
              description="Имя и фамилия отображаются куратору и в комментариях"
              icon={<UserRound className="h-4 w-4" />}
            />
            <form onSubmit={saveProfile} className="space-y-3 p-5 pt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Имя"
                  htmlFor="firstName"
                  error={profileForm.formState.errors.firstName?.message}
                >
                  <Input id="firstName" autoComplete="given-name" {...profileForm.register('firstName')} />
                </Field>
                <Field
                  label="Фамилия"
                  htmlFor="lastName"
                  error={profileForm.formState.errors.lastName?.message}
                >
                  <Input id="lastName" autoComplete="family-name" {...profileForm.register('lastName')} />
                </Field>
              </div>
              <Field label="Email" htmlFor="email" hint="Email изменяется только через поддержку.">
                <Input id="email" value={profile.email} disabled readOnly />
              </Field>
              <div className="flex justify-end">
                <Button type="submit" loading={profileForm.formState.isSubmitting}>
                  Сохранить изменения
                </Button>
              </div>
            </form>
          </Panel>

          <Panel>
            <PanelHeader
              title="Безопасность"
              description="Минимум 8 символов, хотя бы одна буква и цифра"
              icon={<KeyRound className="h-4 w-4" />}
            />
            <form onSubmit={changePassword} className="space-y-3 p-5 pt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Новый пароль"
                  htmlFor="password"
                  error={passwordForm.formState.errors.password?.message}
                >
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    {...passwordForm.register('password')}
                  />
                </Field>
                <Field
                  label="Повторите пароль"
                  htmlFor="confirmPassword"
                  error={passwordForm.formState.errors.confirmPassword?.message}
                >
                  <Input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    {...passwordForm.register('confirmPassword')}
                  />
                </Field>
              </div>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  variant="secondary"
                  loading={passwordForm.formState.isSubmitting}
                >
                  Изменить пароль
                </Button>
              </div>
            </form>
          </Panel>
        </div>
      </div>
    </Page>
  )
}
