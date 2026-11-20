import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/overlay'
import { Button } from '@/components/ui/button'
import { Field, Input, SimpleSelect, Textarea } from '@/components/ui/form'
import { api } from '@/services/api'
import { INVALIDATION_KEYS } from '@/lib/query-keys'
import { toISODate } from '@/lib/utils'
import type { Module } from '@/types'

export function CreateCardDialog({
  open,
  onOpenChange,
  modules,
  defaultModuleId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  modules: Module[]
  defaultModuleId?: string
}) {
  const queryClient = useQueryClient()
  const [moduleId, setModuleId] = useState(defaultModuleId ?? modules[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setModuleId(defaultModuleId ?? modules[0]?.id ?? '')
      setTitle('')
      setDescription('')
      setDeadline('')
      setError(null)
    }
  }, [open, defaultModuleId, modules])

  const create = useMutation({
    mutationFn: () =>
      api.cards.create({
        moduleId,
        title: title.trim(),
        description: description.trim(),
        deadline: deadline ? new Date(`${deadline}T23:59:00`).toISOString() : null,
      }),
    onSuccess: () => {
      INVALIDATION_KEYS.forEach((key) => {
        void queryClient.invalidateQueries({ queryKey: key })
      })
      toast.success('Задание создано в бэклоге')
      onOpenChange(false)
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : 'Не удалось создать задание')
    },
  })

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!moduleId) {
      setError('Сначала создайте хотя бы один модуль')
      return
    }
    if (title.trim().length < 3) {
      setError('Название должно содержать минимум 3 символа')
      return
    }
    setError(null)
    create.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader
          title="Новое задание"
          description="Задание появится в бэклоге. Ученик сможет взять его в работу."
        />
        <form onSubmit={submit} className="space-y-3.5">
          <Field label="Название" htmlFor="card-title">
            <Input
              id="card-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Например, Типизировать API-клиент"
              autoFocus
              maxLength={160}
            />
          </Field>

          <Field label="Модуль" htmlFor="card-module">
            <SimpleSelect
              id="card-module"
              value={moduleId}
              onValueChange={setModuleId}
              placeholder="Выберите модуль"
              options={modules.map((module) => ({ value: module.id, label: module.title }))}
              disabled={modules.length === 0}
            />
          </Field>

          <Field
            label="Описание"
            htmlFor="card-description"
            hint="Что нужно сделать и по каким критериям будет проверка."
          >
            <Textarea
              id="card-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Опишите задачу, ожидаемый результат и критерии приёмки…"
              className="min-h-[110px]"
              maxLength={4000}
            />
          </Field>

          <Field label="Дедлайн" htmlFor="card-deadline" hint="Необязательно. По дедлайну работают напоминания.">
            <Input
              id="card-deadline"
              type="date"
              value={deadline}
              min={toISODate(new Date().toISOString())}
              onChange={(event) => setDeadline(event.target.value)}
              className="[color-scheme:dark]"
            />
          </Field>

          {error ? (
            <p role="alert" className="text-[12px] font-medium text-accent-300">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" loading={create.isPending} disabled={modules.length === 0}>
              Создать задание
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
