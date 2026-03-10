import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request: Request) {
  try {
    const { claimId } = await request.json()
    if (!claimId) return NextResponse.json({ error: 'claimId required' }, { status: 400 })

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: claim, error } = await supabaseAdmin
      .from('claims')
      .select('*, profiles(full_name, member_id, plan_name)')
      .eq('id', claimId)
      .single()

    if (error || !claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
    }

    const { data: docs } = await supabaseAdmin
      .from('claim_documents')
      .select('document_type, file_name')
      .eq('claim_id', claimId)

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const claimContext = `
CLAIM DETAILS:
- Claim ID: ${claim.claim_id}
- Claim Type: ${claim.claim_type} (${claim.service_type})
- Provider: ${claim.provider_name} (${claim.provider_type})
- Service Date: ${claim.service_date}
- Service Location: ${claim.service_location || 'Not specified'}
- Diagnosis: ${claim.diagnosis || 'Not specified'}
- Description: ${claim.description || 'Not specified'}
- Total Amount Claimed: €${claim.total_amount}
- Treatment Country: ${claim.treatment_country}
- Pre-authorized: ${claim.is_pre_authorized ? 'Yes' : 'No'}
- Admission Date: ${claim.admission_date || 'N/A'}
- Discharge Date: ${claim.discharge_date || 'N/A'}

MEMBER DETAILS:
- Name: ${(claim.profiles as any)?.full_name || 'Unknown'}
- Member ID: ${(claim.profiles as any)?.member_id || 'Unknown'}
- Plan: ${(claim.profiles as any)?.plan_name || 'Unknown'}

DOCUMENTS SUBMITTED:
${docs && docs.length > 0
  ? docs.map((d: any) => `- ${d.document_type}: ${d.file_name}`).join('\n')
  : '- No documents submitted'}
`

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: `You are an expert healthcare insurance claims assessor at Laya Healthcare, Ireland.
Analyze claims and provide concise, professional assessments.

For each claim:
1. Summarize in 2-3 sentences
2. Assess risk level (Low/Medium/High) with brief reasoning  
3. Check if amount is reasonable for this treatment in Ireland
4. Flag any missing documents or red flags
5. Give clear recommendation

Be concise — under 200 words total.
End with: "RECOMMENDATION: [APPROVE/REJECT/REQUEST INFO] - [one sentence reason]"`,
      messages: [
        { role: 'user', content: `Please assess this claim:\n${claimContext}` }
      ],
    })

    const summary = message.content[0].type === 'text' ? message.content[0].text : 'Unable to generate summary.'

    const recMatch = summary.match(/RECOMMENDATION:\s*(APPROVE|REJECT|REQUEST INFO)/i)
    const recommendation = recMatch ? recMatch[0] : null

    // Calculate scores
    let fraudScore      = 10
    let complexityScore = 20
    let anomalyScore    = 5

    if (!claim.is_pre_authorized && claim.total_amount > 2000) fraudScore += 25
    if (!docs || docs.length === 0)                            fraudScore += 30
    if (claim.treatment_country !== 'Ireland')                 fraudScore += 20
    if (claim.total_amount > 5000)                             fraudScore += 15
    if (claim.claim_type === 'Inpatient')                      complexityScore += 40
    if (claim.admission_date && claim.discharge_date)          complexityScore += 20
    if (claim.total_amount > 3000)                             complexityScore += 20
    if (claim.total_amount > 10000)                            anomalyScore += 50
    if (claim.total_amount > 5000)                             anomalyScore += 25

    fraudScore      = Math.min(fraudScore, 95)
    complexityScore = Math.min(complexityScore, 95)
    anomalyScore    = Math.min(anomalyScore, 95)

    let routing = 'assessor'
    if (fraudScore >= 60)                                      routing = 'fraud'
    else if (fraudScore < 25 && complexityScore < 30)          routing = 'auto'

    // Store as decimals (0-1) to match DB constraint
    await supabaseAdmin
      .from('claims')
      .update({
        ai_summary: summary,
        ai_recommendation: recommendation,
        fraud_score:      fraudScore / 100,
        complexity_score: complexityScore / 100,
        anomaly_score:    anomalyScore / 100,
        routing,
        status: claim.status === 'Submitted' ? 'In Review' : claim.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', claimId)

    return NextResponse.json({
      summary,
      recommendation,
      scores: { fraud: fraudScore, complexity: complexityScore, anomaly: anomalyScore },
      routing,
    })

  } catch (err) {
    console.error('AI summarize error:', err)
    return NextResponse.json({ error: 'AI service error', details: String(err) }, { status: 500 })
  }
}
