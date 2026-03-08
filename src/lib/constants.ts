export const CLAIM_TYPES = ['Outpatient', 'Inpatient', 'Emergency', 'Pharmacy', 'Dental', 'Optical'] as const
export const SERVICE_TYPES = ['GP', 'Specialist', 'Surgery', 'Lab', 'Imaging', 'Other'] as const
export const PROVIDER_TYPES = ['Hospital', 'Clinic', 'Doctor', 'Pharmacy', 'Other'] as const
export const CLAIM_STATUS = ['Submitted', 'In Review', 'Approved', 'Paid', 'Rejected', 'Info Required'] as const
export const USER_ROLES = ['member', 'assessor', 'admin', 'fraud'] as const
export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
export const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png']
