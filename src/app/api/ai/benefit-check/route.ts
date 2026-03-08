import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { claim_type, provider_type, estimated_amount } = body

    const mockResult = {
      is_covered: true,
      coverage_percentage: 80,
      estimated_payout: estimated_amount * 0.8,
      required_documents: ['Invoice', 'Medical Report', 'ID Proof'],
      notes: 'Standard coverage applies for this claim type',
      plan_limit: 5000,
      used_amount: 2500,
      remaining: 2500,
    }

    return NextResponse.json(mockResult)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to check benefits' }, { status: 500 })
  }
}
