export type UserRole = 'member' | 'assessor' | 'admin' | 'fraud'
export type ClaimStatus = 'Submitted' | 'In Review' | 'Approved' | 'Paid' | 'Rejected' | 'Info Required'
export type ClaimType = 'Outpatient' | 'Inpatient' | 'Emergency' | 'Pharmacy' | 'Dental' | 'Optical'

export interface User {
  id: string
  email: string
  full_name: string
  member_id: string
  policy_number: string
  plan_name: string
  date_of_birth: string
  phone: string
  role: UserRole
  created_at: string
}

export interface Claim {
  id: string
  claim_id: string
  member_id: string
  claim_type: ClaimType
  status: ClaimStatus
  provider_name: string
  provider_type: string
  service_date: string
  admission_date?: string
  discharge_date?: string
  total_amount: number
  currency: string
  description?: string
  fraud_score?: number
  complexity_score?: number
  anomaly_score?: number
  ai_summary?: string
  assessor_notes?: string
  created_at: string
  updated_at: string
  ai_decision?: string | null
  ai_decision_reason?: string | null
  routing?: string | null
  decision_result?: any
  missing_documents?: string[] | null
  missing_information?: string[] | null
  engine_status?: string | null
}

export interface ClaimDocument {
  id: string
  claim_id: string
  document_type: string
  file_name: string
  file_url: string
  file_size: number
  uploaded_at: string
}

export interface BenefitCheckResult {
  is_covered: boolean
  coverage_percentage: number
  estimated_payout: number
  required_documents: string[]
  notes: string
  plan_limit: number
  used_amount: number
  remaining: number
}
