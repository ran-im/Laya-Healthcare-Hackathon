'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { FileText, DollarSign, Clock, CheckCircle, TrendingUp } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

const stats = [
  { title: 'Total Claims', value: '12', icon: FileText, color: 'text-blue-500' },
  { title: 'Total Paid', value: formatCurrency(3250), icon: DollarSign, color: 'text-green-500' },
  { title: 'Pending', value: '3', icon: Clock, color: 'text-yellow-500' },
  { title: 'Approved', value: '9', icon: CheckCircle, color: 'text-laya-teal' },
]

const recentClaims = [
  { id: '1', type: 'Outpatient', amount: 250, status: 'In Review', date: '2026-03-05' },
  { id: '2', type: 'Pharmacy', amount: 75, status: 'Approved', date: '2026-03-02' },
  { id: '3', type: 'Dental', amount: 450, status: 'Paid', date: '2026-02-28' },
]

export default function DashboardPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Welcome Back</h1>
          <p className="text-gray-500">Here&apos;s an overview of your claims</p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          Member ID: MBR-001
        </Badge>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              Recent Claims
            </CardTitle>
            <CardDescription>Your last 3 claims</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentClaims.map((claim) => (
                <div key={claim.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">{claim.type}</p>
                    <p className="text-sm text-gray-500">{claim.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(claim.amount)}</p>
                    <Badge variant={claim.status === 'Approved' || claim.status === 'Paid' ? 'success' : 'warning'}>
                      {claim.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <a href="/submit-claim" className="block p-4 bg-laya-teal text-white rounded-lg hover:bg-laya-mid transition-colors">
              Submit New Claim
            </a>
            <a href="/benefit-check" className="block p-4 border border-laya-teal text-laya-teal rounded-lg hover:bg-laya-warm transition-colors">
              Check Benefits
            </a>
            <a href="/claims" className="block p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              View All Claims
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
