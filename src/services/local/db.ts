import type {
  AppNotification,
  Board,
  Card,
  CardEvent,
  CardStatus,
  Comment,
  CuratorStudent,
  Invitation,
  Module,
  NotificationType,
  Profile,
  ReminderEvent,
} from '@/types'

const STORAGE_KEY = 'vector.local.v1'

interface LocalUser {
  id: string
  email: string
  passwordHash: string
  salt: string
}

export interface LocalDB {
  version: number
  users: LocalUser[]
  profiles: Profile[]
  curatorStudents: CuratorStudent[]
  invitations: Invitation[]
  boards: Board[]
  modules: Module[]
  cards: Card[]
  cardEvents: CardEvent[]
  comments: Comment[]
  notifications: AppNotification[]
  reminderEvents: ReminderEvent[]
  passwordResets: { token: string; userId: string; expiresAt: string }[]
  session: { userId: string } | null
}

let cache: LocalDB | null = null
const listeners = new Set<() => void>()

export function nextId() {
  return crypto.randomUUID()
}

function hexToBytes(hex: string) {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function hashPassword(password: string, salt: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: hexToBytes(salt), iterations: 120_000, hash: 'SHA-256' },
    key,
    256,
  )
  return bytesToHex(new Uint8Array(bits))
}

export function randomSalt() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return bytesToHex(bytes)
}

export async function verifyPassword(password: string, salt: string, hash: string) {
  const candidate = await hashPassword(password, salt)
  return candidate === hash
}

export function emitChange() {
  listeners.forEach((listener) => listener())
}

export function subscribeToLocalChanges(callback: () => void) {
  listeners.add(callback)
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      cache = null
      callback()
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(callback)
    window.removeEventListener('storage', onStorage)
  }
}

export function saveDB(db: LocalDB) {
  cache = db
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  emitChange()
}

export function getDB(): LocalDB {
  if (cache) return cache
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as LocalDB
      if (parsed.version === 1) {
        cache = parsed
        return parsed
      }
    } catch {
      // повреждённое хранилище — пересоздаём
    }
  }
  throw new Error('DB_NOT_READY')
}

export async function ensureDB(): Promise<LocalDB> {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as LocalDB
      if (parsed.version === 1) {
        cache = parsed
        return parsed
      }
    } catch {
      // ignore
    }
  }
  const db = await seedDB()
  saveDB(db)
  return db
}

export function resetDB() {
  localStorage.removeItem(STORAGE_KEY)
  cache = null
  emitChange()
}

export function getSessionUserId() {
  try {
    return getDB().session?.userId ?? null
  } catch {
    return null
  }
}

export function setSessionUserId(userId: string | null) {
  const db = getDB()
  db.session = userId ? { userId } : null
  saveDB(db)
}

/* ------------------------------------------------------------------ */
/* Демо-данные                                                         */
/* ------------------------------------------------------------------ */

const HOUR = 3_600_000
const DAY = 24 * HOUR

function ago(ms: number) {
  return new Date(Date.now() - ms).toISOString()
}

function ahead(ms: number) {
  return new Date(Date.now() + ms).toISOString()
}

interface CardSpec {
  module: number
  title: string
  description: string
  status: CardStatus
  createdDaysAgo: number
  statusHoursAgo: number
  deadlineDays: number
  reviewComment?: string
  comments?: { author: 'student' | 'curator'; text: string; hoursAgo: number }[]
}

interface StudentSpec {
  firstName: string
  lastName: string
  email: string
  title: string
  curator: 'anna' | 'pavel'
  modules: { title: string; description: string; color: string }[]
  cards: CardSpec[]
}

const STUDENTS: StudentSpec[] = [
  {
    firstName: 'Илья',
    lastName: 'Морозов',
    email: 'student@vector.demo',
    title: 'Frontend-разработка',
    curator: 'anna',
    modules: [
      {
        title: 'TypeScript: типы и обобщения',
        description: 'Строгая типизация, дженерики и утилитарные типы в реальных задачах.',
        color: '#0297DE',
      },
      {
        title: 'React: компоненты и состояние',
        description: 'Декомпозиция интерфейса, хуки, контекст и производительность.',
        color: '#7C6BF5',
      },
      {
        title: 'Работа с API и данными',
        description: 'Запросы, кэширование, обработка ошибок и пагинация.',
        color: '#2FBF9B',
      },
      {
        title: 'Тестирование и качество',
        description: 'Unit- и E2E-тесты, читаемость кода и код-ревью.',
        color: '#E0A63A',
      },
      {
        title: 'Итоговый проект',
        description: 'Самостоятельный продукт от идеи до защиты.',
        color: '#FC734D',
      },
    ],
    cards: [
      {
        module: 0,
        title: 'Настроить strict-режим TypeScript',
        description:
          'Включи strict и связанные проверки в tsconfig, устрани все возникшие ошибки. Зафиксируй в README, какие правила включил и почему.',
        status: 'done',
        createdDaysAgo: 26,
        statusHoursAgo: 24 * 18,
        deadlineDays: -16,
      },
      {
        module: 0,
        title: 'Типизировать модель пользователя',
        description:
          'Опиши интерфейсы User, Role и Session. Убедись, что API-слой возвращает типизированные данные без any.',
        status: 'done',
        createdDaysAgo: 22,
        statusHoursAgo: 24 * 12,
        deadlineDays: -11,
      },
      {
        module: 0,
        title: 'Разобраться с generics',
        description:
          'Реализуй типобезопасную функцию groupBy и разберись, почему infer иногда выводит never. Приложи короткие заметки.',
        status: 'done',
        createdDaysAgo: 17,
        statusHoursAgo: 24 * 7,
        deadlineDays: -5,
        comments: [
          {
            author: 'curator',
            text: 'Хорошие заметки. Обрати внимание на ограничение extends keyof — пригодится в следующем задании.',
            hoursAgo: 24 * 7,
          },
        ],
      },
      {
        module: 0,
        title: 'Утилиты Partial, Pick, Omit',
        description:
          'Собери форму редактирования профиля так, чтобы частичное обновление было типобезопасным. Используй Pick, Omit и Partial осознанно.',
        status: 'revision',
        createdDaysAgo: 12,
        statusHoursAgo: 7,
        deadlineDays: 2,
        reviewComment:
          'Типы описаны верно, но обновление допускает пустые поля. Добавь валидацию обязательных полей и ограничь Partial только редактируемыми свойствами — присылай снова.',
        comments: [
          {
            author: 'student',
            text: 'Отправил первый вариант. Не уверен, что правильно ограничил тип обновления.',
            hoursAgo: 30,
          },
          {
            author: 'curator',
            text: 'Типы описаны верно, но обновление допускает пустые поля. Добавь валидацию обязательных полей.',
            hoursAgo: 7,
          },
        ],
      },
      {
        module: 0,
        title: 'Дженерик-функция сортировки',
        description:
          'Напиши sortBy<T, K extends keyof T>, которая сортирует массив по ключу и поддерживает направление. Покрой типами случаи с необязательными полями.',
        status: 'backlog',
        createdDaysAgo: 9,
        statusHoursAgo: 24 * 9,
        deadlineDays: 6,
      },
      {
        module: 1,
        title: 'Разбить интерфейс на компоненты',
        description:
          'Декомпозируй макет личного кабинета на переиспользуемые компоненты. Опиши, где проходит граница ответственности каждого блока.',
        status: 'done',
        createdDaysAgo: 24,
        statusHoursAgo: 24 * 16,
        deadlineDays: -14,
      },
      {
        module: 1,
        title: 'Поднять состояние вверх',
        description:
          'Убери дублирование состояния между соседними компонентами. Подними общее состояние до ближайшего общего родителя и опиши решение.',
        status: 'done',
        createdDaysAgo: 20,
        statusHoursAgo: 24 * 10,
        deadlineDays: -8,
      },
      {
        module: 1,
        title: 'Кастомные хуки',
        description:
          'Вынеси работу с localStorage и дебаунс в кастомные хуки useLocalStorage и useDebouncedValue. Добавь типизацию и примеры использования.',
        status: 'review',
        createdDaysAgo: 14,
        statusHoursAgo: 29,
        deadlineDays: 1,
        comments: [
          {
            author: 'student',
            text: 'Готово, отправил на проверку. Особенно интересно решение с синхронизацией между вкладками.',
            hoursAgo: 29,
          },
        ],
      },
      {
        module: 1,
        title: 'Контекст и провайдеры',
        description:
          'Реализуй провайдер темы и провайдер уведомлений без лишних ререндеров. Сравни подход с передачей пропсов.',
        status: 'in_progress',
        createdDaysAgo: 11,
        statusHoursAgo: 61,
        deadlineDays: -1,
        comments: [
          {
            author: 'curator',
            text: 'Если застрял на мемоизации значения контекста — напиши, разберём вместе.',
            hoursAgo: 40,
          },
        ],
      },
      {
        module: 1,
        title: 'Оптимизация ререндеров',
        description:
          'Найди лишние ререндеры в приложении через React DevTools Profiler. Примени memo, useMemo и useCallback только там, где это оправдано.',
        status: 'backlog',
        createdDaysAgo: 8,
        statusHoursAgo: 24 * 8,
        deadlineDays: 9,
      },
      {
        module: 1,
        title: 'Формы с валидацией',
        description:
          'Собери форму регистрации на react-hook-form и zod. Предусмотри понятные ошибки, состояния загрузки и блокировку повторной отправки.',
        status: 'backlog',
        createdDaysAgo: 6,
        statusHoursAgo: 24 * 6,
        deadlineDays: 12,
      },
      {
        module: 2,
        title: 'REST-клиент с fetch',
        description:
          'Напиши типизированный HTTP-клиент с базовым URL, таймаутом и разбором ошибок. Не используй сторонние библиотеки.',
        status: 'done',
        createdDaysAgo: 19,
        statusHoursAgo: 24 * 11,
        deadlineDays: -7,
      },
      {
        module: 2,
        title: 'Обработка ошибок и retry',
        description:
          'Добавь обработку сетевых ошибок, экспоненциальную задержку и отмену запросов через AbortController. Опиши, когда retry вреден.',
        status: 'review',
        createdDaysAgo: 10,
        statusHoursAgo: 6,
        deadlineDays: 2,
        comments: [
          {
            author: 'student',
            text: 'Добавил отмену при размонтировании и лимит попыток. Отправил на проверку.',
            hoursAgo: 6,
          },
        ],
      },
      {
        module: 2,
        title: 'Кэширование запросов',
        description:
          'Подключи TanStack Query к списку задач: кэш, инвалидация после мутаций, оптимистичное обновление. Сравни с ручным кэшем.',
        status: 'in_progress',
        createdDaysAgo: 7,
        statusHoursAgo: 19,
        deadlineDays: 5,
      },
      {
        module: 2,
        title: 'Пагинация и инфинити-скролл',
        description:
          'Реализуй подгрузку списка при прокрутке с сохранением позиции. Обработай конец списка и повторные запросы.',
        status: 'revision',
        createdDaysAgo: 13,
        statusHoursAgo: 26,
        deadlineDays: -2,
        reviewComment:
          'При быстрой прокрутке дублируются запросы и элементы. Добавь guard на загрузку и дедупликацию по id, затем отправь повторно.',
        comments: [
          {
            author: 'curator',
            text: 'При быстрой прокрутке дублируются запросы и элементы. Добавь guard на загрузку и дедупликацию по id.',
            hoursAgo: 26,
          },
        ],
      },
      {
        module: 3,
        title: 'Первый unit-тест',
        description:
          'Настрой Vitest и напиши тесты на функцию форматирования даты. Добейся понятных сообщений при падении тестов.',
        status: 'done',
        createdDaysAgo: 15,
        statusHoursAgo: 24 * 6,
        deadlineDays: -3,
      },
      {
        module: 3,
        title: 'Тестирование хуков',
        description:
          'Покрой useDebouncedValue тестами с fake timers. Проверь поведение при быстрых последовательных вызовах.',
        status: 'backlog',
        createdDaysAgo: 5,
        statusHoursAgo: 24 * 5,
        deadlineDays: 10,
      },
      {
        module: 3,
        title: 'E2E-сценарий оформления',
        description:
          'Опиши и автоматизируй сквозной сценарий: вход, выбор задания, отправка на проверку. Используй Playwright.',
        status: 'backlog',
        createdDaysAgo: 4,
        statusHoursAgo: 24 * 4,
        deadlineDays: 15,
      },
      {
        module: 4,
        title: 'Выбрать тему проекта',
        description:
          'Сформулируй проблему, целевую аудиторию и минимальный набор функций. Согласуй объём с куратором.',
        status: 'done',
        createdDaysAgo: 21,
        statusHoursAgo: 24 * 13,
        deadlineDays: -10,
      },
      {
        module: 4,
        title: 'Собрать MVP',
        description:
          'Реализуй основной сценарий продукта end-to-end. Промежуточная демонстрация — в конце недели.',
        status: 'in_progress',
        createdDaysAgo: 9,
        statusHoursAgo: 14,
        deadlineDays: 8,
      },
      {
        module: 4,
        title: 'Защита проекта',
        description:
          'Подготовь демонстрацию на 10 минут: проблема, решение, архитектура, результаты. Приложи ссылку на репозиторий.',
        status: 'backlog',
        createdDaysAgo: 2,
        statusHoursAgo: 24 * 2,
        deadlineDays: 24,
      },
    ],
  },
  {
    firstName: 'Мария',
    lastName: 'Ковалёва',
    email: 'maria@vector.demo',
    title: 'Аналитика данных',
    curator: 'anna',
    modules: [
      { title: 'Python: основы', description: 'Синтаксис, структуры данных и функции.', color: '#0297DE' },
      { title: 'Анализ данных', description: 'pandas, визуализация и проверка гипотез.', color: '#2FBF9B' },
      { title: 'Итоговый проект', description: 'Исследование на реальных данных.', color: '#FC734D' },
    ],
    cards: [
      {
        module: 0,
        title: 'Структуры данных в Python',
        description: 'Разбери списки, словари и множества на практических примерах.',
        status: 'done',
        createdDaysAgo: 30,
        statusHoursAgo: 24 * 22,
        deadlineDays: -20,
      },
      {
        module: 0,
        title: 'Функции и модули',
        description: 'Раздели скрипт на модули, добавь аннотации типов и docstring.',
        status: 'done',
        createdDaysAgo: 26,
        statusHoursAgo: 24 * 17,
        deadlineDays: -15,
      },
      {
        module: 0,
        title: 'Работа с файлами',
        description: 'Научись читать CSV и JSON, обрабатывать ошибки кодировок.',
        status: 'done',
        createdDaysAgo: 20,
        statusHoursAgo: 24 * 9,
        deadlineDays: -6,
      },
      {
        module: 1,
        title: 'Первичный анализ датасета',
        description: 'Посчитай базовые статистики, найди пропуски и выбросы.',
        status: 'done',
        createdDaysAgo: 16,
        statusHoursAgo: 24 * 4,
        deadlineDays: -2,
      },
      {
        module: 1,
        title: 'Визуализация распределений',
        description: 'Построй гистограммы и boxplot, опиши выводы.',
        status: 'review',
        createdDaysAgo: 12,
        statusHoursAgo: 11,
        deadlineDays: 1,
      },
      {
        module: 1,
        title: 'Проверка гипотезы',
        description: 'Сформулируй гипотезу и проверь её статистическим тестом.',
        status: 'in_progress',
        createdDaysAgo: 8,
        statusHoursAgo: 30,
        deadlineDays: 4,
      },
      {
        module: 1,
        title: 'Очистка данных',
        description: 'Обработай пропуски и приведи типы колонок.',
        status: 'revision',
        createdDaysAgo: 14,
        statusHoursAgo: 48,
        deadlineDays: -1,
        reviewComment:
          'Пропуски заполнены средним без обоснования — это искажает распределение. Опиши альтернативы и пересчитай статистики.',
      },
      {
        module: 1,
        title: 'Сводные таблицы',
        description: 'Собери отчёт через groupby и pivot_table.',
        status: 'backlog',
        createdDaysAgo: 5,
        statusHoursAgo: 24 * 5,
        deadlineDays: 8,
      },
      {
        module: 2,
        title: 'Выбор темы исследования',
        description: 'Опиши данные, вопрос и ожидаемый результат.',
        status: 'done',
        createdDaysAgo: 18,
        statusHoursAgo: 24 * 8,
        deadlineDays: -4,
      },
      {
        module: 2,
        title: 'Сбор данных',
        description: 'Подготовь датасет и опиши источник.',
        status: 'in_progress',
        createdDaysAgo: 7,
        statusHoursAgo: 20,
        deadlineDays: 10,
      },
      {
        module: 2,
        title: 'Черновик выводов',
        description: 'Сформулируй 3–5 выводов с опорой на графики.',
        status: 'backlog',
        createdDaysAgo: 3,
        statusHoursAgo: 24 * 3,
        deadlineDays: 16,
      },
      {
        module: 2,
        title: 'Презентация исследования',
        description: 'Собери 8 слайдов и отрепетируй защиту.',
        status: 'backlog',
        createdDaysAgo: 2,
        statusHoursAgo: 24 * 2,
        deadlineDays: 21,
      },
    ],
  },
  {
    firstName: 'Денис',
    lastName: 'Лебедев',
    email: 'denis@vector.demo',
    title: 'Инженерия данных',
    curator: 'anna',
    modules: [
      { title: 'SQL и базы данных', description: 'Запросы, индексы и проектирование схем.', color: '#0297DE' },
      { title: 'BI-отчётность', description: 'Метрики, дашборды и сторителлинг.', color: '#7C6BF5' },
    ],
    cards: [
      {
        module: 0,
        title: 'SELECT и фильтрация',
        description: 'Отработай выборки с WHERE, ORDER BY и LIMIT.',
        status: 'done',
        createdDaysAgo: 24,
        statusHoursAgo: 24 * 15,
        deadlineDays: -12,
      },
      {
        module: 0,
        title: 'JOIN-ы на практике',
        description: 'Собери отчёт по заказам с клиентами и товарами.',
        status: 'done',
        createdDaysAgo: 19,
        statusHoursAgo: 24 * 10,
        deadlineDays: -7,
      },
      {
        module: 0,
        title: 'Агрегации и GROUP BY',
        description: 'Посчитай метрики по месяцам и категориям.',
        status: 'done',
        createdDaysAgo: 15,
        statusHoursAgo: 24 * 6,
        deadlineDays: -3,
      },
      {
        module: 0,
        title: 'Подзапросы и CTE',
        description: 'Перепиши сложный запрос через WITH и сравни план.',
        status: 'review',
        createdDaysAgo: 11,
        statusHoursAgo: 2,
        deadlineDays: 3,
      },
      {
        module: 0,
        title: 'Индексы и производительность',
        description: 'Найди медленный запрос и предложи индекс.',
        status: 'in_progress',
        createdDaysAgo: 6,
        statusHoursAgo: 22,
        deadlineDays: 7,
      },
      {
        module: 0,
        title: 'Проектирование схемы',
        description: 'Спроектируй схему для сервиса подписок с ограничениями целостности.',
        status: 'backlog',
        createdDaysAgo: 4,
        statusHoursAgo: 24 * 4,
        deadlineDays: 11,
      },
      {
        module: 1,
        title: 'Определение метрик',
        description: 'Опиши 5 продуктовых метрик и способ их расчёта.',
        status: 'done',
        createdDaysAgo: 13,
        statusHoursAgo: 24 * 5,
        deadlineDays: -2,
      },
      {
        module: 1,
        title: 'Дашборд в Metabase',
        description: 'Собери дашборд из трёх графиков с фильтрами.',
        status: 'done',
        createdDaysAgo: 9,
        statusHoursAgo: 24 * 2,
        deadlineDays: 1,
      },
      {
        module: 1,
        title: 'Сторителлинг отчёта',
        description: 'Подготовь короткий отчёт с выводами для руководителя.',
        status: 'backlog',
        createdDaysAgo: 3,
        statusHoursAgo: 24 * 3,
        deadlineDays: 14,
      },
    ],
  },
  {
    firstName: 'Алиса',
    lastName: 'Громова',
    email: 'alisa@vector.demo',
    title: 'Продуктовый дизайн',
    curator: 'anna',
    modules: [
      { title: 'UX-исследования', description: 'Интервью, сценарии и синтез.', color: '#FC734D' },
      { title: 'Прототипирование', description: 'Wireframes и интерактивные прототипы.', color: '#7C6BF5' },
    ],
    cards: [
      {
        module: 0,
        title: 'План исследования',
        description: 'Определи вопросы, аудиторию и метод сбора данных.',
        status: 'done',
        createdDaysAgo: 20,
        statusHoursAgo: 24 * 12,
        deadlineDays: -9,
      },
      {
        module: 0,
        title: 'Гайд интервью',
        description: 'Составь 8 открытых вопросов без подсказок.',
        status: 'done',
        createdDaysAgo: 16,
        statusHoursAgo: 24 * 7,
        deadlineDays: -4,
      },
      {
        module: 0,
        title: 'Сценарии интервью',
        description: 'Проведи 3 интервью и зафиксируй ключевые цитаты.',
        status: 'review',
        createdDaysAgo: 12,
        statusHoursAgo: 41,
        deadlineDays: -1,
      },
      {
        module: 0,
        title: 'Синтез результатов',
        description: 'Собери affinity map и сформулируй инсайты.',
        status: 'backlog',
        createdDaysAgo: 5,
        statusHoursAgo: 24 * 5,
        deadlineDays: 6,
      },
      {
        module: 1,
        title: 'Wireframes ключевого экрана',
        description: 'Нарисуй 3 варианта экрана и обоснуй выбор.',
        status: 'in_progress',
        createdDaysAgo: 8,
        statusHoursAgo: 52,
        deadlineDays: 3,
      },
      {
        module: 1,
        title: 'Кликабельный прототип',
        description: 'Собери прототип основного сценария в Figma.',
        status: 'backlog',
        createdDaysAgo: 4,
        statusHoursAgo: 24 * 4,
        deadlineDays: 12,
      },
      {
        module: 1,
        title: 'Тестирование прототипа',
        description: 'Проведи 3 юзабилити-теста и зафиксируй проблемы.',
        status: 'backlog',
        createdDaysAgo: 2,
        statusHoursAgo: 24 * 2,
        deadlineDays: 18,
      },
    ],
  },
  {
    firstName: 'Тимур',
    lastName: 'Сафин',
    email: 'timur@vector.demo',
    title: 'Backend-разработка',
    curator: 'pavel',
    modules: [
      { title: 'Node.js и API', description: 'HTTP, маршруты и валидация.', color: '#0297DE' },
    ],
    cards: [
      {
        module: 0,
        title: 'HTTP-сервер на Node',
        description: 'Подними сервер и реализуй health-check.',
        status: 'done',
        createdDaysAgo: 18,
        statusHoursAgo: 24 * 10,
        deadlineDays: -6,
      },
      {
        module: 0,
        title: 'Валидация входных данных',
        description: 'Подключи zod и обработай ошибки.',
        status: 'review',
        createdDaysAgo: 9,
        statusHoursAgo: 14,
        deadlineDays: 2,
      },
      {
        module: 0,
        title: 'Работа с PostgreSQL',
        description: 'Подключи базу и реализуй CRUD.',
        status: 'in_progress',
        createdDaysAgo: 6,
        statusHoursAgo: 18,
        deadlineDays: 5,
      },
      {
        module: 0,
        title: 'Аутентификация',
        description: 'JWT и защита приватных маршрутов.',
        status: 'backlog',
        createdDaysAgo: 3,
        statusHoursAgo: 24 * 3,
        deadlineDays: 10,
      },
      {
        module: 0,
        title: 'Итоговое API',
        description: 'Собери документацию и покрой тестами.',
        status: 'backlog',
        createdDaysAgo: 1,
        statusHoursAgo: 24,
        deadlineDays: 20,
      },
    ],
  },
]

function buildSeedCards(
  db: LocalDB,
  student: Profile,
  board: Board,
  spec: StudentSpec,
  curator: Profile,
) {
  const modules: Module[] = spec.modules.map((m, index) => ({
    id: nextId(),
    boardId: board.id,
    title: m.title,
    description: m.description,
    color: m.color,
    position: index,
    createdAt: ago((spec.cards.length + 20) * DAY),
  }))
  db.modules.push(...modules)

  spec.cards.forEach((cardSpec, index) => {
    const module = modules[cardSpec.module]
    const createdAt = ago(cardSpec.createdDaysAgo * DAY)
    const statusSince = ago(cardSpec.statusHoursAgo * HOUR)
    const card: Card = {
      id: nextId(),
      moduleId: module.id,
      title: cardSpec.title,
      description: cardSpec.description,
      status: cardSpec.status,
      assigneeId: student.id,
      deadline: ahead(cardSpec.deadlineDays * DAY),
      position: index,
      createdAt,
      updatedAt: statusSince,
    }
    db.cards.push(card)

    const pushEvent = (
      toStatus: CardStatus,
      at: string,
      actorId: string,
      comment?: string,
      fromStatus: CardStatus | null = null,
    ) => {
      db.cardEvents.push({
        id: nextId(),
        cardId: card.id,
        actorId,
        fromStatus,
        toStatus,
        comment: comment ?? null,
        createdAt: at,
      })
    }

    pushEvent('backlog', createdAt, curator.id)

    if (cardSpec.status !== 'backlog') {
      const startedAt =
        cardSpec.status === 'in_progress'
          ? statusSince
          : new Date(new Date(statusSince).getTime() - 34 * HOUR).toISOString()
      pushEvent('in_progress', startedAt, student.id, undefined, 'backlog')

      if (cardSpec.status === 'review') {
        pushEvent('review', statusSince, student.id, undefined, 'in_progress')
      }

      if (cardSpec.status === 'revision') {
        const reviewAt = new Date(new Date(statusSince).getTime() - 3 * HOUR).toISOString()
        pushEvent('review', reviewAt, student.id, undefined, 'in_progress')
        pushEvent('revision', statusSince, curator.id, cardSpec.reviewComment, 'review')
      }

      if (cardSpec.status === 'done') {
        const reviewAt = new Date(new Date(statusSince).getTime() - 6 * HOUR).toISOString()
        pushEvent('review', reviewAt, student.id, undefined, 'in_progress')
        pushEvent('done', statusSince, curator.id, 'Принято, замечаний нет.', 'review')
      }
    }

    cardSpec.comments?.forEach((comment) => {
      db.comments.push({
        id: nextId(),
        cardId: card.id,
        authorId: comment.author === 'student' ? student.id : curator.id,
        text: comment.text,
        createdAt: ago(comment.hoursAgo * HOUR),
        updatedAt: ago(comment.hoursAgo * HOUR),
      })
    })
  })
}

function notify(
  db: LocalDB,
  userId: string,
  type: NotificationType,
  payload: Record<string, unknown>,
  hoursAgo: number,
  read = false,
) {
  db.notifications.push({
    id: nextId(),
    userId,
    type,
    payload,
    readAt: read ? ago(hoursAgo * HOUR - 60_000) : null,
    createdAt: ago(hoursAgo * HOUR),
  })
}

async function seedDB(): Promise<LocalDB> {
  const db: LocalDB = {
    version: 1,
    users: [],
    profiles: [],
    curatorStudents: [],
    invitations: [],
    boards: [],
    modules: [],
    cards: [],
    cardEvents: [],
    comments: [],
    notifications: [],
    reminderEvents: [],
    passwordResets: [],
    session: null,
  }

  const passwordHash = await hashPassword('vector123', 'demo-vector-salt')
  const makeProfile = (firstName: string, lastName: string, email: string, role: Profile['role']) => {
    const profile: Profile = {
      id: nextId(),
      firstName,
      lastName,
      email,
      role,
      avatarUrl: null,
      approved: true,
      createdAt: ago(60 * DAY),
      updatedAt: ago(60 * DAY),
    }
    db.profiles.push(profile)
    db.users.push({ id: profile.id, email, passwordHash, salt: 'demo-vector-salt' })
    return profile
  }

  const anna = makeProfile('Анна', 'Соколова', 'curator@vector.demo', 'curator')
  const pavel = makeProfile('Павел', 'Ершов', 'pavel@vector.demo', 'curator')

  const studentProfiles: { spec: StudentSpec; profile: Profile; board: Board; curator: Profile }[] = []

  STUDENTS.forEach((spec) => {
    const curator = spec.curator === 'anna' ? anna : pavel
    const profile = makeProfile(spec.firstName, spec.lastName, spec.email, 'student')
    const board: Board = {
      id: nextId(),
      studentId: profile.id,
      title: `${spec.firstName} ${spec.lastName} — ${spec.title}`,
      createdAt: ago(60 * DAY),
    }
    db.boards.push(board)
    db.curatorStudents.push({
      id: nextId(),
      curatorId: curator.id,
      studentId: profile.id,
      createdAt: ago(55 * DAY),
    })
    buildSeedCards(db, profile, board, spec, curator)
    studentProfiles.push({ spec, profile, board, curator })
  })

  const ilya = studentProfiles[0]
  const maria = studentProfiles[1]
  const denis = studentProfiles[2]
  const alisa = studentProfiles[3]

  db.invitations.push(
    {
      id: nextId(),
      curatorId: anna.id,
      email: null,
      token: 'VECTOR24',
      status: 'pending',
      expiresAt: ahead(14 * DAY),
      createdAt: ago(2 * DAY),
    },
    {
      id: nextId(),
      curatorId: pavel.id,
      email: null,
      token: 'STUDY365',
      status: 'pending',
      expiresAt: ahead(5 * DAY),
      createdAt: ago(3 * DAY),
    },
  )

  const cardByTitle = (title: string) => db.cards.find((c) => c.title === title)!

  const hooks = cardByTitle('Кастомные хуки')
  const context = cardByTitle('Контекст и провайдеры')
  const unitTest = cardByTitle('Первый unit-тест')
  const utilities = cardByTitle('Утилиты Partial, Pick, Omit')
  const interview = cardByTitle('Сценарии интервью')
  const dedup = cardByTitle('Подзапросы и CTE')

  notify(
    db,
    ilya.profile.id,
    'task_returned',
    {
      cardId: utilities.id,
      cardTitle: utilities.title,
      comment: utilities.description,
      actorName: 'Анна Соколова',
    },
    7,
  )
  notify(
    db,
    ilya.profile.id,
    'new_comment',
    { cardId: hooks.id, cardTitle: hooks.title, actorName: 'Анна Соколова', text: 'Посмотрела черновик — добавь тесты на SSR.' },
    9,
  )
  notify(
    db,
    ilya.profile.id,
    'task_stalled',
    { cardId: context.id, cardTitle: context.title },
    1,
  )
  notify(
    db,
    ilya.profile.id,
    'task_approved',
    { cardId: unitTest.id, cardTitle: unitTest.title, actorName: 'Анна Соколова' },
    24 * 6,
    true,
  )
  notify(
    db,
    ilya.profile.id,
    'deadline_soon',
    { cardId: hooks.id, cardTitle: hooks.title, deadline: hooks.deadline },
    24 * 2,
    true,
  )

  notify(
    db,
    anna.id,
    'task_submitted',
    {
      cardId: hooks.id,
      cardTitle: hooks.title,
      studentId: ilya.profile.id,
      studentName: 'Илья Морозов',
    },
    29,
  )
  notify(
    db,
    anna.id,
    'review_overdue',
    {
      cardId: hooks.id,
      cardTitle: hooks.title,
      studentId: ilya.profile.id,
      studentName: 'Илья Морозов',
      waitingHours: 29,
    },
    4,
  )
  notify(
    db,
    anna.id,
    'task_submitted',
    {
      cardId: interview.id,
      cardTitle: interview.title,
      studentId: alisa.profile.id,
      studentName: 'Алиса Громова',
    },
    41,
  )
  notify(
    db,
    anna.id,
    'task_submitted',
    {
      cardId: dedup.id,
      cardTitle: dedup.title,
      studentId: denis.profile.id,
      studentName: 'Денис Лебедев',
    },
    2,
  )
  notify(
    db,
    anna.id,
    'new_comment',
    {
      cardId: cardByTitle('Очистка данных').id,
      cardTitle: 'Очистка данных',
      actorName: 'Мария Ковалёва',
      text: 'Обновила пропуски, посмотрите, пожалуйста.',
      studentId: maria.profile.id,
      studentName: 'Мария Ковалёва',
    },
    24 * 2,
    true,
  )

  db.reminderEvents.push({
    id: nextId(),
    cardId: context.id,
    userId: ilya.profile.id,
    type: 'stalled_48h',
    cycleKey: new Date(context.updatedAt).toISOString(),
    createdAt: ago(1 * HOUR),
  })

  return db
}
