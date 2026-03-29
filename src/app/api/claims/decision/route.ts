import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createMockClient } from '@/lib/mock/client'

const isMock = !process.env.NEXT_PUBLIC_SUPABASE_URL

function getAdminClient() {
  if (isMock) return createMockClient()
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(request: Request) {
  const { claimId, decision, amount, reason } = await request.json()

  const supabaseAdmin = getAdminClient()

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

  const { error } = await supabaseAdmin
    .from('claims')
    .update(updates)
    .eq('id', claimId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
