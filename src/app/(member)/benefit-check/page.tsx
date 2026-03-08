'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { CheckCircle, XCircle, FileText, DollarSign } from 'lucide-react'
import { CLAIM_TYPES, PROVIDER_TYPES } from '@/lib/constants'
import type { BenefitCheckResult } from '@/types'

export default function BenefitCheckPage() {
  const [formData, setFormData] = useState({
    claim_type: '',
    provider_type: '',
    estimated_amount: 0,
  })
  const [result, setResult] = useState<BenefitCheckResult | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const response = await fetch('/api/ai/benefit-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await response.json()
      setResult(data)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Check Benefits</h1>
      <p className="text-gray-500">Check your coverage before submitting a claim</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Benefit Check</CardTitle>
            <CardDescription>Enter claim details to check coverage</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Claim Type</label>
                <select
                  className="w-full h-10 rounded-md border border-gray-300 px-3"
                  value={formData.claim_type}
                  onChange={(e) => setFormData({ ...formData, claim_type: e.target.value })}
                  required
                >
                  <option value="">Select claim type</option>
                  {CLAIM_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Provider Type</label>
                <select
                  className="w-full h-10 rounded-md border border-gray-300 px-3"
                  value={formData.provider_type}
                  onChange={(e) => setFormData({ ...formData, provider_type: e.target.value })}
                  required
                >
                  <option value="">Select provider type</option>
                  {PROVIDER_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Estimated Amount (EUR)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={formData.estimated_amount || ''}
                  onChange={(e) => setFormData({ ...formData, estimated_amount: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Checking...' : 'Check Coverage'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader>
              <CardTitle>Coverage Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-center py-4">
                {result.is_covered ? (
                  <div className="flex items-center text-green-600">
                    <CheckCircle className="h-8 w-8 mr-2" />
                    <span className="text-xl font-semibold">Covered</span>
                  </div>
                ) : (
                  <div className="flex items-center text-red-600">
                    <XCircle className="h-8 w-8 mr-2" />
                    <span className="text-xl font-semibold">Not Covered</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg text-center">
                  <p className="text-sm text-gray-500">Coverage</p>
                  <p className="text-2xl font-bold text-laya-teal">{result.coverage_percentage}%</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg text-center">
                  <p className="text-sm text-gray-500">Estimated Payout</p>
                  <p className="text-2xl font-bold text-green-600">€{result.estimated_payout.toFixed(2)}</p>
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center mb-2">
                  <DollarSign className="h-4 w-4 mr-2 text-gray-500" />
                  <span className="font-medium">Plan Limits</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Plan Limit:</span>
                    <span>€{result.plan_limit.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Used:</span>
                    <span>€{result.used_amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Remaining:</span>
                    <span className="text-green-600">€{result.remaining.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {result.required_documents.length > 0 && (
                <div>
                  <p className="font-medium mb-2">Required Documents</p>
                  <div className="space-y-2">
                    {result.required_documents.map((doc) => (
                      <div key={doc} className="flex items-center text-sm">
                        <FileText className="h-4 w-4 mr-2 text-gray-400" />
                        {doc}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.notes && (
                <p className="text-sm text-gray-500 italic">{result.notes}</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
