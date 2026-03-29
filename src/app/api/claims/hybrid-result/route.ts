import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { mapDecisionToRouting, mapDecisionToUiStatus } from '@/lib/claim-status'
import type { HybridDecisionResult, TriggeredRuleSummary } from '@/types'

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { claimId, newClaimId, hybridDecision } = await request.json()

    if (!claimId || !hybridDecision) {
      return NextResponse.json({ error: 'Missing claimId or hybridDecision' }, { status: 400 })
    }

    const { data: claim, error: claimError } = await supabase
      .from('claims')
      .select('id, member_id')
      .eq('id', claimId)
      .eq('member_id', user.id)
      .maybeSingle()

    if (claimError) {
      return NextResponse.json({ error: claimError.message }, { status: 500 })
    }

    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
    }

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const typedDecision = hybridDecision as HybridDecisionResult
    const finalDecision = typedDecision.final_decision ?? typedDecision.decision
    const uiStatus = mapDecisionToUiStatus(finalDecision)
    const routing = mapDecisionToRouting(finalDecision)
    const scorecard = typedDecision.scorecard as {
      fraud_score?: number
      complexity_score?: number
      anomaly_score?: number
    } | undefined

    const coreClaimUpdate = {
      status: uiStatus,
      engine_status: finalDecision,
      ai_decision: finalDecision,
      ai_decision_reason: typedDecision.final_display_summary ?? typedDecision.member_decision_summary ?? null,
      routing,
      decision_result: typedDecision,
      missing_documents: typedDecision.missing_documents ?? [],
      missing_information: typedDecision.missing_information ?? [],
      fraud_score: typeof scorecard?.fraud_score === 'number' ? scorecard.fraud_score : null,
      complexity_score: typeof scorecard?.complexity_score === 'number' ? scorecard.complexity_score : null,
      anomaly_score: typeof scorecard?.anomaly_score === 'number' ? scorecard.anomaly_score : null,
      updated_at: new Date().toISOString(),
    }

    const extendedClaimUpdate = {
      ...coreClaimUpdate,
      claim_reference: typedDecision.claim_reference ?? newClaimId ?? null,
      decision: typedDecision.decision ?? null,
      final_decision: finalDecision,
      decision_source: typedDecision.decision_source ?? 'rules',
      final_display_summary: typedDecision.final_display_summary ?? null,
      member_decision_summary: typedDecision.member_decision_summary ?? null,
      member_explanation_llm: typedDecision.member_explanation_llm ?? null,
      llm_decision: typedDecision.llm_decision ?? null,
      llm_confidence: typedDecision.llm_confidence ?? null,
      triggered_rules_summary: typedDecision.triggered_rules_summary ?? [],
      decision_evidence: typedDecision.evidence_used ?? [],
      assessor_explanation_llm: typedDecision.assessor_explanation_llm ?? null,
    }

    const { error: updateError } = await admin
      .from('claims')
      .update(extendedClaimUpdate)
      .eq('id', claim.id)

    if (updateError) {
      const { error: fallbackUpdateError } = await admin
        .from('claims')
        .update(coreClaimUpdate)
        .eq('id', claim.id)

      if (fallbackUpdateError) {
        return NextResponse.json({ error: fallbackUpdateError.message }, { status: 500 })
      }
    }

    const ruleRows = (typedDecision.triggered_rules_summary ?? []).map((r: TriggeredRuleSummary) => ({
      claim_id: claim.id,
      rule_id: r.rule_id,
      rule_name: r.rule_name,
      source_reference: null,
      notes: r.rule_explanation,
      category: r.category,
      outcome: r.outcome,
      message: r.claim_explanation,
    }))

    await admin.from('claim_rule_results').delete().eq('claim_id', claim.id)

    if (ruleRows.length > 0) {
      const { error: ruleInsertError } = await admin.from('claim_rule_results').insert(ruleRows)
      if (ruleInsertError) {
        return NextResponse.json({ error: ruleInsertError.message }, { status: 500 })
      }
    }

    const { error: historyError } = await admin.from('claim_status_history').insert({
      claim_id: claim.id,
      status: uiStatus,
      engine_status: finalDecision,
      actor_id: user.id,
      actor_role: 'member',
      note: typedDecision.final_display_summary ?? typedDecision.member_decision_summary ?? null,
    })

    if (historyError) {
      return NextResponse.json({ error: historyError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, status: uiStatus, routing })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      { status: 500 }
    )
  }
}
