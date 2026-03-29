export type UserRole = 'member' | 'assessor' | 'admin' | 'fraud'
export type ClaimStatus = 'Submitted' | 'In Review' | 'Approved' | 'Paid' | 'Rejected' | 'Info Required'
export type ClaimType = 'Outpatient' | 'Inpatient' | 'Emergency' | 'Pharmacy' | 'Dental' | 'Optical'

export interface TriggeredRuleSummary {
  rule_id: string
  rule_name: string
  outcome: string
  category: string
  rule_explanation: string
  claim_explanation: string
}

export interface DecisionEvidenceItem {
  source?: string
  id?: string
  why_relevant?: string
}

export interface InfoRequest {
  status: 'PENDING' | 'SUBMITTED' | 'RESOLVED'
  requested_by?: string | null
  requested_at?: string | null
  message?: string | null
  requested_documents: string[]
  allow_additional_upload: boolean
}

export interface AdditionalDocument {
  name: string
  url?: string | null
  uploaded_at: string
  uploaded_by: string
  document_type?: string | null
  file_path?: string | null
}

export interface HybridSimpleResponse {
  claim_reference: string
  decision: string
  final_decision: string
  decision_source: string
  final_display_summary: string
  member_decision_summary: string
  member_explanation_llm: string
  llm_decision: string
  llm_confidence: number
  triggered_rules_summary: TriggeredRuleSummary[]
}

export interface HybridDecisionResult extends HybridSimpleResponse {
  ai_assistant_summary?: string
  submitted_claim_input?: {
    account_holder_name?: string | null
    iban?: string | null
    bic?: string | null
    bic_swift?: string | null
  }
  decision_with_rules_explanation?: string
  decision_explanation?: string
  assessor_rule_trace?: string
  evidence_used?: DecisionEvidenceItem[]
  assessor_explanation_llm?: string
  llm_missing_items?: string[]
  conflicts_with_rule_engine?: boolean
  internal_summary?: string
  estimated_payable_amount_eur?: number | null
  info_request?: InfoRequest | null
  additional_documents?: AdditionalDocument[]
  scorecard?: Record<string, unknown> | null
  payout_breakdown?: Record<string, unknown> | null
  all_rule_results?: Record<string, unknown>[]
  missing_documents?: string[]
  missing_information?: string[]
  next_action_text?: string | null
}

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
  decision_result?: HybridDecisionResult
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
