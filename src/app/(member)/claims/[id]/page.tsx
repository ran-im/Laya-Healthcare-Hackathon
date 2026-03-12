'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const C = { dark: '#003C3A', mid: '#005C58', teal: '#00A89D', warm: '#F2FAF9', gold: '#E8A020', rose: '#E8505B' }

const STATUS_STYLE: Record<string, { bg: string; color: string; icon: string }> = {
  'Submitted':     { bg: '#EFF6FF', color: '#2563EB', icon: '📋' },
  'In Review':     { bg: '#FFFBEB', color: '#D97706', icon: '🔍' },
  'Approved':      { bg: '#ECFDF5', color: '#059669', icon: '✅' },
  'Paid':          { bg: '#F0FDFA', color: '#0D9488', icon: '💳' },
  'Rejected':      { bg: '#FEF2F2', color: '#DC2626', icon: '❌' },
  'Info Required': { bg: '#FFF7ED', color: '#EA580C', icon: '⚠️' },
}

export default function ClaimDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const supabase = createClient()
  const [claim, setClaim] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      
      // First try as UUID
      const { data: byUUID } = await supabase
        .from('claims')
        .select('*')
        .eq('id', params.id)
        .maybeSingle()
      
      if (byUUID) {
        setClaim(byUUID)
        setLoading(false)
        return
      }

      // Then try as claim_id string  
      const { data: byClaimId } = await supabase
        .from('claims')
        .select('*')
        .eq('claim_id', params.id)
        .maybeSingle()

      if (byClaimId) {
        setClaim(byClaimId)
        setLoading(false)
        return
      }

      setLoading(false)
    }
    load()
  }, [params.id])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ color: '#9CA3AF' }}>Loading claim...</div>
    </div>
  )

  if (!claim) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '16px' }}>
      <div style={{ fontSize: '48px' }}>🔍</div>
      <div style={{ color: '#6B7280', fontSize: '16px' }}>Claim not found</div>
      <button onClick={() => router.push('/claims')} style={{ background: C.teal, color: 'white', border: 'none', padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Back to Claims</button>
    </div>
  )

  const status = STATUS_STYLE[claim.status] || STATUS_STYLE['Submitted']
  const fraudPct = Math.round((claim.fraud_score || 0) * 100)
  const complexPct = Math.round((claim.complexity_score || 0) * 100)

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
              {status.icon} {claim.status}
            </span>
            <div style={{ color: 'white', fontSize: '28px', fontWeight: 800 }}>€{Number(claim.total_amount).toFixed(2)}</div>
            {claim.approved_amount && claim.approved_amount !== claim.total_amount && (
              <div style={{ color: '#86EFAC', fontSize: '13px' }}>Approved: €{Number(claim.approved_amount).toFixed(2)}</div>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>
        {/* Rejection notice */}
        {claim.status === 'Rejected' && (
          <div style={{ background: '#FEF2F2', border: '2px solid #FECACA', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '20px' }}>❌</span>
              <span style={{ fontWeight: 700, color: '#DC2626', fontSize: '15px' }}>This claim has been rejected</span>
            </div>
            {claim.rejection_reason && <p style={{ color: '#7F1D1D', fontSize: '14px', margin: 0 }}>Reason: {claim.rejection_reason}</p>}
            <p style={{ color: '#991B1B', fontSize: '13px', margin: '8px 0 0' }}>If you believe this is incorrect, please contact Laya Healthcare on 1890 700 890.</p>
          </div>
        )}

        {/* Info required notice */}
        {claim.status === 'Info Required' && (
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
                { label: 'Anomaly', value: Math.round((claim.anomaly_score || 0) * 100), color: '#6B7280' },
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
            { status: 'In Review', date: claim.status !== 'Submitted' ? claim.updated_at : null, done: ['In Review','Approved','Paid','Rejected','Info Required'].includes(claim.status) },
            { status: 'Decision', date: ['Approved','Paid','Rejected'].includes(claim.status) ? claim.updated_at : null, done: ['Approved','Paid','Rejected'].includes(claim.status) },
            { status: 'Paid', date: claim.status === 'Paid' ? claim.updated_at : null, done: claim.status === 'Paid' },
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
