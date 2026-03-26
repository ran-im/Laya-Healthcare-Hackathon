export type EngineDecision =
  | 'APPROVE'
  | 'REJECT'
  | 'NEEDS_INFO'
  | 'HUMAN_REVIEW'
  | 'FRAUD_INVESTIGATION'

export type UiClaimStatus =
  | 'Submitted'
  | 'In Review'
  | 'Approved'
  | 'Paid'
  | 'Rejected'
  | 'Info Required'

export function mapDecisionToUiStatus(decision?: string): UiClaimStatus {
  switch (decision) {
    case 'APPROVE':
      return 'Approved'
    case 'REJECT':
      return 'Rejected'
    case 'NEEDS_INFO':
      return 'Info Required'
    case 'HUMAN_REVIEW':
    case 'FRAUD_INVESTIGATION':
      return 'In Review'
    default:
      return 'Submitted'
  }
}

export function mapDecisionToRouting(decision?: string): string {
  switch (decision) {
    case 'APPROVE':
      return 'auto_approved'
    case 'REJECT':
      return 'auto_rejected'
    case 'NEEDS_INFO':
      return 'needs_info'
    case 'FRAUD_INVESTIGATION':
      return 'fraud_investigation'
    case 'HUMAN_REVIEW':
      return 'manual_review'
    default:
      return 'pending'
  }
}