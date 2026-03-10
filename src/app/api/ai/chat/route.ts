import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function POST(request: Request) {
  try {
    const { claimId, message, history = [] } = await request.json()

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Fetch claim context
    const { data: claim } = await supabaseAdmin
      .from('claims')
      .select('*, profiles(full_name, member_id, plan_name)')
      .eq('id', claimId)
      .single()

    if (!claim) return NextResponse.json({ error: 'Claim not found' }, { status: 404 })

    const { data: docs } = await supabaseAdmin
      .from('claim_documents')
      .select('document_type, file_name')
      .eq('claim_id', claimId)

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const claimContext = `
Claim: ${claim.claim_id} | Type: ${claim.claim_type} | Amount: €${claim.total_amount}
Provider: ${claim.provider_name} (${claim.provider_type})
Member: ${(claim.profiles as any)?.full_name} | Plan: ${(claim.profiles as any)?.plan_name}
Date: ${claim.service_date} | Status: ${claim.status}
Diagnosis: ${claim.diagnosis || 'Not provided'}
Description: ${claim.description || 'Not provided'}
Pre-authorized: ${claim.is_pre_authorized ? 'Yes' : 'No'}
Country: ${claim.treatment_country}
Fraud Score: ${claim.fraud_score ?? 'Not yet calculated'}%
Complexity Score: ${claim.complexity_score ?? 'Not yet calculated'}%
Documents: ${docs?.map((d: { document_type: string }) => d.document_type).join(', ') || 'None submitted'}
`

    const messages = [
      {
        role: 'system' as const,
        content: `You are Laya AI, an expert healthcare insurance claims assistant for Laya Healthcare Ireland.
You help claims assessors review and make decisions on healthcare insurance claims.
You have access to the following claim context:

${claimContext}

Provide helpful, concise answers. Focus on:
- Whether the claim appears legitimate
- If the amount is reasonable for Ireland
- Any red flags or missing information
- Policy compliance (Irish healthcare norms)
- Clear approve/reject/request info recommendations

Keep responses under 150 words. Be direct and actionable.`,
      },
      ...history.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: message },
    ]

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 300,
      messages,
    })

    const reply = completion.choices[0].message.content || 'I could not process that request.'

    return NextResponse.json({ reply })

  } catch (err) {
    console.error('AI chat error:', err)
    return NextResponse.json({ error: 'AI service error', details: String(err) }, { status: 500 })
  }
}
