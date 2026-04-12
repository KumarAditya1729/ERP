import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export function validateLogin(data: any) {
  return loginSchema.safeParse(data)
}
