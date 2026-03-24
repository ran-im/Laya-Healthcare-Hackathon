import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { claimData } = await req.json()

    const payload = {
      claim_id:                       claimData.claim_id,
      member_id:                       claimData.member_id,
      policy_id:                       claimData.policy_id || null,
      member_status:                   'Active',
      member_residency_country:        claimData.treatment_country,
      membership_start_date:           null,
      prior_cover_credit_weeks:        0,
      prior_cover_credit_years:        0,
      weeks_since_upgrade:             0,
      previous_benefit_level:          1,
      current_benefit_level:           1,
      member_age:                      null,
      claim_type:                      claimData.claim_type,
      service_type:                    claimData.service_type,
      provider_name:                   claimData.provider_name,
      provider_registered:             true,
      hospital_is_participating:       true,
      service_date:                    claimData.service_date,
      submission_date:                 new Date().toISOString().split('T')[0],
      admission_date:                  claimData.admission_date || null,
      discharge_date:                  claimData.discharge_date || null,
      claim_days:                      0,
      amount_claimed_eur:              claimData.amount_claimed_eur,
      member_has_paid:                 claimData.member_already_paid,
      reimbursement_type:              claimData.reimbursement_type,
      documents:                       claimData.document_types,
      missing_documents_text:          '',
      declarations_confirmed:          claimData.declaration_confirmed,
      medical_data_consent:            claimData.consent_medical_data,
      privacy_terms_accepted:          claimData.terms_accepted,
      duplicate_claim:                 false,
      claim_form_complete:             true,
      days_since_follow_up:            0,
      claim_cause:                     claimData.is_accident_or_injury ? 'Accident' : 'Illness',
      is_pre_existing_condition:       claimData.is_pre_existing,
      is_experimental_treatment:       false,
      is_cosmetic_treatment:           false,
      is_disfigurement_correction:     false,
      no_underlying_condition:         false,
      treatment_country:               claimData.treatment_country,
      is_emergency:                    claimData.claim_type === 'Emergency',
      preapproved_overseas_treatment:  claimData.overseas_preapproved,
      clinical_indicators_required:    false,
      clinical_indicators_provided:    true,
      has_other_insurance_cover:       false,
      investigation_finding:           '',
      fraud_score:                     0.10,
      complexity_score:                0.30,
      anomaly_score:                   0.10,
      risk_level:                      'Low',
      member_total_op_claims_ytd:      0,
      member_annual_op_cap:            1000,
      op_excess_remaining:             25,
      member_total_inpatient_daycase_days_ytd: 0,
      psychiatric_days_this_year:      0,
      pregnancy_weeks_at_treatment:    null,
      provider_is_family_member:       false,
      vaccine_or_preventive:           false,
      is_maternity:                    false,
      is_infertility:                  false,
      is_first_steps_fertility:        false,
      low_confidence_ocr:              false,
      manual_fraud_flag:               false,
    }

    const engineUrl = process.env.DECISION_ENGINE_URL || 'http://localhost:8000'
    const response = await fetch(`${engineUrl}/api/claims/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) throw new Error(`Engine error: ${response.status}`)

    const result = await response.json()

    return NextResponse.json({
      decision:                result.decision,
      decision_reason:         result.decision_reason,
      provisional_payable_eur: result.provisional_payable_amount_eur,
      approved_amount_eur:     result.approved_amount_eur,
      estimated_payable_rate:  result.estimated_payable_rate,
      rejection_rules:         result.rejection_rule_ids,
      needs_info_rules:        result.needs_info_rule_ids,
      review_rules:            result.review_rule_ids,
      rule_trace:              result.rule_trace,
      payout_notes:            result.payout_notes,
    })

  } catch (err) {
    console.error('Decision engine error:', err)
    return NextResponse.json({
      decision:        'REVIEW',
      decision_reason: 'AI model unavailable — sent to manual review',
      provisional_payable_eur: 0,
      approved_amount_eur:     0,
      rule_trace:              [],
    })
  }
}