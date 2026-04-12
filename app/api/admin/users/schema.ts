import { z } from 'zod'

export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(10, 'Password must be at least 10 characters')
    .regex(/[a-z]/, 'Must contain a lowercase letter')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a digit'),
  full_name: z.string().optional(),
  role: z.enum(['admin', 'manager', 'cashier']).default('cashier'),
  store_ids: z.array(z.string().uuid()).optional(),
  default_store_id: z.string().uuid().optional(),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
