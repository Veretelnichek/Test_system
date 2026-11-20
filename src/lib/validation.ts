import { z } from 'zod'

export const emailSchema = z
  .string()
  .min(1, 'Укажите email')
  .email('Введите корректный email')
  .transform((value) => value.trim().toLowerCase())

export const passwordSchema = z
  .string()
  .min(8, 'Пароль должен содержать минимум 8 символов')
  .max(72, 'Пароль слишком длинный')
  .regex(/[A-Za-zА-Яа-я]/, 'Добавьте хотя бы одну букву')
  .regex(/\d/, 'Добавьте хотя бы одну цифру')

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Введите пароль'),
})

export const registerSchema = z
  .object({
    firstName: z.string().trim().min(2, 'Имя должно содержать минимум 2 символа').max(60),
    lastName: z.string().trim().min(2, 'Фамилия должна содержать минимум 2 символа').max(60),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Повторите пароль'),
    role: z.enum(['student', 'curator']),
    consent: z.boolean().refine((value) => value, 'Необходимо согласие с условиями'),
    inviteCode: z.string().trim().max(32).optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword'],
  })

export const forgotSchema = z.object({
  email: emailSchema,
})

export const resetSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Повторите пароль'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword'],
  })

export const profileSchema = z.object({
  firstName: z.string().trim().min(2, 'Минимум 2 символа').max(60),
  lastName: z.string().trim().min(2, 'Минимум 2 символа').max(60),
})

export const passwordChangeSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Повторите пароль'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword'],
  })

export type SignInValues = z.infer<typeof signInSchema>
export type RegisterValues = z.infer<typeof registerSchema>
export type ResetValues = z.infer<typeof resetSchema>
export type ProfileValues = z.infer<typeof profileSchema>
export type PasswordChangeValues = z.infer<typeof passwordChangeSchema>
