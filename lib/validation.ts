import { z } from 'zod'

const emptyToUndefined = (value: unknown) =>
  value === '' || value === null || value === undefined ? undefined : value

const optionalPositiveInt = (max: number, message: string) =>
  z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().positive(message).max(max, message).optional()
  )

const optionalTrimmedString = (max: number) =>
  z.preprocess(
    emptyToUndefined,
    z.string().trim().max(max).optional()
  )

const optionalEmail = z.preprocess(
  emptyToUndefined,
  z.string().trim().email('Invalid billing email').optional()
)

const optionalPhone = z.preprocess(
  emptyToUndefined,
  z.string().trim().regex(/^\+?[0-9\s-]{10,}$/, 'Invalid phone number').optional()
)

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export function validateLogin(data: any) {
  return loginSchema.safeParse(data)
}

export const RegistrationSchema = z.object({
  school_name: z.string().min(3, 'School name must be at least 3 characters'),
  city: z.string().min(2, 'City is required'),
  tier: z.enum(['starter', 'growth', 'enterprise']).default('starter'),
  estimated_students: optionalPositiveInt(100000, 'Estimated students must be between 1 and 100000'),
  branch_count: optionalPositiveInt(100, 'Branch count must be between 1 and 100'),
  billing_email: optionalEmail,
  contact_phone: optionalPhone,
  custom_requirements: optionalTrimmedString(2000),
  custom_monthly_amount: optionalPositiveInt(10000000, 'Custom monthly amount must be a positive number'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters')
}).superRefine((data, ctx) => {
  if (data.tier !== 'enterprise') {
    return
  }

  if (!data.estimated_students) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['estimated_students'],
      message: 'Estimated students is required for enterprise setup',
    })
  }

  if (!data.branch_count) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['branch_count'],
      message: 'Branch count is required for enterprise setup',
    })
  }

  if (!data.billing_email) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['billing_email'],
      message: 'Billing email is required for enterprise setup',
    })
  }

  if (!data.custom_monthly_amount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['custom_monthly_amount'],
      message: 'Custom monthly amount is required for enterprise payment',
    })
  }
})

export const StudentSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  roll_number: z.string().optional(),
  class_grade: z.string().min(1, 'Class grade is required'),
  section: z.string().min(1, 'Section is required'),
  guardian_name: z.string().optional(),
  guardian_phone: z.string().regex(/^\+?[0-9\s-]{10,}$/, 'Invalid phone number').optional()
});

export const FeeInvoiceSchema = z.object({
  student_id: z.string().uuid('Invalid Student ID'),
  title: z.string().min(3, 'Title must be at least 3 characters'),
  amount: z.coerce.number().positive('Amount must be positive'),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
});

export const CommunicationNoticeSchema = z.object({
  title: z.string().min(3, 'Title is required'),
  body: z.string().min(10, 'Message body is too short'),
  target: z.enum(['all-parents', 'all-students', 'all-staff']),
  channels: z.array(z.enum(['SMS', 'Email', 'App Push'])).min(1, 'Select at least one channel')
});
