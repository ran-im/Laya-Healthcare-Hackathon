'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Search, Filter } from 'lucide-react'
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils'

const mockClaims = [
  {
    id: '1',
    claim_id: 'CLM-2026-00001',
    claim_type: 'Outpatient',
    status: 'In Review' as const,
    provider_name: 'St. James Hospital',
    service_date: '2026-03-01',
    total_amount: 250,
    created_at: '2026-03-05T10:00:00Z',
  },
  {
    id: '2',
    claim_id: 'CLM-2026-00002',
    claim_type: 'Pharmacy',
    status: 'Approved' as const,
    provider_name: 'HealthPlus Pharmacy',
    service_date: '2026-02-28',
    total_amount: 75,
    created_at: '2026-03-02T09:00:00Z',
  },
  {
    id: '3',
    claim_id: 'CLM-2026-00003',
    claim_type: 'Dental',
    status: 'Paid' as const,
    provider_name: 'Smile Dental Clinic',
    service_date: '2026-02-25',
    total_amount: 450,
    created_at: '2026-02-26T14:00:00Z',
  },
  {
    id: '4',
    claim_id: 'CLM-2026-00004',
    claim_type: 'Optical',
    status: 'Submitted' as const,
    provider_name: 'Vision Care',
    service_date: '2026-03-07',
    total_amount: 180,
    created_at: '2026-03-07T11:00:00Z',
  },
]

export default function ClaimsPage() {
  const [searchTerm, setSearchTerm] = useState('')

  const filteredClaims = mockClaims.filter(
    (claim) =>
      claim.claim_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      claim.claim_type.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">My Claims</h1>
        <Link href="/submit-claim">
          <Button>New Claim</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Claims</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <Input
                placeholder="Search claims..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
          </div>

          <div className="space-y-4">
            {filteredClaims.map((claim) => (
              <Link
                key={claim.id}
                href={`/claims/${claim.id}`}
                className="block p-4 border border-gray-200 rounded-lg hover:border-laya-teal hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-lg">{claim.claim_id}</p>
                    <p className="text-gray-500">{claim.claim_type} - {claim.provider_name}</p>
                    <p className="text-sm text-gray-400">{formatDate(claim.service_date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-xl">{formatCurrency(claim.total_amount)}</p>
                    <Badge className={getStatusColor(claim.status)}>
                      {claim.status}
                    </Badge>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
