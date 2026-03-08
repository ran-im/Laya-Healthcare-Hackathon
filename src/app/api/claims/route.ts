import { NextRequest, NextResponse } from 'next/server'
import { generateClaimId } from '@/lib/utils'

const mockClaims = [
  {
    id: '1',
    claim_id: 'CLM-2026-00001',
    member_id: 'MBR-001',
    claim_type: 'Outpatient',
    status: 'In Review' as const,
    provider_name: 'St. James Hospital',
    provider_type: 'Hospital',
    service_date: '2026-03-01',
    total_amount: 250,
    currency: 'EUR',
    created_at: '2026-03-05T10:00:00Z',
    updated_at: '2026-03-06T14:00:00Z',
  },
  {
    id: '2',
    claim_id: 'CLM-2026-00002',
    member_id: 'MBR-001',
    claim_type: 'Pharmacy',
    status: 'Approved' as const,
    provider_name: 'HealthPlus Pharmacy',
    provider_type: 'Pharmacy',
    service_date: '2026-02-28',
    total_amount: 75,
    currency: 'EUR',
    created_at: '2026-03-02T09:00:00Z',
    updated_at: '2026-03-04T11:00:00Z',
  },
]

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const memberId = searchParams.get('member_id')

  let claims = [...mockClaims]

  if (status) {
    claims = claims.filter((c) => c.status === status)
  }

  if (memberId) {
    claims = claims.filter((c) => c.member_id === memberId)
  }

  return NextResponse.json(claims)
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  const newClaim = {
    id: Math.random().toString(36).substr(2, 9),
    claim_id: generateClaimId(),
    ...body,
    status: 'Submitted' as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  return NextResponse.json(newClaim, { status: 201 })
}
