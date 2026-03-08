'use client'

import { CheckCircle, Clock, AlertCircle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ClaimStatus } from '@/types'

interface StatusTimelineProps {
  status: ClaimStatus
  createdAt: string
  updatedAt?: string
}

const statusSteps: { status: ClaimStatus; label: string }[] = [
  { status: 'Submitted', label: 'Claim Submitted' },
  { status: 'In Review', label: 'In Review' },
  { status: 'Approved', label: 'Approved' },
  { status: 'Paid', label: 'Payment Processed' },
]

export function StatusTimeline({ status, createdAt, updatedAt }: StatusTimelineProps) {
  const currentIndex = statusSteps.findIndex((s) => s.status === status)

  const getIcon = (stepStatus: ClaimStatus) => {
    const index = statusSteps.findIndex((s) => s.status === stepStatus)
    if (index < currentIndex) return <CheckCircle className="h-5 w-5 text-green-500" />
    if (index === currentIndex) return <Clock className="h-5 w-5 text-laya-teal" />
    if (status === 'Rejected') return <XCircle className="h-5 w-5 text-red-500" />
    if (status === 'Info Required') return <AlertCircle className="h-5 w-5 text-orange-500" />
    return <Clock className="h-5 w-5 text-gray-300" />
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Claim Timeline</h3>
      <div className="relative">
        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200" />
        <div className="space-y-6">
          {statusSteps.map((step, index) => (
            <div key={step.status} className="relative flex items-start space-x-4">
              <div className={cn(
                'relative z-10 flex items-center justify-center w-10 h-10 rounded-full bg-white border-2',
                index <= currentIndex ? 'border-laya-teal' : 'border-gray-300'
              )}>
                {getIcon(step.status)}
              </div>
              <div className="pt-2">
                <p className={cn(
                  'font-medium',
                  index <= currentIndex ? 'text-gray-900' : 'text-gray-500'
                )}>
                  {step.label}
                </p>
                <p className="text-sm text-gray-500">
                  {index === 0 && createdAt}
                  {index === currentIndex && updatedAt && ` - ${updatedAt}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
