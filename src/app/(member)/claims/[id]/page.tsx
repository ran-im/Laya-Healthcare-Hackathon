'use client'
import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { deriveEffectiveClaimStatus } from '@/lib/claim-status'
import type { AdditionalDocument, HybridDecisionResult, InfoRequest } from '@/types'

const C = { dark: '#003C3A', mid: '#005C58', teal: '#00A89D', warm: '#F2FAF9', gold: '#E8A020', rose: '#E8505B' }

const STATUS_STYLE: Record<string, { bg: string; color: string; icon: string }> = {
  'Submitted':     { bg: '#EFF6FF', color: '#2563EB', icon: '📋' },
  'In Review':     { bg: '#FFFBEB', color: '#D97706', icon: '🔍' },
  'Approved':      { bg: '#ECFDF5', color: '#059669', icon: '✅' },
  'Paid':          { bg: '#F0FDFA', color: '#0D9488', icon: '💳' },
  'Rejected':      { bg: '#FEF2F2', color: '#DC2626', icon: '❌' },
  'Info Required': { bg: '#FFF7ED', color: '#EA580C', icon: '⚠️' },
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object') {
    const candidate = error as {
      message?: unknown
      error_description?: unknown
      details?: unknown
      hint?: unknown
      code?: unknown
      statusText?: unknown
    }

    const parts = [
      typeof candidate.message === 'string' ? candidate.message : null,
      typeof candidate.error_description === 'string' ? candidate.error_description : null,
      typeof candidate.details === 'string' ? candidate.details : null,
      typeof candidate.hint === 'string' ? `Hint: ${candidate.hint}` : null,
      typeof candidate.code === 'string' ? `Code: ${candidate.code}` : null,
      typeof candidate.statusText === 'string' ? candidate.statusText : null,
    ].filter(Boolean)

    if (parts.length > 0) return parts.join(' | ')

    try {
      return JSON.stringify(error)
    } catch {
      return 'Unexpected error'
    }
  }

  return 'Unexpected error'
}

function normalizeAdditionalDocumentType(fileName: string, requestedDocuments: string[] = []) {
  const fileNameLower = fileName.toLowerCase()
  const requested = requestedDocuments.map((doc) => doc.toLowerCase())

  const matches = (patterns: string[]) =>
    patterns.some((pattern) =>
      fileNameLower.includes(pattern) || requested.some((doc) => doc.includes(pattern))
    )

  if (matches(['invoice'])) return 'Invoice'
  if (matches(['receipt'])) return 'Receipt'
  if (matches(['discharge'])) return 'Discharge Summary'
  if (matches(['prescription'])) return 'Prescription'
  if (matches(['referral'])) return 'Referral Letter'
  if (matches(['lab'])) return 'Lab Report'
  if (matches(['pre_authorization', 'pre-authorization', 'pre authorization', 'preauth'])) return 'Pre-authorization'

  return 'Other'
}

export default function ClaimDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)
  const supabase = createClient()
  const [claim, setClaim] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [additionalFiles, setAdditionalFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadMessage, setUploadMessage] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      
      // Verify user is logged in
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      setUserId(user.id)

      console.log('Looking up claim ID:', id)
      console.log('Current user ID:', user.id)

      // Try by UUID
      const { data: byUUID, error: e1 } = await supabase
        .from('claims')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      console.log('UUID lookup result:', byUUID, 'error:', e1)

      if (byUUID) {
        setClaim(byUUID)
        setLoading(false)
        return
      }

      // Try by claim_id string
      const { data: byClaimId, error: e2 } = await supabase
        .from('claims')
        .select('*')
        .eq('claim_id', id)
        .maybeSingle()

      console.log('claim_id lookup result:', byClaimId, 'error:', e2)

      if (byClaimId) {
        setClaim(byClaimId)
        setLoading(false)
        return
      }

      setError(`No claim found for ID: ${id}`)
      setLoading(false)
    }
    load()
  }, [id])

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`claims-member-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'claims',
          filter: `member_id=eq.${userId}`,
        },
        () => {
          // Reload the specific claim
          async function reload() {
            const { data: byUUID } = await supabase
              .from('claims')
              .select('*')
              .eq('id', id)
              .maybeSingle()
            if (byUUID) setClaim(byUUID)
          }
          reload()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, id])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ color: '#9CA3AF' }}>Loading claim...</div>
    </div>
  )

  if (!claim) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '16px' }}>
      <div style={{ fontSize: '48px' }}>🔍</div>
      <div style={{ color: '#6B7280', fontSize: '16px' }}>{error || 'Claim not found'}</div>
      <div style={{ color: '#9CA3AF', fontSize: '12px', fontFamily: 'monospace' }}>ID: {id}</div>
      <button onClick={() => router.push('/claims')} style={{ background: C.teal, color: 'white', border: 'none', padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Back to Claims</button>
    </div>
  )

  const engine = claim?.decision_result as HybridDecisionResult | null
  const displayStatus = deriveEffectiveClaimStatus(claim)
  const status = STATUS_STYLE[displayStatus] || STATUS_STYLE['Submitted']
  const scorecard = engine?.scorecard as
    | {
        fraud_score?: number
        complexity_score?: number
        anomaly_score?: number
      }
    | undefined
  const fraudPct = Math.round(((typeof scorecard?.fraud_score === 'number' ? scorecard.fraud_score : claim.fraud_score) || 0) * 100)
  const complexPct = Math.round(((typeof scorecard?.complexity_score === 'number' ? scorecard.complexity_score : claim.complexity_score) || 0) * 100)
  const anomalyPct = Math.round(((typeof scorecard?.anomaly_score === 'number' ? scorecard.anomaly_score : claim.anomaly_score) || 0) * 100)
  const memberSummary =
    engine?.final_display_summary ??
    engine?.member_decision_summary ??
    engine?.decision_explanation ??
    claim.ai_decision_reason ??
    null
  const nextStep =
    engine?.next_action_text ??
    (engine?.missing_documents?.length || engine?.missing_information?.length
      ? 'Please upload the required documents or update the missing information so your claim can continue.'
      : null)
  const topTriggeredRule = engine?.triggered_rules_summary?.[0]
  const infoRequest = engine?.info_request as InfoRequest | null | undefined
  const additionalDocuments = (engine?.additional_documents ?? []) as AdditionalDocument[]

  async function uploadAdditionalDocuments() {
    if (!claim || !userId || additionalFiles.length === 0 || !infoRequest?.allow_additional_upload) return

    setUploading(true)
    setUploadMessage('')
    try {
      const uploadedDocs: AdditionalDocument[] = []
      const requestedDocuments = infoRequest?.requested_documents ?? []

      for (const file of additionalFiles) {
        const ext = file.name.split('.').pop()
        const filePath = `${userId}/${claim.id}/additional-${Date.now()}-${file.name.replace(/\s+/g, '-')}.${ext}`
        const documentType = normalizeAdditionalDocumentType(file.name, requestedDocuments)

        const { error: uploadErr } = await supabase.storage
          .from('claim-documents')
          .upload(filePath, file)

        if (uploadErr) throw new Error(`Storage upload failed for ${file.name}: ${getErrorMessage(uploadErr)}`)

        const { data: urlData } = supabase.storage
          .from('claim-documents')
          .getPublicUrl(filePath)

        const { error: insertErr } = await supabase.from('claim_documents').insert({
          claim_id: claim.id,
          document_type: documentType,
          file_name: file.name,
          file_path: filePath,
          file_url: urlData?.publicUrl,
          file_size: file.size,
          mime_type: file.type,
        })

        if (insertErr) throw new Error(`Document record insert failed for ${file.name}: ${getErrorMessage(insertErr)}`)

        uploadedDocs.push({
          name: file.name,
          url: urlData?.publicUrl,
          uploaded_at: new Date().toISOString(),
          uploaded_by: userId,
          document_type: documentType,
          file_path: filePath,
        })
      }

      const res = await fetch('/api/claims/additional-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimId: claim.id,
          uploadedDocs,
        }),
      })

      const result = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(result?.error || 'Could not update claim after uploading documents')
      }

      setClaim((prev: any) => prev ? { ...prev, ...result.claim } : prev)
      setAdditionalFiles([])
      setUploadMessage('Additional documents uploaded successfully. Your claim is back in review.')
    } catch (uploadErr) {
      const message = getErrorMessage(uploadErr)
      console.error('Additional document upload failed:', message, uploadErr)
      setUploadMessage(
        message || 'Could not upload additional documents. Please try again.'
      )
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{ background: '#F8FAFA', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${C.dark} 0%, ${C.mid} 50%, ${C.teal} 100%)`, padding: '32px 32px 40px' }}>
        <button onClick={() => router.push('/claims')} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', color: 'white', padding: '7px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', marginBottom: '20px' }}>
          ← Back to Claims
        </button>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'monospace', color: 'rgba(255,255,255,0.7)', fontSize: '13px', marginBottom: '4px' }}>{claim.claim_id}</div>
            <h1 style={{ color: 'white', fontSize: '26px', fontWeight: 700, margin: '0 0 6px' }}>{claim.provider_name}</h1>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '14px' }}>{claim.claim_type} · {claim.service_type}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            <span style={{ background: status.bg, color: status.color, padding: '6px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 700 }}>
              {status.icon} {displayStatus}
            </span>
            <div style={{ color: 'white', fontSize: '28px', fontWeight: 800 }}>€{Number(claim.total_amount).toFixed(2)}</div>
            {claim.approved_amount && claim.approved_amount !== claim.total_amount && (
              <div style={{ color: '#86EFAC', fontSize: '13px' }}>Approved: €{Number(claim.approved_amount).toFixed(2)}</div>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>
        {/* Decision explanation */}
        {memberSummary && (
          <div style={{ background: '#F8FAFB', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '8px', fontSize: '14px', fontWeight: 700, color: C.dark }}>Decision</h3>
            <p style={{ marginBottom: 0, fontSize: '14px', color: '#374151', lineHeight: 1.6 }}>{memberSummary}</p>
          </div>
        )}

        {/* Next action */}
        {nextStep && (
          <div style={{ background: '#F8FAFB', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '8px', fontSize: '14px', fontWeight: 700, color: C.dark }}>Next step</h3>
            <p style={{ marginBottom: 0, fontSize: '14px', color: '#374151', lineHeight: 1.6 }}>{nextStep}</p>
          </div>
        )}

        {infoRequest && (
          <div style={{ background:'#FFF7ED', borderRadius:'12px', padding:'16px', marginBottom:'16px', border:'1px solid #FED7AA' }}>
            <h3 style={{ marginTop:0, marginBottom:'8px', fontSize:'14px', fontWeight:700, color:'#9A3412' }}>
              Additional information requested
            </h3>
            <p style={{ margin:'0 0 8px 0', fontSize:'13px', color:'#7C2D12', fontWeight:600 }}>
              Request status: {infoRequest.status}
            </p>
            {infoRequest.message && (
              <p style={{ margin:'0 0 10px 0', fontSize:'14px', color:'#7C2D12', lineHeight:1.6 }}>
                {infoRequest.message}
              </p>
            )}
            {infoRequest.requested_documents?.length > 0 && (
              <>
                <div style={{ fontSize:'12px', color:'#B45309', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:'8px' }}>
                  Requested documents
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'8px', marginBottom:'12px' }}>
                  {infoRequest.requested_documents.map((doc, index) => (
                    <span key={`${doc}-${index}`} style={{ fontSize:'12px', padding:'5px 10px', borderRadius:'999px', background:'white', border:'1px solid #FDE68A', color:'#B45309', fontWeight:600 }}>
                      {doc}
                    </span>
                  ))}
                </div>
              </>
            )}

            {infoRequest.allow_additional_upload && infoRequest.status !== 'RESOLVED' && (
              <div style={{ marginTop:'12px', paddingTop:'12px', borderTop:'1px solid #FED7AA' }}>
                <div style={{ fontSize:'12px', color:'#B45309', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:'8px' }}>
                  Upload additional documents
                </div>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setAdditionalFiles(Array.from(e.target.files ?? []))}
                  style={{ marginBottom:'12px', fontSize:'13px', color:'#7C2D12' }}
                />
                {additionalFiles.length > 0 && (
                  <ul style={{ margin:'0 0 12px 0', paddingLeft:'20px', color:'#7C2D12', fontSize:'13px' }}>
                    {additionalFiles.map((file) => (
                      <li key={`${file.name}-${file.size}`}>{file.name}</li>
                    ))}
                  </ul>
                )}
                <button
                  onClick={uploadAdditionalDocuments}
                  disabled={uploading || additionalFiles.length === 0}
                  style={{
                    padding:'10px 16px',
                    borderRadius:'10px',
                    border:'none',
                    cursor:'pointer',
                    fontWeight:700,
                    color:'white',
                    background: uploading || additionalFiles.length === 0 ? '#D1D5DB' : `linear-gradient(135deg, ${C.dark}, ${C.teal})`,
                  }}
                >
                  {uploading ? 'Uploading...' : 'Submit additional documents'}
                </button>
                {uploadMessage && (
                  <p style={{ margin:'10px 0 0', fontSize:'13px', color: uploadMessage.includes('successfully') ? '#059669' : '#B91C1C' }}>
                    {uploadMessage}
                  </p>
                )}
              </div>
            )}

            {additionalDocuments.length > 0 && (
              <div style={{ marginTop:'12px' }}>
                <div style={{ fontSize:'12px', color:'#6B7280', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:'8px' }}>
                  Additional documents submitted
                </div>
                <div style={{ display:'grid', gap:'8px' }}>
                  {additionalDocuments.map((doc, index) => (
                    <div key={`${doc.name}-${index}`} style={{ padding:'10px 12px', borderRadius:'10px', background:'white', border:'1px solid #E5E7EB', fontSize:'13px', color:'#374151' }}>
                      {doc.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Main rule */}
        {topTriggeredRule && (
          <div style={{ background: '#FFFFFF', borderRadius: '12px', padding: '16px', marginBottom: '16px', border: '1px solid #E5E7EB' }}>
            <h3 style={{ marginTop: 0, marginBottom: '10px', fontSize: '14px', fontWeight: 700, color: C.dark }}>Main rule</h3>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827', marginBottom: '6px' }}>
              {topTriggeredRule.rule_id} - {topTriggeredRule.rule_name}
            </div>
            <div style={{ fontSize: '13px', color: '#374151', marginBottom: '6px' }}>
              {topTriggeredRule.claim_explanation}
            </div>
            <div style={{ fontSize: '12px', color: '#6B7280' }}>
              {topTriggeredRule.rule_explanation}
            </div>
          </div>
        )}

        {/* Missing documents */}
        {(engine?.missing_documents?.length ?? 0) > 0 && (
          <div style={{ background: '#FFF7ED', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '14px', fontWeight: 700, color: '#EA580C' }}>Missing documents</h3>
            <ul style={{ margin: 0, paddingLeft: '20px', color: '#7C2D12', fontSize: '14px' }}>
              {(engine?.missing_documents ?? []).map((d: string) => <li key={d} style={{ marginBottom: '4px' }}>{d}</li>)}
            </ul>
          </div>
        )}

        {/* Missing information */}
        {(engine?.missing_information?.length ?? 0) > 0 && (
          <div style={{ background: '#FFF7ED', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '14px', fontWeight: 700, color: '#EA580C' }}>More information needed</h3>
            <ul style={{ margin: 0, paddingLeft: '20px', color: '#7C2D12', fontSize: '14px' }}>
              {(engine?.missing_information ?? []).map((d: string) => <li key={d} style={{ marginBottom: '4px' }}>{d}</li>)}
            </ul>
          </div>
        )}

        {/* Estimated payable amount */}
        {engine?.estimated_payable_amount_eur !== undefined && engine.estimated_payable_amount_eur !== null && (
          <div style={{ background: '#ECFDF5', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '8px', fontSize: '14px', fontWeight: 700, color: '#059669' }}>Estimated payable amount</h3>
            <p style={{ marginBottom: 0, fontSize: '20px', fontWeight: 700, color: '#059669' }}>€{Number(engine.estimated_payable_amount_eur).toFixed(2)}</p>
          </div>
        )}

        {/* Rejection notice (legacy fallback) */}
        {displayStatus === 'Rejected' && !memberSummary && (
          <div style={{ background: '#FEF2F2', border: '2px solid #FECACA', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '20px' }}>❌</span>
              <span style={{ fontWeight: 700, color: '#DC2626', fontSize: '15px' }}>This claim has been rejected</span>
            </div>
            {claim.rejection_reason && <p style={{ color: '#7F1D1D', fontSize: '14px', margin: 0 }}>Reason: {claim.rejection_reason}</p>}
            <p style={{ color: '#991B1B', fontSize: '13px', margin: '8px 0 0' }}>If you believe this is incorrect, please contact Laya Healthcare on 1890 700 890.</p>
          </div>
        )}

        {/* Info required notice (legacy fallback) */}
        {displayStatus === 'Info Required' && !engine?.missing_documents?.length && !engine?.missing_information?.length && (
          <div style={{ background: '#FFF7ED', border: '2px solid #FED7AA', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '20px' }}>⚠️</span>
              <span style={{ fontWeight: 700, color: '#EA580C', fontSize: '15px' }}>Additional information required</span>
            </div>
            <p style={{ color: '#7C2D12', fontSize: '14px', margin: 0 }}>Our assessor has requested more information. Please contact us or resubmit with the required documents.</p>
          </div>
        )}

        {/* Claim details card */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '28px', marginBottom: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: C.dark, margin: '0 0 20px', paddingBottom: '12px', borderBottom: '1px solid #F3F4F6' }}>Claim Details</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {[
              { label: 'Claim Type', value: claim.claim_type },
              { label: 'Service Type', value: claim.service_type },
              { label: 'Provider', value: claim.provider_name },
              { label: 'Provider Type', value: claim.provider_type },
              { label: 'Service Date', value: claim.service_date ? new Date(claim.service_date).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' }) : '—' },
              { label: 'Treatment Country', value: claim.treatment_country || 'Ireland' },
              { label: 'Amount Claimed', value: `€${Number(claim.total_amount).toFixed(2)}` },
              { label: 'Pre-Authorized', value: claim.is_pre_authorized ? '✅ Yes' : '❌ No' },
            ].map(item => (
              <div key={item.label}>
                <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{item.label}</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#1F2937' }}>{item.value || '—'}</div>
              </div>
            ))}
          </div>
          {claim.description && (
            <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #F3F4F6' }}>
              <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Description</div>
              <div style={{ fontSize: '14px', color: '#374151', lineHeight: 1.6 }}>{claim.description}</div>
            </div>
          )}
        </div>

        {/* AI Assessment */}
        {(claim.ai_summary || claim.fraud_score > 0) && (
          <div style={{ background: 'white', borderRadius: '16px', padding: '28px', marginBottom: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: C.dark, margin: '0 0 20px', paddingBottom: '12px', borderBottom: '1px solid #F3F4F6' }}>🤖 AI Assessment</h2>
            {claim.ai_summary && <p style={{ color: '#374151', fontSize: '14px', lineHeight: 1.7, marginBottom: '20px' }}>{claim.ai_summary}</p>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              {[
                { label: 'Fraud Score', value: fraudPct, color: fraudPct > 50 ? C.rose : fraudPct > 25 ? C.gold : '#059669' },
                { label: 'Complexity', value: complexPct, color: complexPct > 70 ? C.rose : complexPct > 40 ? C.gold : '#059669' },
                { label: 'Anomaly', value: anomalyPct, color: '#6B7280' },
              ].map(score => (
                <div key={score.label} style={{ background: C.warm, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: score.color }}>{score.value}%</div>
                  <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>{score.label}</div>
                  <div style={{ height: '4px', background: '#E5E7EB', borderRadius: '2px', marginTop: '8px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${score.value}%`, background: score.color, borderRadius: '2px' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status timeline */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '28px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: C.dark, margin: '0 0 20px', paddingBottom: '12px', borderBottom: '1px solid #F3F4F6' }}>Status Timeline</h2>
          {[
            { status: 'Submitted', date: claim.submitted_at, done: true },
            { status: 'In Review', date: displayStatus !== 'Submitted' ? claim.updated_at : null, done: ['In Review','Approved','Paid','Rejected','Info Required'].includes(displayStatus) },
            { status: 'Decision', date: ['Approved','Paid','Rejected'].includes(displayStatus) ? claim.updated_at : null, done: ['Approved','Paid','Rejected'].includes(displayStatus) },
            { status: 'Paid', date: displayStatus === 'Paid' ? claim.updated_at : null, done: displayStatus === 'Paid' },
          ].map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: '16px', marginBottom: i < 3 ? '16px' : 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: step.done ? C.teal : '#E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: step.done ? 'white' : '#9CA3AF', fontSize: '14px', flexShrink: 0 }}>
                  {step.done ? '✓' : i + 1}
                </div>
                {i < 3 && <div style={{ width: '2px', flex: 1, background: step.done ? C.teal : '#E5E7EB', marginTop: '4px', minHeight: '24px' }} />}
              </div>
              <div style={{ paddingTop: '4px', paddingBottom: '16px' }}>
                <div style={{ fontWeight: 600, color: step.done ? C.dark : '#9CA3AF', fontSize: '14px' }}>{step.status}</div>
                {step.date && <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>{new Date(step.date).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
