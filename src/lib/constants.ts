import type { CardStatus, Role } from '@/types'

export const APP_NAME = 'Vector'

export const CARD_STATUSES: {
  id: CardStatus
  title: string
  short: string
  color: string
  dot: string
  description: string
}[] = [
  {
    id: 'backlog',
    title: 'Бэклог',
    short: 'Бэклог',
    color: 'text-mist-300',
    dot: 'bg-mist-400',
    description: 'Задания, которые ещё не начаты',
  },
  {
    id: 'in_progress',
    title: 'В работе',
    short: 'В работе',
    color: 'text-brand-300',
    dot: 'bg-brand-500',
    description: 'Задания в процессе выполнения',
  },
  {
    id: 'review',
    title: 'На проверке',
    short: 'На проверке',
    color: 'text-brand-200',
    dot: 'bg-brand-400',
    description: 'Ожидают решения куратора',
  },
  {
    id: 'revision',
    title: 'На доработке',
    short: 'Доработка',
    color: 'text-accent-300',
    dot: 'bg-accent-500',
    description: 'Возвращены куратором на доработку',
  },
  {
    id: 'done',
    title: 'Готово',
    short: 'Готово',
    color: 'text-emerald-300',
    dot: 'bg-emerald-400',
    description: 'Принятые куратором задания',
  },
]

export const STATUS_MAP = Object.fromEntries(
  CARD_STATUSES.map((s) => [s.id, s]),
) as Record<CardStatus, (typeof CARD_STATUSES)[number]>

export const ROLE_LABEL: Record<Role, string> = {
  student: 'Ученик',
  curator: 'Куратор',
}

export const MODULE_COLORS = [
  '#0297DE',
  '#7C6BF5',
  '#2FBF9B',
  '#FC734D',
  '#E0A63A',
  '#5AA9E6',
]

export const REVIEW_OVERDUE_HOURS = 24
export const STALLED_HOURS = 48
export const REVIEW_MIN_COMMENT = 10

export const DEMO_STUDENT_EMAIL = 'student@vector.demo'
export const DEMO_CURATOR_EMAIL = 'curator@vector.demo'
export const DEMO_PASSWORD = 'vector123'
