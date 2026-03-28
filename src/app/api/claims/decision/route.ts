import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { HybridDecisionResult, InfoRequest } from '@/types'

export async function POST(request: Request) {
  const { claimId, decision, amount, reason, infoRequest } = await request.json()
  
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: existingClaim, error: fetchError } = await supabaseAdmin
    .from('claims')
    .select('decision_result')
    .eq('id', claimId)
    .single()

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })

  const currentDecisionResult = (existingClaim?.decision_result ?? {}) as HybridDecisionResult
  const updates: Record<string, unknown> = {
    status: decision === 'approve' ? 'Approved' 
          : decision === 'reject' ? 'Rejected' 
          : 'Info Required',
    updated_at: new Date().toISOString(),
  }
  
  if (decision === 'approve' && amount) {
    updates.approved_amount = parseFloat(amount)
  }
  if (decision === 'reject' && reason) {
    updates.rejection_reason = reason
  }
  if (decision === 'info') {
    const normalizedInfoRequest: InfoRequest = {
      status: 'PENDING',
      requested_by: infoRequest?.requested_by ?? null,
      requested_at: infoRequest?.requested_at ?? new Date().toISOString(),
      message: infoRequest?.message ?? null,
      requested_documents: Array.isArray(infoRequest?.requested_documents) ? infoRequest.requested_documents : [],
      allow_additional_upload: infoRequest?.allow_additional_upload ?? true,
    }

    updates.decision_result = {
      ...currentDecisionResult,
      info_request: normalizedInfoRequest,
    }
    updates.missing_documents = normalizedInfoRequest.requested_documents
    updates.missing_information = normalizedInfoRequest.message ? [normalizedInfoRequest.message] : currentDecisionResult.missing_information ?? []
  }

  const { error } = await supabaseAdmin
    .from('claims')
    .update(updates)
    .eq('id', claimId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
