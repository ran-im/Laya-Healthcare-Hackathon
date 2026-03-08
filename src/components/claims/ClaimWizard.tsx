'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { CLAIM_TYPES, PROVIDER_TYPES } from '@/lib/constants'

interface ClaimWizardProps {
  onSubmit?: (data: ClaimFormData) => void
}

interface ClaimFormData {
  claim_type: string
  provider_name: string
  provider_type: string
  service_date: string
  total_amount: number
  description: string
}

export function ClaimWizard({ onSubmit }: ClaimWizardProps) {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState<ClaimFormData>({
    claim_type: '',
    provider_name: '',
    provider_type: '',
    service_date: '',
    total_amount: 0,
    description: '',
  })

  const handleChange = (field: keyof ClaimFormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const nextStep = () => setStep((prev) => prev + 1)
  const prevStep = () => setStep((prev) => prev - 1)

  const handleSubmit = () => {
    onSubmit?.(formData)
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Submit a Claim</CardTitle>
        <CardDescription>Step {step} of 3</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Claim Type</label>
                <select
                  className="w-full h-10 rounded-md border border-gray-300 px-3"
                  value={formData.claim_type}
                  onChange={(e) => handleChange('claim_type', e.target.value)}
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
                  onChange={(e) => handleChange('provider_type', e.target.value)}
                >
                  <option value="">Select provider type</option>
                  {PROVIDER_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Provider Name</label>
                <Input
                  placeholder="Enter provider name"
                  value={formData.provider_name}
                  onChange={(e) => handleChange('provider_name', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Service Date</label>
                <Input
                  type="date"
                  value={formData.service_date}
                  onChange={(e) => handleChange('service_date', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Total Amount (EUR)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={formData.total_amount || ''}
                  onChange={(e) => handleChange('total_amount', parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  className="w-full h-32 rounded-md border border-gray-300 p-3"
                  placeholder="Describe your claim..."
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={prevStep} disabled={step === 1}>
              Previous
            </Button>
            {step < 3 ? (
              <Button onClick={nextStep}>Next</Button>
            ) : (
              <Button onClick={handleSubmit}>Submit Claim</Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
