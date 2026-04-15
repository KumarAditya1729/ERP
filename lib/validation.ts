import { z } from 'zod'

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
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters')
});

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
