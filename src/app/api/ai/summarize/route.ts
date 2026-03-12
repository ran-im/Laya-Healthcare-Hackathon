import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(request: Request) {
  try {
    const { claimId } = await request.json()

    // Fetch claim — try UUID first, then claim_id string
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

    const prompt = `You are an expert healthcare insurance claims assessor for Laya Healthcare Ireland.

Analyze this claim and provide a professional assessment:

CLAIM DATA:
- Claim ID: ${claim.claim_id}
- Member: ${claim.profiles?.full_name} (Plan: ${claim.profiles?.plan_name})
- Type: ${claim.claim_type} / ${claim.service_type}
- Provider: ${claim.provider_name}
- Amount: €${claim.total_amount}
- Service Date: ${claim.service_date}
- Pre-authorized: ${claim.is_pre_authorized ? 'Yes' : 'No'}
- Treatment Country: ${claim.treatment_country || 'Ireland'}
- Description: ${claim.description || 'None provided'}

SCORING RULES — be accurate and fair:

FRAUD SCORE (0.0–1.0):
- Start at 0.05 (base)
- +0.30 if amount > €5000 AND not pre-authorized
- +0.20 if treatment country is NOT Ireland
- +0.15 if no description provided
- +0.10 if amount > €2000
- +0.10 if emergency claim with no pre-auth
- Keep below 0.40 for routine low-value claims (< €500)
- Pharmacy/dental/optical under €200 should be 0.05–0.15

COMPLEXITY SCORE (0.0–1.0):
- Start at 0.10
- +0.30 if inpatient/surgery
- +0.20 if amount > €3000
- +0.15 if has admission + discharge dates
- +0.10 if emergency
- Outpatient GP visits: 0.10–0.25
- Pharmacy under €100: 0.05–0.15

ANOMALY SCORE (0.0–1.0):
- Start at 0.05
- +0.20 if amount seems very high for claim type
- +0.15 if provider name is vague/unusual
- +0.10 if service type doesn't match claim type
- Routine claims: keep at 0.05–0.15

RECOMMENDATION LOGIC:
- "APPROVE" if fraud < 0.25 AND complexity < 0.50 AND amount < €1000
- "APPROVE" if fraud < 0.15 AND pre-authorized
- "APPROVE" if pharmacy/dental/optical AND amount < €300 AND fraud < 0.20
- "REVIEW" if fraud 0.25–0.50 OR complexity > 0.50 OR amount €1000–€5000
- "REQUEST INFO" if missing description AND amount > €500
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

    // Clamp scores to valid range
    const fraudScore = Math.min(Math.max(parseFloat(analysis.fraud_score) || 0.05, 0), 1)
    const complexityScore = Math.min(Math.max(parseFloat(analysis.complexity_score) || 0.10, 0), 1)
    const anomalyScore = Math.min(Math.max(parseFloat(analysis.anomaly_score) || 0.05, 0), 1)

    // Routing logic
    let routing = 'assessor'
    if (fraudScore >= 0.60) routing = 'fraud'
    else if (fraudScore < 0.20 && complexityScore < 0.30) routing = 'auto'

    // Save scores to DB
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
      .eq('id', claim.id)

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
