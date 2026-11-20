import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/overlay'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/form'
import { EmptyState } from '@/components/ui/data'
import { api } from '@/services/api'
import { INVALIDATION_KEYS } from '@/lib/query-keys'
import { MODULE_COLORS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { Module } from '@/types'

export function ManageModulesDialog({
  open,
  onOpenChange,
  boardId,
  modules,
  cardCounts,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  boardId: string
  modules: Module[]
  cardCounts: Record<string, number>
}) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(MODULE_COLORS[0])
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setTitle('')
      setDescription('')
      setColor(MODULE_COLORS[modules.length % MODULE_COLORS.length])
      setError(null)
      setEditingId(null)
      setConfirmId(null)
    }
  }, [open, modules.length])

  const invalidate = () => {
    INVALIDATION_KEYS.forEach((key) => {
      void queryClient.invalidateQueries({ queryKey: key })
    })
  }

  const create = useMutation({
    mutationFn: () =>
      api.modules.create(boardId, {
        title: title.trim(),
        description: description.trim(),
        color,
      }),
    onSuccess: () => {
      invalidate()
      setTitle('')
      setDescription('')
      setColor(MODULE_COLORS[(modules.length + 1) % MODULE_COLORS.length])
      toast.success('Модуль добавлен')
    },
    onError: (mutationError) =>
      setError(mutationError instanceof Error ? mutationError.message : 'Не удалось создать модуль'),
  })

  const update = useMutation({
    mutationFn: (moduleId: string) => api.modules.update(moduleId, { title: editTitle.trim() }),
    onSuccess: () => {
      invalidate()
      setEditingId(null)
      toast.success('Модуль обновлён')
    },
    onError: (mutationError) =>
      toast.error(mutationError instanceof Error ? mutationError.message : 'Не удалось обновить модуль'),
  })

  const remove = useMutation({
    mutationFn: (moduleId: string) => api.modules.remove(moduleId),
    onSuccess: () => {
      invalidate()
      setConfirmId(null)
      toast.success('Модуль удалён')
    },
    onError: (mutationError) =>
      toast.error(mutationError instanceof Error ? mutationError.message : 'Не удалось удалить модуль'),
  })

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (title.trim().length < 3) {
      setError('Название модуля должно содержать минимум 3 символа')
      return
    }
    setError(null)
    create.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader
          title="Модули доски"
          description="Модули группируют задания и формируют прогресс обучения."
        />

        <div className="max-h-[46vh] space-y-2 overflow-y-auto pr-1">
          {modules.length ? (
            modules.map((module) => {
              const count = cardCounts[module.id] ?? 0
              const editing = editingId === module.id
              return (
                <div
                  key={module.id}
                  className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: module.color }}
                    />
                    {editing ? (
                      <div className="flex min-w-0 flex-1 items-center gap-1.5">
                        <Input
                          value={editTitle}
                          onChange={(event) => setEditTitle(event.target.value)}
                          className="h-8"
                          aria-label="Новое название модуля"
                          autoFocus
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => update.mutate(module.id)}
                          loading={update.isPending}
                        >
                          Сохранить
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                        >
                          Отмена
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12.5px] font-medium text-mist-100">
                            {module.title}
                          </p>
                          <p className="truncate text-[10.5px] text-mist-500">
                            {count} заданий
                            {module.description ? ` · ${module.description}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(module.id)
                            setEditTitle(module.title)
                          }}
                          className="rounded-lg px-2 py-1 text-[11px] font-medium text-mist-400 transition-colors hover:bg-white/[0.06] hover:text-white"
                        >
                          Изменить
                        </button>
                        {confirmId === module.id ? (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="danger"
                              className="h-7 px-2 text-[11px]"
                              onClick={() => remove.mutate(module.id)}
                              loading={remove.isPending}
                            >
                              Удалить
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-1.5"
                              onClick={() => setConfirmId(null)}
                            >
                              Нет
                            </Button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmId(module.id)}
                            className="rounded-lg px-2 py-1 text-[11px] font-medium text-accent-300 transition-colors hover:bg-white/[0.06]"
                          >
                            Удалить
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  {confirmId === module.id ? (
                    <p className="mt-2 text-[10.5px] text-accent-300">
                      Вместе с модулем удалятся {count} заданий, их комментарии и история. Действие
                      необратимо.
                    </p>
                  ) : null}
                </div>
              )
            })
          ) : (
            <EmptyState
              compact
              title="Модулей пока нет"
              description="Создайте первый модуль, чтобы добавлять задания."
            />
          )}
        </div>

        <form onSubmit={submit} className="mt-4 rounded-xl border border-white/[0.08] bg-ink-950/40 p-3">
          <p className="mb-2 text-[12px] font-semibold text-white">Новый модуль</p>
          <div className="space-y-2.5">
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Название модуля"
              aria-label="Название нового модуля"
              maxLength={120}
            />
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Короткое описание (необязательно)"
              className="min-h-[60px]"
              aria-label="Описание нового модуля"
              maxLength={300}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5" role="group" aria-label="Цвет модуля">
                {MODULE_COLORS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setColor(item)}
                    className={cn(
                      'h-6 w-6 rounded-full border-2 transition-transform',
                      color === item ? 'scale-110 border-white' : 'border-transparent',
                    )}
                    style={{ backgroundColor: item }}
                    aria-label={`Цвет ${item}`}
                    aria-pressed={color === item}
                  />
                ))}
              </div>
              <Button type="submit" size="sm" loading={create.isPending}>
                Добавить модуль
              </Button>
            </div>
            {error ? <p className="text-[11.5px] text-accent-300">{error}</p> : null}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
