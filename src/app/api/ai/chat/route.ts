import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request: Request) {
  try {
    const { claimId, message, history = [] } = await request.json()

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    let { data: claim } = await supabaseAdmin
      .from('claims')
      .select('*, profiles!claims_member_id_fkey(full_name, member_id, plan_name)')
      .eq('id', claimId)
      .single()

    if (!claim) {
      const res2 = await supabaseAdmin
        .from('claims')
        .select('*, profiles!claims_member_id_fkey(full_name, member_id, plan_name)')
        .eq('claim_id', claimId)
        .single()
      claim = res2.data
    }

    if (!claim) return NextResponse.json({ error: 'Claim not found' }, { status: 404 })

    const { data: docs } = await supabaseAdmin
      .from('claim_documents')
      .select('document_type, file_name')
      .eq('claim_id', claimId)

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const claimContext = `
Claim: ${claim.claim_id} | Type: ${claim.claim_type} | Amount: €${claim.total_amount}
Provider: ${claim.provider_name} (${claim.provider_type})
Member: ${(claim.profiles as any)?.full_name} | Plan: ${(claim.profiles as any)?.plan_name}
Date: ${claim.service_date} | Status: ${claim.status}
Diagnosis: ${claim.diagnosis || 'Not provided'}
Description: ${claim.description || 'Not provided'}
Pre-authorized: ${claim.is_pre_authorized ? 'Yes' : 'No'}
Country: ${claim.treatment_country}
Fraud Score: ${Math.round((claim.fraud_score ?? 0) * 100)}%
Complexity Score: ${Math.round((claim.complexity_score ?? 0) * 100)}%
Documents: ${docs?.map((d: any) => d.document_type).join(', ') || 'None submitted'}
`

    // Build message history for Claude (must alternate user/assistant)
    const filteredHistory = history.filter((m: any) => m.content?.trim())
    const claudeMessages: { role: 'user' | 'assistant'; content: string }[] = []
    
    for (const m of filteredHistory.slice(-6)) {
      claudeMessages.push({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      })
    }
    
    // Add current message
    claudeMessages.push({ role: 'user', content: message })

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: `You are Laya AI, an expert healthcare insurance claims assistant for Laya Healthcare Ireland.
You help claims assessors review and make decisions on healthcare insurance claims.

Current claim context:
${claimContext}

Provide helpful, concise answers focused on:
- Whether the claim appears legitimate
- If the amount is reasonable for Ireland
- Any red flags or missing information  
- Policy compliance with Irish healthcare norms
- Clear approve/reject/request info recommendations

Keep responses under 150 words. Be direct and actionable.`,
      messages: claudeMessages,
    })

    const reply = response.content[0].type === 'text'
      ? response.content[0].text
      : 'I could not process that request.'

    return NextResponse.json({ reply })

  } catch (err) {
    console.error('AI chat error:', err)
    return NextResponse.json({ error: 'AI service error', details: String(err) }, { status: 500 })
  }
}
