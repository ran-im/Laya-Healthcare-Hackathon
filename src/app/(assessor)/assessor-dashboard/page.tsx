'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { FileText, Clock, CheckCircle, AlertTriangle, Users } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

const stats = [
  { title: 'Pending Review', value: '8', icon: Clock, color: 'text-yellow-500' },
  { title: 'Reviewed Today', value: '15', icon: CheckCircle, color: 'text-green-500' },
  { title: 'High Risk', value: '3', icon: AlertTriangle, color: 'text-red-500' },
  { title: 'Total Claims', value: '156', icon: FileText, color: 'text-blue-500' },
]

const pendingClaims = [
  {
    id: '1',
    claim_id: 'CLM-2026-00001',
    claim_type: 'Outpatient',
    provider_name: 'St. James Hospital',
    total_amount: 250,
    fraud_score: 15,
    submitted_at: '2026-03-05T10:00:00Z',
  },
  {
    id: '2',
    claim_id: 'CLM-2026-00005',
    claim_type: 'Inpatient',
    provider_name: 'Mater Hospital',
    total_amount: 4500,
    fraud_score: 72,
    submitted_at: '2026-03-06T09:30:00Z',
  },
  {
    id: '3',
    claim_id: 'CLM-2026-00006',
    claim_type: 'Pharmacy',
    provider_name: 'HealthPlus Pharmacy',
    total_amount: 125,
    fraud_score: 8,
    submitted_at: '2026-03-06T11:15:00Z',
  },
]

export default function AssessorDashboardPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Assessor Dashboard</h1>
          <p className="text-gray-500">Review and process claims</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{stat.title}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-full bg-gray-100 ${stat.color}`}>
                  <stat.icon className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Claims Pending Review</CardTitle>
          <CardDescription>Claims awaiting assessment</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {pendingClaims.map((claim) => (
              <Link
                key={claim.id}
                href={`/review/${claim.id}`}
                className="block p-4 border border-gray-200 rounded-lg hover:border-laya-teal hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-lg">{claim.claim_id}</p>
                    <p className="text-gray-500">{claim.claim_type} - {claim.provider_name}</p>
                    <p className="text-sm text-gray-400">{claim.submitted_at}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-xl">{formatCurrency(claim.total_amount)}</p>
                    <Badge variant={claim.fraud_score > 50 ? 'destructive' : claim.fraud_score > 30 ? 'warning' : 'success'}>
                      Risk: {claim.fraud_score}
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
