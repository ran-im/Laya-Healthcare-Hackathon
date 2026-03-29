import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { AdditionalDocument, HybridDecisionResult, InfoRequest } from '@/types'

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { claimId, uploadedDocs } = await request.json()

    if (!claimId || !Array.isArray(uploadedDocs) || uploadedDocs.length === 0) {
      return NextResponse.json({ error: 'Missing claimId or uploadedDocs' }, { status: 400 })
    }

    const { data: claim, error: claimError } = await supabase
      .from('claims')
      .select('id, member_id, claim_id, status, ai_decision_reason, decision_result')
      .eq('id', claimId)
      .eq('member_id', user.id)
      .maybeSingle()

    if (claimError) {
      return NextResponse.json({ error: claimError.message }, { status: 500 })
    }

    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
    }

    const currentDecisionResult = (claim.decision_result ?? {}) as HybridDecisionResult
    const currentInfoRequest = currentDecisionResult.info_request as InfoRequest | undefined
    const existingAdditionalDocuments = (currentDecisionResult.additional_documents ?? []) as AdditionalDocument[]

    const updatedDecisionResult: HybridDecisionResult = {
      ...currentDecisionResult,
      claim_reference: currentDecisionResult.claim_reference ?? claim.claim_id,
      decision: currentDecisionResult.decision ?? claim.status,
      final_decision: currentDecisionResult.final_decision ?? currentDecisionResult.decision ?? claim.status,
      decision_source: currentDecisionResult.decision_source ?? 'rules',
      final_display_summary: currentDecisionResult.final_display_summary ?? claim.ai_decision_reason ?? '',
      member_decision_summary: currentDecisionResult.member_decision_summary ?? currentDecisionResult.final_display_summary ?? '',
      member_explanation_llm: currentDecisionResult.member_explanation_llm ?? '',
      llm_decision: currentDecisionResult.llm_decision ?? currentDecisionResult.final_decision ?? currentDecisionResult.decision ?? claim.status,
      llm_confidence: currentDecisionResult.llm_confidence ?? 0,
      triggered_rules_summary: currentDecisionResult.triggered_rules_summary ?? [],
      info_request: {
        ...(currentInfoRequest ?? {
          status: 'PENDING',
          requested_documents: [],
          allow_additional_upload: true,
        }),
        status: 'SUBMITTED',
      },
      additional_documents: [...existingAdditionalDocuments, ...uploadedDocs],
    }

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { error: updateError } = await supabaseAdmin
      .from('claims')
      .update({
        status: 'In Review',
        decision_result: updatedDecisionResult,
        updated_at: new Date().toISOString(),
      })
      .eq('id', claim.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      claim: {
        id: claim.id,
        status: 'In Review',
        decision_result: updatedDecisionResult,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      { status: 500 }
    )
  }
}
