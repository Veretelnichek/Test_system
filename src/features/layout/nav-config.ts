import type { Role } from '@/types'

export interface NavItem {
  to: string
  label: string
  end?: boolean
  badge?: 'reviews'
}

export function navFor(role: Role): { main: NavItem[]; account: NavItem[] } {
  if (role === 'curator') {
    return {
      main: [
        { to: '/app/overview', label: 'Обзор' },
        { to: '/app/students', label: 'Ученики' },
        { to: '/app/boards', label: 'Доски' },
        { to: '/app/reviews', label: 'Ждут проверки', badge: 'reviews' },
        { to: '/app/analytics', label: 'Аналитика' },
      ],
      account: [
        { to: '/app/notifications', label: 'Уведомления' },
        { to: '/app/profile', label: 'Профиль' },
      ],
    }
  }
  return {
    main: [
      { to: '/app/home', label: 'Главная' },
      { to: '/app/board', label: 'Моя доска' },
      { to: '/app/modules', label: 'Мои модули' },
    ],
    account: [
      { to: '/app/notifications', label: 'Уведомления' },
      { to: '/app/profile', label: 'Профиль' },
    ],
  }
}

export const ROUTE_META: Record<string, { title: string; section: string }> = {
  '/app/home': { title: 'Главная', section: 'Обучение' },
  '/app/board': { title: 'Моя доска', section: 'Обучение' },
  '/app/modules': { title: 'Мои модули', section: 'Обучение' },
  '/app/overview': { title: 'Обзор', section: 'Кураторство' },
  '/app/students': { title: 'Ученики', section: 'Кураторство' },
  '/app/boards': { title: 'Доски учеников', section: 'Кураторство' },
  '/app/reviews': { title: 'Ждут проверки', section: 'Кураторство' },
  '/app/analytics': { title: 'Аналитика', section: 'Кураторство' },
  '/app/notifications': { title: 'Уведомления', section: 'Аккаунт' },
  '/app/profile': { title: 'Профиль', section: 'Аккаунт' },
  '/app/join': { title: 'Присоединиться к куратору', section: 'Обучение' },
}
