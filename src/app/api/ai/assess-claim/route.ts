import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { claimData } = await req.json()

    // Map exactly to ClaimSubmission fields in decision_engine.py
    const payload = {
      member_id:                    claimData.member_id,
      policy_id:                    claimData.policy_id || 'UNKNOWN',
      member_name:                  claimData.member_name || null,
      contact_email:                claimData.contact_email || 'unknown@email.com',
      contact_phone:                null,

      claim_type:                   claimData.claim_type,
      service_type:                 claimData.service_type,
      treatment_country:            claimData.treatment_country || 'Ireland',
      short_description:            claimData.description || null,

      service_date:                 claimData.service_date,
      admission_date:               claimData.admission_date || null,
      discharge_date:               claimData.discharge_date || null,

      provider_name:                claimData.provider_name,
      provider_type:                claimData.provider_type,
      provider_registration_id:     claimData.provider_registration || null,

      amount_claimed_eur:           claimData.amount_claimed_eur,
      currency:                     claimData.currency || 'EUR',
      member_already_paid:          claimData.member_already_paid ?? true,
      reimbursement_type:           claimData.reimbursement_type || 'Pay member',
      account_holder_name:          claimData.account_holder_name || null,
      iban:                         claimData.iban || null,
      bic_swift:                    claimData.bic_swift || claimData.bic || null,

      document_types:               claimData.document_types || [],
      pre_authorized:               claimData.is_pre_authorized ?? false,

      declaration_confirmed:        claimData.declaration_confirmed ?? true,
      consent_medical_data:         claimData.consent_medical_data ?? true,
      terms_accepted:               claimData.terms_accepted ?? true,

      duplicate_claim:              false,
      is_accident_or_injury:        claimData.is_accident_or_injury ?? false,
      is_pre_existing:              claimData.is_pre_existing ?? false,
      is_experimental:              false,
      is_cosmetic:                  false,
      infertility_related:          false,
      first_steps_fertility_benefit: false,

      emergency_overseas:           claimData.claim_type === 'Emergency' && claimData.treatment_country === 'Abroad',
      overseas_preapproved:         claimData.treatment_country === 'Abroad' && claimData.is_pre_authorized,
      low_confidence_ocr:           false,
      manual_fraud_flag:            false,
      fraud_confirmed:              false,

      submission_date:              new Date().toISOString().split('T')[0],
    }

    const engineUrl = process.env.DECISION_ENGINE_URL || 'http://localhost:8000'

    const response = await fetch(`${engineUrl}/api/claims/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Engine error ${response.status}: ${errorText}`)
    }

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
      decision:                'REVIEW',
      decision_reason:         'AI model unavailable — sent to manual review',
      provisional_payable_eur: 0,
      approved_amount_eur:     0,
      rule_trace:              [],
    })
  }
}
