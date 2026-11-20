import type { ReactNode } from 'react'
import { Logo } from '@/components/ui/logo'
import { Avatar, Progress } from '@/components/ui/data'

function PreviewBoard() {
  const columns = [
    { title: 'В работе', dot: 'bg-brand-500', cards: ['Кастомные хуки', 'Собрать MVP'] },
    { title: 'На проверке', dot: 'bg-brand-300', cards: ['REST-клиент'] },
    { title: 'Готово', dot: 'bg-emerald-400', cards: ['strict-режим'] },
  ]
  return (
    <div className="relative mt-9 max-w-[430px] rounded-2xl border border-white/[0.08] bg-ink-900/80 p-4 shadow-raised backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] font-medium text-mist-300">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
          Frontend-разработка
        </div>
        <span className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-mist-400">
          38%
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {columns.map((column) => (
          <div key={column.title} className="rounded-xl bg-white/[0.025] p-2">
            <div className="mb-2 flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${column.dot}`} />
              <span className="truncate text-[10px] font-medium text-mist-400">{column.title}</span>
            </div>
            <div className="space-y-1.5">
              {column.cards.map((card) => (
                <div
                  key={card}
                  className="rounded-lg border border-white/[0.07] bg-ink-850 p-2 text-[10px] leading-snug text-mist-200 shadow-soft"
                >
                  {card}
                  <div className="mt-2 flex items-center justify-between">
                    <Avatar name="Илья Морозов" size="xs" />
                    <span className="h-1 w-6 rounded-full bg-brand-500/40" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
        <div className="mb-1.5 flex items-center justify-between text-[10px] text-mist-400">
          <span>Прогресс программы</span>
          <span className="font-semibold text-mist-200">38%</span>
        </div>
        <Progress value={38} size="sm" />
      </div>
    </div>
  )
}

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-ink-900">
      <div className="grid min-h-screen lg:grid-cols-[1.04fr_0.96fr]">
        <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-white/[0.06] bg-ink-950 px-10 py-9 lg:flex xl:px-14">
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-60" />
          <div className="pointer-events-none absolute -left-40 top-1/3 h-[420px] w-[420px] rounded-full bg-brand-500/[0.13] blur-[120px]" />
          <div className="pointer-events-none absolute -bottom-24 right-0 h-[320px] w-[320px] rounded-full bg-accent-500/[0.08] blur-[110px]" />

          <div className="relative">
            <Logo />
          </div>

          <div className="relative max-w-[480px]">
            <p className="eyebrow mb-3 text-brand-300/80">Обучающая платформа</p>
            <h1 className="text-balance text-[34px] font-semibold leading-[1.14] tracking-[-0.03em] text-white xl:text-[38px]">
              Учебный процесс,
              <br />
              который видно целиком.
            </h1>
            <p className="mt-4 max-w-[400px] text-[14px] leading-relaxed text-mist-400">
              Задания, проверки и прогресс — в одном спокойном рабочем пространстве для учеников
              и кураторов.
            </p>

            <ul className="mt-6 space-y-2.5">
              {[
                'Kanban с ролями, историей и комментариями',
                'Проверки с обязательной обратной связью',
                'Аналитика на реальных данных, без фиктивных цифр',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-[13px] text-mist-300">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                  {item}
                </li>
              ))}
            </ul>

            <PreviewBoard />
          </div>

          <div className="relative flex items-center justify-between text-[11.5px] text-mist-500">
            <span>© 2026 Vector Learning</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Внутренняя платформа
            </span>
          </div>
        </aside>

        <main className="relative flex min-h-screen flex-col bg-ink-900 px-5 py-6 sm:px-10">
          <div className="pointer-events-none absolute inset-0 bg-radial-brand opacity-40 lg:hidden" />
          <div className="relative flex items-center justify-between lg:justify-end">
            <div className="lg:hidden">
              <Logo />
            </div>
            <a
              href="https://docs.kodacode.ru"
              target="_blank"
              rel="noreferrer"
              className="text-[12px] text-mist-400 underline decoration-white/20 underline-offset-4 transition-colors hover:text-mist-100 hover:decoration-white/50"
            >
              Помощь
            </a>
          </div>

          <div className="relative m-auto w-full max-w-[404px] py-10">{children}</div>

          <div className="relative flex items-center justify-between text-[11px] text-mist-500">
            <span>Безопасный вход через Supabase Auth</span>
            <span className="hidden sm:inline">v1.0</span>
          </div>
        </main>
      </div>
    </div>
  )
}

export function AuthHeading({
  title,
  subtitle,
}: {
  title: string
  subtitle: ReactNode
}) {
  return (
    <div className="mb-6">
      <h1 className="text-[24px] font-semibold tracking-[-0.025em] text-white">{title}</h1>
      <p className="mt-1.5 text-[13px] leading-relaxed text-mist-400">{subtitle}</p>
    </div>
  )
}

export function AuthAlert({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="mb-4 flex items-start gap-2.5 rounded-xl border border-accent-500/25 bg-accent-500/[0.09] px-3 py-2.5 text-[12.5px] leading-relaxed text-accent-200"
    >
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-accent-400/50 text-[10px] font-bold">
        !
      </span>
      <span>{children}</span>
    </div>
  )
}
