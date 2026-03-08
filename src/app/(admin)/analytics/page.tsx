'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Users, FileText, DollarSign, TrendingUp, AlertTriangle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

const stats = [
  { title: 'Total Members', value: '1,234', icon: Users, color: 'text-blue-500', change: '+12%' },
  { title: 'Total Claims', value: '3,456', icon: FileText, color: 'text-purple-500', change: '+8%' },
  { title: 'Total Payout', value: '€245,678', icon: DollarSign, color: 'text-green-500', change: '+15%' },
  { title: 'Fraud Detected', value: '23', icon: AlertTriangle, color: 'text-red-500', change: '-5%' },
]

const claimsByType = [
  { type: 'Outpatient', count: 450, amount: 45000 },
  { type: 'Inpatient', count: 120, amount: 180000 },
  { type: 'Pharmacy', count: 890, amount: 34500 },
  { type: 'Dental', count: 340, amount: 28000 },
  { type: 'Optical', count: 210, amount: 15000 },
]

const claimsByStatus = [
  { status: 'Submitted', count: 45 },
  { status: 'In Review', count: 23 },
  { status: 'Approved', count: 156 },
  { status: 'Paid', count: 890 },
  { status: 'Rejected', count: 12 },
]

export default function AnalyticsPage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
      <p className="text-gray-500">Overview of claims and member activity</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{stat.title}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                  <p className={`text-sm ${stat.change.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
                    {stat.change} from last month
                  </p>
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
            <CardTitle>Claims by Type</CardTitle>
            <CardDescription>Distribution of claim types</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {claimsByType.map((item) => (
                <div key={item.type} className="flex items-center justify-between">
                  <span className="font-medium">{item.type}</span>
                  <div className="flex items-center space-x-4">
                    <span className="text-gray-500">{item.count} claims</span>
                    <span className="font-semibold">{formatCurrency(item.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Claims by Status</CardTitle>
            <CardDescription>Current status distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {claimsByStatus.map((item) => (
                <div key={item.status} className="flex items-center justify-between">
                  <Badge className={item.status === 'Rejected' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}>
                    {item.status}
                  </Badge>
                  <span className="font-medium">{item.count} claims</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
