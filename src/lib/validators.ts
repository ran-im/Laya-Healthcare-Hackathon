import { z } from 'zod'

export const claimSchema = z.object({
  claim_type: z.enum(['Outpatient', 'Inpatient', 'Emergency', 'Pharmacy', 'Dental', 'Optical']),
  provider_name: z.string().min(1, 'Provider name is required'),
  provider_type: z.string().min(1, 'Provider type is required'),
  service_date: z.string().min(1, 'Service date is required'),
  admission_date: z.string().optional(),
  discharge_date: z.string().optional(),
  total_amount: z.number().min(0, 'Amount must be positive'),
  description: z.string().optional(),
})

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  full_name: z.string().min(1, 'Full name is required'),
  member_id: z.string().min(1, 'Member ID is required'),
  policy_number: z.string().min(1, 'Policy number is required'),
  date_of_birth: z.string().min(1, 'Date of birth is required'),
  phone: z.string().min(1, 'Phone number is required'),
})

export const benefitCheckSchema = z.object({
  claim_type: z.enum(['Outpatient', 'Inpatient', 'Emergency', 'Pharmacy', 'Dental', 'Optical']),
  provider_type: z.string().min(1, 'Provider type is required'),
  estimated_amount: z.number().min(0, 'Amount must be positive'),
})
