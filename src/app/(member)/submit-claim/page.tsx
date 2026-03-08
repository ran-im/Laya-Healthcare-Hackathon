'use client'

import { ClaimWizard } from '@/components/claims/ClaimWizard'
import { DocumentUpload } from '@/components/claims/DocumentUpload'

export default function SubmitClaimPage() {
  const handleClaimSubmit = (data: unknown) => {
    console.log('Claim submitted:', data)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Submit a Claim</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ClaimWizard onSubmit={handleClaimSubmit} />
        <div>
          <h3 className="text-lg font-semibold mb-4">Upload Documents</h3>
          <DocumentUpload />
        </div>
      </div>
    </div>
  )
}
