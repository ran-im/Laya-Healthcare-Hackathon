'use client'

import { use } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ArrowLeft, FileText, Building, Calendar, DollarSign } from 'lucide-react'
import { StatusTimeline } from '@/components/claims/StatusTimeline'
import { RiskScoreGauge } from '@/components/claims/RiskScoreGauge'
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils'

interface PageProps {
  params: Promise<{ id: string }>
}

const mockClaim = {
  id: '1',
  claim_id: 'CLM-2026-00001',
  claim_type: 'Outpatient',
  status: 'In Review' as const,
  provider_name: 'St. James Hospital',
  provider_type: 'Hospital',
  service_date: '2026-03-01',
  total_amount: 250,
  currency: 'EUR',
  description: 'Routine checkup and blood tests',
  fraud_score: 15,
  complexity_score: 25,
  ai_summary: 'Standard outpatient claim with routine services. Documentation appears complete.',
  created_at: '2026-03-05T10:00:00Z',
  updated_at: '2026-03-06T14:00:00Z',
}

export default function ClaimDetailPage({ params }: PageProps) {
  const { id } = use(params)
  const claim = mockClaim

  return (
    <div className="p-6 space-y-6">
      <Link href="/claims">
        <Button variant="ghost">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Claims
        </Button>
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{claim.claim_id}</h1>
          <p className="text-gray-500">{claim.claim_type}</p>
        </div>
        <Badge className={getStatusColor(claim.status)}>
          {claim.status}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Claim Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-3">
                  <FileText className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Claim Type</p>
                    <p className="font-medium">{claim.claim_type}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Building className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Provider</p>
                    <p className="font-medium">{claim.provider_name}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Calendar className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Service Date</p>
                    <p className="font-medium">{formatDate(claim.service_date)}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <DollarSign className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Amount</p>
                    <p className="font-medium">{formatCurrency(claim.total_amount, claim.currency)}</p>
                  </div>
                </div>
              </div>
              {claim.description && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-gray-500 mb-1">Description</p>
                  <p>{claim.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {claim.ai_summary && (
            <Card>
              <CardHeader>
                <CardTitle>AI Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <p>{claim.ai_summary}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Risk Assessment</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <RiskScoreGauge score={claim.fraud_score || 0} label="Fraud Risk" />
              <div className="mt-4 w-full space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Complexity Score</span>
                  <span>{claim.complexity_score || 0}/100</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-laya-teal h-2 rounded-full"
                    style={{ width: `${claim.complexity_score || 0}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusTimeline
                status={claim.status}
                createdAt={formatDate(claim.created_at)}
                updatedAt={formatDate(claim.updated_at)}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
