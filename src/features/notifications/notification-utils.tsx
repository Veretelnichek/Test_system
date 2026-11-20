import type { AppNotification, Role } from '@/types'

export type NotificationTone = 'brand' | 'accent' | 'success' | 'muted'

export interface NotificationView {
  title: string
  description?: string
  tone: NotificationTone
  kind: string
  href: string
}

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function cardHref(payload: Record<string, unknown>, role: Role) {
  const cardId = text(payload.cardId)
  if (!cardId) return '/app/notifications'
  if (role === 'curator') {
    const studentId = text(payload.studentId)
    return studentId ? `/app/boards/${studentId}?card=${cardId}` : `/app/reviews?card=${cardId}`
  }
  return `/app/board?card=${cardId}`
}

export function describeNotification(
  notification: AppNotification,
  role: Role,
): NotificationView {
  const p = notification.payload
  const cardTitle = text(p.cardTitle, 'задание')
  const studentName = text(p.studentName, 'Ученик')
  const actorName = text(p.actorName, role === 'student' ? 'Куратор' : 'Ученик')

  switch (notification.type) {
    case 'task_submitted':
      return {
        title: p.resubmitted
          ? `${studentName} пересдал(а) задание`
          : `${studentName} отправил(а) задание на проверку`,
        description: `«${cardTitle}»`,
        tone: 'brand',
        kind: 'Проверка',
        href: cardHref(p, role),
      }
    case 'task_approved':
      return {
        title: 'Задание принято',
        description: `«${cardTitle}» — можно двигаться дальше`,
        tone: 'success',
        kind: 'Принято',
        href: cardHref(p, role),
      }
    case 'task_returned':
      return {
        title: 'Задание возвращено на доработку',
        description: text(p.comment) ? `«${cardTitle}»: ${text(p.comment)}` : `«${cardTitle}»`,
        tone: 'accent',
        kind: 'Доработка',
        href: cardHref(p, role),
      }
    case 'new_comment':
      return {
        title: `${actorName} оставил(а) комментарий`,
        description: text(p.text) ? `«${cardTitle}»: ${text(p.text)}` : `«${cardTitle}»`,
        tone: 'brand',
        kind: 'Комментарий',
        href: cardHref(p, role),
      }
    case 'deadline_soon':
      return {
        title: 'Приближается дедлайн',
        description: `«${cardTitle}» — осталось меньше 48 часов`,
        tone: 'accent',
        kind: 'Дедлайн',
        href: cardHref(p, role),
      }
    case 'task_stalled':
      return {
        title: 'Задание стоит на месте. Продолжить?',
        description: `«${cardTitle}» не менялось больше 48 часов`,
        tone: 'muted',
        kind: 'Пауза',
        href: cardHref(p, role),
      }
    case 'review_overdue':
      return {
        title: 'Проверка ожидает более 24 часов',
        description: `«${cardTitle}» · ${studentName}`,
        tone: 'accent',
        kind: 'Просрочка',
        href: cardHref(p, role),
      }
    case 'invitation_accepted':
      return {
        title: 'Новый ученик присоединился',
        description: `${studentName}${text(p.studentEmail) ? ` · ${text(p.studentEmail)}` : ''}`,
        tone: 'success',
        kind: 'Ученик',
        href: '/app/students',
      }
    case 'curator_assigned':
      return {
        title: 'Новое задание от куратора',
        description: `«${cardTitle}»`,
        tone: 'brand',
        kind: 'Задание',
        href: cardHref(p, role),
      }
    default:
      return {
        title: 'Уведомление',
        description: cardTitle,
        tone: 'muted',
        kind: 'Событие',
        href: '/app/notifications',
      }
  }
}

export const toneStyles: Record<NotificationTone, string> = {
  brand: 'border-brand-500/25 bg-brand-500/[0.1] text-brand-300',
  accent: 'border-accent-500/25 bg-accent-500/[0.1] text-accent-300',
  success: 'border-emerald-500/25 bg-emerald-500/[0.1] text-emerald-300',
  muted: 'border-white/10 bg-white/[0.04] text-mist-300',
}
