import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { mapDecisionToRouting, mapDecisionToUiStatus } from '@/lib/claim-status'
import type { HybridDecisionResult, InfoRequest } from '@/types'

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

    const { claimId, decision, amount, reason, infoRequest } = await request.json()

    if (!claimId || !decision) {
      return NextResponse.json({ error: 'Missing claimId or decision' }, { status: 400 })
    }

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: reviewerProfile, error: reviewerError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (reviewerError) {
      return NextResponse.json({ error: reviewerError.message }, { status: 500 })
    }

    if (!reviewerProfile || reviewerProfile.role === 'member') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: existingClaim, error: fetchError } = await supabaseAdmin
      .from('claims')
      .select('id, claim_id, member_id, decision_result')
      .eq('id', claimId)
      .single()

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    const currentDecisionResult = (existingClaim?.decision_result ?? {}) as HybridDecisionResult
    const normalizedDecision =
      decision === 'approve' ? 'APPROVE' :
      decision === 'reject' ? 'REJECT' :
      'NEEDS_INFO'
    const nextStatus = mapDecisionToUiStatus(normalizedDecision)
    const nextRouting = mapDecisionToRouting(normalizedDecision)
    const warnings: string[] = []

    let nextDecisionResult: HybridDecisionResult = {
      ...currentDecisionResult,
      decision: normalizedDecision,
      final_decision: normalizedDecision,
      decision_source: 'assessor_override',
      final_display_summary:
        decision === 'approve'
          ? `Decision: APPROVE. Approved by assessor${amount ? ` for EUR ${Number(amount).toFixed(2)}` : ''}.`
          : decision === 'reject'
          ? `Decision: REJECT. ${reason || 'Rejected by assessor review.'}`
          : `Decision: NEEDS_INFO. ${infoRequest?.message || 'Additional information requested by assessor.'}`,
    }

    const updates: Record<string, unknown> = {
      status: nextStatus,
      routing: nextRouting,
      engine_status: normalizedDecision,
      ai_decision: normalizedDecision,
      decision: normalizedDecision,
      final_decision: normalizedDecision,
      decision_source: 'assessor_override',
      updated_at: new Date().toISOString(),
    }

    if (decision === 'approve') {
      if (amount) {
        updates.approved_amount = parseFloat(amount)
      }
      updates.rejection_reason = null
      nextDecisionResult = {
        ...nextDecisionResult,
        info_request: currentDecisionResult.info_request
          ? { ...currentDecisionResult.info_request, status: 'RESOLVED' }
          : currentDecisionResult.info_request,
      }
    }

    if (decision === 'reject') {
      updates.rejection_reason = reason ?? null
      nextDecisionResult = {
        ...nextDecisionResult,
        info_request: currentDecisionResult.info_request
          ? { ...currentDecisionResult.info_request, status: 'RESOLVED' }
          : currentDecisionResult.info_request,
      }
    }

    if (decision === 'info') {
      const normalizedInfoRequest: InfoRequest = {
        status: 'PENDING',
        requested_by: user.id,
        requested_at: infoRequest?.requested_at ?? new Date().toISOString(),
        message: infoRequest?.message ?? null,
        requested_documents: Array.isArray(infoRequest?.requested_documents) ? infoRequest.requested_documents : [],
        allow_additional_upload: infoRequest?.allow_additional_upload ?? true,
      }

      nextDecisionResult = {
        ...nextDecisionResult,
        info_request: normalizedInfoRequest,
      }
      updates.missing_documents = normalizedInfoRequest.requested_documents
      updates.missing_information = normalizedInfoRequest.message
        ? [normalizedInfoRequest.message]
        : currentDecisionResult.missing_information ?? []
    }

    updates.decision_result = nextDecisionResult

    const { error: updateError } = await supabaseAdmin
      .from('claims')
      .update(updates)
      .eq('id', claimId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    const note =
      decision === 'approve'
        ? (amount ? `Approved by assessor for EUR ${Number(amount).toFixed(2)}.` : 'Approved by assessor.')
        : decision === 'reject'
        ? (reason || 'Rejected by assessor.')
        : (infoRequest?.message || 'Additional information requested by assessor.')

    const { error: historyError } = await supabaseAdmin.from('claim_status_history').insert({
      claim_id: claimId,
      status: nextStatus,
      engine_status: normalizedDecision,
      actor_id: user.id,
      actor_role: reviewerProfile.role,
      note,
    })

    if (historyError) {
      console.warn('Could not append claim status history:', historyError.message)
      warnings.push(`Could not append claim status history: ${historyError.message}`)
    }

    const notificationTitle =
      decision === 'approve'
        ? 'Claim Approved'
        : decision === 'reject'
        ? 'Claim Rejected'
        : 'Additional Information Required'

    const notificationMessage =
      decision === 'approve'
        ? `Your claim ${existingClaim.claim_id} has been approved${amount ? ` for EUR ${Number(amount).toFixed(2)}` : ''}.`
        : decision === 'reject'
        ? `Your claim ${existingClaim.claim_id} has been rejected.${reason ? ` ${reason}` : ''}`
        : `Additional information is required for claim ${existingClaim.claim_id}.${infoRequest?.message ? ` ${infoRequest.message}` : ''}`

    const { error: notificationError } = await supabaseAdmin.from('notifications').insert({
      user_id: existingClaim.member_id,
      claim_id: claimId,
      type: 'status_update',
      title: notificationTitle,
      message: notificationMessage.trim(),
      action_url: `/claims/${claimId}`,
    })

    if (notificationError) {
      console.warn('Could not create notification:', notificationError.message)
      warnings.push(`Could not create notification: ${notificationError.message}`)
    }

    return NextResponse.json({
      success: true,
      status: nextStatus,
      routing: nextRouting,
      normalizedDecision,
      warnings,
    })
  } catch (error) {
    console.error('Claims decision route failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      { status: 500 }
    )
  }
}
