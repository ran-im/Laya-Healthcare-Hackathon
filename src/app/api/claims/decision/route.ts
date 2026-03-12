import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { claimId, decision, amount, reason } = await request.json()
  
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const updates: any = {
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
