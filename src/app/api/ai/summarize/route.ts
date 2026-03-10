import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function POST(request: Request) {
  try {
    const { claimId } = await request.json()
    if (!claimId) return NextResponse.json({ error: 'claimId required' }, { status: 400 })

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Fetch claim with profile
    const { data: claim, error } = await supabaseAdmin
      .from('claims')
      .select('*, profiles(full_name, member_id, plan_name)')
      .eq('id', claimId)
      .single()

    if (error || !claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
    }

    // Fetch documents
    const { data: docs } = await supabaseAdmin
      .from('claim_documents')
      .select('document_type, file_name')
      .eq('claim_id', claimId)

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

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
- Currency: ${claim.currency}
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
  ? docs.map((d: { document_type: string; file_name: string }) => `- ${d.document_type}: ${d.file_name}`).join('\n')
  : '- No documents submitted'}
`

    const systemPrompt = `You are an expert healthcare insurance claims assessor at Laya Healthcare, Ireland.
Your role is to analyze claims and provide concise, professional assessments.

For each claim, you must:
1. Summarize the claim in 2-3 sentences
2. Assess the risk level (Low/Medium/High) with brief reasoning
3. Check if the claimed amount seems reasonable for the treatment type in Ireland
4. Flag any missing documents or red flags
5. Give a clear recommendation: APPROVE, REJECT, or REQUEST MORE INFO

Format your response as a clear assessment that an assessor can act on immediately.
Be concise — keep your total response under 200 words.
End with: "RECOMMENDATION: [APPROVE/REJECT/REQUEST INFO] - [one sentence reason]"`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 400,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Please assess this claim:\n${claimContext}` },
      ],
    })

    const summary = completion.choices[0].message.content || 'Unable to generate summary.'

    // Extract recommendation
    const recMatch = summary.match(/RECOMMENDATION:\s*(APPROVE|REJECT|REQUEST INFO)/i)
    const recommendation = recMatch ? recMatch[0] : null

    // Calculate AI scores based on claim characteristics
    let fraudScore      = 10
    let complexityScore = 20
    let anomalyScore    = 5

    // Fraud indicators
    if (!claim.is_pre_authorized && claim.total_amount > 2000)    fraudScore += 25
    if (!docs || docs.length === 0)                               fraudScore += 30
    if (claim.treatment_country !== 'Ireland')                    fraudScore += 20
    if (claim.total_amount > 5000)                                fraudScore += 15

    // Complexity indicators
    if (claim.claim_type === 'Inpatient')                         complexityScore += 40
    if (claim.admission_date && claim.discharge_date)             complexityScore += 20
    if (claim.total_amount > 3000)                                complexityScore += 20

    // Anomaly indicators (unusual patterns)
    if (claim.total_amount > 10000)                               anomalyScore += 50
    if (!claim.provider_registration)                             anomalyScore += 20
    if (claim.claim_type === 'Emergency' && claim.total_amount > 500) anomalyScore += 15

    // Cap at 100
    fraudScore      = Math.min(fraudScore, 95)
    complexityScore = Math.min(complexityScore, 95)
    anomalyScore    = Math.min(anomalyScore, 95)

    // Determine routing
    let routing = 'manual'
    if (fraudScore >= 60)      routing = 'fraud'
    else if (fraudScore < 25 && complexityScore < 30) routing = 'auto_approve'

    // Determine priority
    let priority = 'normal'
    if (fraudScore >= 60 || claim.total_amount > 5000) priority = 'urgent'
    else if (fraudScore >= 40 || claim.total_amount > 2000) priority = 'high'

    // Update claim with AI assessment
    await supabaseAdmin
      .from('claims')
      .update({
        ai_summary: summary,
        ai_recommendation: recommendation,
        fraud_score: fraudScore,
        complexity_score: complexityScore,
        anomaly_score: anomalyScore,
        routing,
        priority,
        status: claim.status === 'Submitted' ? 'In Review' : claim.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', claimId)

    return NextResponse.json({
      summary,
      recommendation,
      scores: { fraud: fraudScore, complexity: complexityScore, anomaly: anomalyScore },
      routing,
      priority,
    })

  } catch (err) {
    console.error('AI summarize error:', err)
    return NextResponse.json({ error: 'AI service error', details: String(err) }, { status: 500 })
  }
}
