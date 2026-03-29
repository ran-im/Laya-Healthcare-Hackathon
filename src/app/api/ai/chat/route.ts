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
  try {
    const { claimId, message, history = [] } = await request.json()

    const supabaseAdmin = getAdminClient()

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

    // If no Anthropic key, return a contextual mock response
    if (!process.env.ANTHROPIC_API_KEY) {
      const c = claim as Record<string, unknown>
      const profiles = c.profiles as Record<string, unknown> | null
      const amount = c.total_amount as number
      const fraudScore = ((c.fraud_score as number) ?? 0) * 100

      let reply: string
      const lowerMsg = message.toLowerCase()

      if (lowerMsg.includes('approve') || lowerMsg.includes('should i')) {
        reply = `Based on the claim data for ${c.claim_id}: The ${c.claim_type} claim of \u20AC${amount} from ${c.provider_name} ${
          fraudScore < 25 ? 'appears low risk and could be approved.' :
          fraudScore < 50 ? 'has moderate risk indicators. I recommend reviewing the documentation before approving.' :
          'has elevated risk flags. Recommend requesting additional information before making a decision.'
        }`
      } else if (lowerMsg.includes('fraud') || lowerMsg.includes('risk') || lowerMsg.includes('flag')) {
        reply = `Fraud assessment for ${c.claim_id}: Current fraud score is ${fraudScore.toFixed(0)}%. ${
          fraudScore < 20 ? 'No significant red flags detected. The claim amount and provider are consistent with typical claims of this type.' :
          'Some indicators warrant attention: ' + (amount > 5000 ? 'High claim value. ' : '') + (!c.is_pre_authorized ? 'No pre-authorization. ' : '') + 'Recommend verifying documentation.'
        }`
      } else if (lowerMsg.includes('document') || lowerMsg.includes('missing')) {
        const docList = (docs as any[])?.map((d: any) => d.document_type).join(', ') || 'None'
        reply = `Documents on file for ${c.claim_id}: ${docList}. ${
          !(docs as any[])?.length ? 'No documents have been submitted. Request invoice and relevant medical documentation.' :
          'Documents appear to be in order. Verify they match the claim details.'
        }`
      } else {
        reply = `Regarding claim ${c.claim_id}: This is a ${c.claim_type} claim for \u20AC${amount} by ${profiles?.full_name || 'the member'} (${profiles?.plan_name || 'Unknown Plan'}). Service provided by ${c.provider_name} on ${c.service_date}. ${c.description || 'No description provided.'}`
      }

      return NextResponse.json({ reply })
    }

    // Real Anthropic path
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const claimContext = `
Claim: ${(claim as any).claim_id} | Type: ${(claim as any).claim_type} | Amount: \u20AC${(claim as any).total_amount}
Provider: ${(claim as any).provider_name} (${(claim as any).provider_type})
Member: ${((claim as any).profiles as any)?.full_name} | Plan: ${((claim as any).profiles as any)?.plan_name}
Date: ${(claim as any).service_date} | Status: ${(claim as any).status}
Diagnosis: ${(claim as any).diagnosis || 'Not provided'}
Description: ${(claim as any).description || 'Not provided'}
Pre-authorized: ${(claim as any).is_pre_authorized ? 'Yes' : 'No'}
Country: ${(claim as any).treatment_country}
Fraud Score: ${Math.round(((claim as any).fraud_score ?? 0) * 100)}%
Complexity Score: ${Math.round(((claim as any).complexity_score ?? 0) * 100)}%
Documents: ${(docs as any[])?.map((d: any) => d.document_type).join(', ') || 'None submitted'}
`

    const filteredHistory = history.filter((m: any) => m.content?.trim())
    const claudeMessages: { role: 'user' | 'assistant'; content: string }[] = []

    for (const m of filteredHistory.slice(-6)) {
      claudeMessages.push({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      })
    }

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
