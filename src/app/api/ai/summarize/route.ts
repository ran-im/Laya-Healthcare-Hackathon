import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { claim_id, claim_type, description } = body

    const summary = `AI Summary for Claim ${claim_id}: This is a ${claim_type} claim that was submitted for processing. Based on the description provided, the claim appears to be valid and meets the basic requirements for processing. Further review may be needed to verify all documentation.`

    return NextResponse.json({ summary })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 })
  }
}
