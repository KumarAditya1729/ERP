import { z } from 'zod';

export const studentSchema = z.object({
  first_name: z.string().min(2, "First name must be at least 2 characters").max(50),
  last_name: z.string().min(1, "Last name is required").max(50),
  class_grade: z.string().min(1, "Class is required"),
  section: z.string().min(1, "Section is required"),
  roll_number: z.string().min(1, "Roll number is required").max(10),
  guardian_name: z.string().min(2, "Guardian name is required").max(100),
  guardian_phone: z.string()
    .min(10, "Phone number must be at least 10 digits")
    .max(15, "Phone number is too long")
    .regex(/^[0-9+\s-]+$/, "Phone number contains invalid characters"),
  dob: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Invalid date format",
  }),
});

export const staffSchema = z.object({
  first_name: z.string().min(2, "First name must be at least 2 characters").max(50),
  last_name: z.string().min(1, "Last name is required").max(50),
  role: z.enum(['admin', 'teacher', 'staff', 'parent'], {
    invalid_type_error: "Invalid role selected",
  }),
  department: z.string().min(2, "Department is required"),
  salary: z.coerce.number().min(0, "Salary must be a positive number"),
  email: z.string().email("Invalid email address"),
});
