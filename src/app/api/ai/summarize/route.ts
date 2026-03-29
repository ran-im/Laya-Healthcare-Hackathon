import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
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

function generateMockScores(claim: Record<string, unknown>) {
  const amount = (claim.total_amount as number) || 0
  const isPreAuth = claim.is_pre_authorized as boolean
  const country = (claim.treatment_country as string) || 'Ireland'
  const description = claim.description as string
  const claimType = claim.claim_type as string

  // Fraud score
  let fraud = 0.05
  if (amount > 5000 && !isPreAuth) fraud += 0.30
  if (country !== 'Ireland') fraud += 0.20
  if (!description) fraud += 0.15
  if (amount > 2000) fraud += 0.10
  if (amount < 500) fraud = Math.min(fraud, 0.15)
  if (['Pharmacy', 'Dental', 'Optical'].includes(claimType) && amount < 200) fraud = Math.min(fraud, 0.10)
  fraud = Math.min(fraud, 0.95)

  // Complexity score
  let complexity = 0.10
  if (claimType === 'Inpatient') complexity += 0.30
  if (amount > 3000) complexity += 0.20
  if (claim.admission_date && claim.discharge_date) complexity += 0.15
  if (claimType === 'Emergency') complexity += 0.10
  complexity = Math.min(complexity, 0.95)

  // Anomaly score
  let anomaly = 0.05
  if (claimType === 'Outpatient' && amount > 2000) anomaly += 0.20
  if (claimType === 'Pharmacy' && amount > 500) anomaly += 0.20
  anomaly = Math.min(anomaly, 0.95)

  // Recommendation
  let recommendation = 'REVIEW'
  if (fraud < 0.15 && isPreAuth) recommendation = 'APPROVE'
  else if (fraud < 0.25 && complexity < 0.50 && amount < 1000) recommendation = 'APPROVE'
  else if (['Pharmacy', 'Dental', 'Optical'].includes(claimType) && amount < 300 && fraud < 0.20) recommendation = 'APPROVE'
  else if (!description && amount > 500) recommendation = 'REQUEST INFO'
  else if (fraud > 0.60 || (fraud > 0.40 && anomaly > 0.40)) recommendation = 'REJECT'

  // Routing
  let routing = 'assessor'
  if (fraud >= 0.60) routing = 'fraud'
  else if (fraud < 0.20 && complexity < 0.30) routing = 'auto'

  const riskLevel = fraud > 0.40 ? 'High' : fraud > 0.20 ? 'Medium' : 'Low'

  const summary = `This ${claimType?.toLowerCase()} claim for \u20AC${amount.toFixed(2)} from ${claim.provider_name || 'the provider'} has been assessed. ${
    riskLevel === 'Low' ? 'The claim appears routine with no red flags.' :
    riskLevel === 'Medium' ? 'Some aspects of this claim warrant closer review.' :
    'This claim has elevated risk indicators and requires detailed assessment.'
  } ${recommendation === 'APPROVE' ? 'Recommended for approval.' : recommendation === 'REJECT' ? 'Recommended for rejection.' : 'Additional review or information recommended.'}`

  return {
    summary,
    risk_level: riskLevel,
    amount_reasonable: amount < 10000,
    red_flags: fraud > 0.30 ? ['Elevated fraud indicators', 'Manual review required'] : [],
    recommendation,
    recommendation_reason: `Based on fraud score of ${(fraud * 100).toFixed(0)}% and complexity of ${(complexity * 100).toFixed(0)}%.`,
    fraud_score: parseFloat(fraud.toFixed(2)),
    complexity_score: parseFloat(complexity.toFixed(2)),
    anomaly_score: parseFloat(anomaly.toFixed(2)),
    routing,
  }
}

export async function POST(request: Request) {
  try {
    const { claimId } = await request.json()
    const supabaseAdmin = getAdminClient()

    // Fetch claim - try UUID first, then claim_id string
    let { data: claim } = await supabaseAdmin
      .from('claims')
      .select('*, profiles!claims_member_id_fkey(full_name, member_id, plan_name)')
      .eq('id', claimId)
      .maybeSingle()

    if (!claim) {
      const r2 = await supabaseAdmin
        .from('claims')
        .select('*, profiles!claims_member_id_fkey(full_name, member_id, plan_name)')
        .eq('claim_id', claimId)
        .maybeSingle()
      claim = r2.data
    }

    if (!claim) return NextResponse.json({ error: 'Claim not found' }, { status: 404 })

    // If no Anthropic key, use deterministic mock scores
    if (!process.env.ANTHROPIC_API_KEY) {
      const result = generateMockScores(claim as Record<string, unknown>)

      // Save scores to DB
      await supabaseAdmin
        .from('claims')
        .update({
          fraud_score: result.fraud_score,
          complexity_score: result.complexity_score,
          anomaly_score: result.anomaly_score,
          ai_summary: result.summary,
          routing: result.routing,
          updated_at: new Date().toISOString(),
        })
        .eq('id', (claim as Record<string, unknown>).id)

      return NextResponse.json(result)
    }

    // Real Anthropic path
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    const prompt = `You are an expert healthcare insurance claims assessor for Laya Healthcare Ireland.

Analyze this claim and provide a professional assessment:

CLAIM DATA:
- Claim ID: ${(claim as any).claim_id}
- Member: ${(claim as any).profiles?.full_name} (Plan: ${(claim as any).profiles?.plan_name})
- Type: ${(claim as any).claim_type} / ${(claim as any).service_type}
- Provider: ${(claim as any).provider_name}
- Amount: \u20AC${(claim as any).total_amount}
- Service Date: ${(claim as any).service_date}
- Pre-authorized: ${(claim as any).is_pre_authorized ? 'Yes' : 'No'}
- Treatment Country: ${(claim as any).treatment_country || 'Ireland'}
- Description: ${(claim as any).description || 'None provided'}

SCORING RULES \u2014 be accurate and fair:

FRAUD SCORE (0.0\u20131.0):
- Start at 0.05 (base)
- +0.30 if amount > \u20AC5000 AND not pre-authorized
- +0.20 if treatment country is NOT Ireland
- +0.15 if no description provided
- +0.10 if amount > \u20AC2000
- +0.10 if emergency claim with no pre-auth
- Keep below 0.40 for routine low-value claims (< \u20AC500)
- Pharmacy/dental/optical under \u20AC200 should be 0.05\u20130.15

COMPLEXITY SCORE (0.0\u20131.0):
- Start at 0.10
- +0.30 if inpatient/surgery
- +0.20 if amount > \u20AC3000
- +0.15 if has admission + discharge dates
- +0.10 if emergency
- Outpatient GP visits: 0.10\u20130.25
- Pharmacy under \u20AC100: 0.05\u20130.15

ANOMALY SCORE (0.0\u20131.0):
- Start at 0.05
- +0.20 if amount seems very high for claim type
- +0.15 if provider name is vague/unusual
- +0.10 if service type doesn\u2019t match claim type
- Routine claims: keep at 0.05\u20130.15

RECOMMENDATION LOGIC:
- "APPROVE" if fraud < 0.25 AND complexity < 0.50 AND amount < \u20AC1000
- "APPROVE" if fraud < 0.15 AND pre-authorized
- "APPROVE" if pharmacy/dental/optical AND amount < \u20AC300 AND fraud < 0.20
- "REVIEW" if fraud 0.25\u20130.50 OR complexity > 0.50 OR amount \u20AC1000\u2013\u20AC5000
- "REQUEST INFO" if missing description AND amount > \u20AC500
- "REJECT" ONLY if fraud > 0.60 OR (fraud > 0.40 AND anomaly > 0.40)
- Never recommend REJECT for low-value routine claims

Respond ONLY with this exact JSON format, no other text:
{
  "summary": "2-3 sentence professional assessment of this claim",
  "risk_level": "Low|Medium|High",
  "amount_reasonable": true or false,
  "red_flags": ["flag1", "flag2"] or [],
  "recommendation": "APPROVE|REVIEW|REQUEST INFO|REJECT",
  "recommendation_reason": "One sentence explaining the recommendation",
  "fraud_score": 0.00,
  "complexity_score": 0.00,
  "anomaly_score": 0.00
}`

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    })

    const responseText = (message.content[0] as any).text
    const clean = responseText.replace(/```json|```/g, '').trim()
    const analysis = JSON.parse(clean)

    const fraudScore = Math.min(Math.max(parseFloat(analysis.fraud_score) || 0.05, 0), 1)
    const complexityScore = Math.min(Math.max(parseFloat(analysis.complexity_score) || 0.10, 0), 1)
    const anomalyScore = Math.min(Math.max(parseFloat(analysis.anomaly_score) || 0.05, 0), 1)

    let routing = 'assessor'
    if (fraudScore >= 0.60) routing = 'fraud'
    else if (fraudScore < 0.20 && complexityScore < 0.30) routing = 'auto'

    await supabaseAdmin
      .from('claims')
      .update({
        fraud_score: fraudScore,
        complexity_score: complexityScore,
        anomaly_score: anomalyScore,
        ai_summary: analysis.summary,
        routing: routing,
        updated_at: new Date().toISOString()
      })
      .eq('id', (claim as any).id)

    return NextResponse.json({
      summary: analysis.summary,
      risk_level: analysis.risk_level,
      amount_reasonable: analysis.amount_reasonable,
      red_flags: analysis.red_flags || [],
      recommendation: analysis.recommendation,
      recommendation_reason: analysis.recommendation_reason,
      fraud_score: fraudScore,
      complexity_score: complexityScore,
      anomaly_score: anomalyScore,
      routing
    })

  } catch (error: any) {
    console.error('AI summarize error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
