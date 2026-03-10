'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const C = { dark: '#003C3A', mid: '#005C58', teal: '#00A89D', accent: '#00D4C8', warm: '#F2FAF9', gold: '#E8A020', rose: '#E8505B' }

export default function AdminAnalyticsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [stats, setStats] = useState({ total: 0, approved: 0, rejected: 0, pending: 0, totalPaid: 0, avgAmount: 0, fraudFlagged: 0, autoApproved: 0 })
  const [claims, setClaims] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('claims').select('*').order('created_at', { ascending: false })
      if (data) {
        setClaims(data)
        const approved = data.filter(c => ['Approved', 'Paid'].includes(c.status))
        const rejected = data.filter(c => c.status === 'Rejected')
        const pending = data.filter(c => ['Submitted', 'In Review', 'Info Required'].includes(c.status))
        const totalPaid = approved.reduce((s, c) => s + (c.approved_amount || 0), 0)
        const avgAmount = data.length ? data.reduce((s, c) => s + (c.total_amount || 0), 0) / data.length : 0
        const fraudFlagged = data.filter(c => (c.fraud_score || 0) > 0.5).length
        const autoApproved = data.filter(c => c.routing === 'auto').length
        setStats({ total: data.length, approved: approved.length, rejected: rejected.length, pending: pending.length, totalPaid, avgAmount, fraudFlagged, autoApproved })
      }
      setLoading(false)
    }
    load()
  }, [])

  // Group by type
  const byType = claims.reduce((acc: any, c) => {
    acc[c.claim_type] = (acc[c.claim_type] || 0) + 1
    return acc
  }, {})

  const typeColors: Record<string, string> = {
    Outpatient: C.teal, Inpatient: C.gold, Pharmacy: '#8B5CF6', Dental: '#EC4899', Optical: '#3B82F6', Emergency: C.rose
  }

  const statCards = [
    { label: 'Total Claims', value: stats.total, icon: '📋', color: C.teal },
    { label: 'Approved', value: stats.approved, icon: '✅', color: '#059669' },
    { label: 'Pending Review', value: stats.pending, icon: '⏳', color: C.gold },
    { label: 'Rejected', value: stats.rejected, icon: '❌', color: C.rose },
    { label: 'Total Paid Out', value: `€${stats.totalPaid.toFixed(2)}`, icon: '💶', color: C.teal },
    { label: 'Avg Claim Value', value: `€${stats.avgAmount.toFixed(2)}`, icon: '📊', color: C.mid },
    { label: 'Fraud Flagged', value: stats.fraudFlagged, icon: '🚨', color: C.rose },
    { label: 'Auto-Approved', value: stats.autoApproved, icon: '⚡', color: '#8B5CF6' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFA' }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${C.dark} 0%, ${C.mid} 50%, ${C.teal} 100%)`, padding: '40px 32px 48px' }}>
        <button onClick={() => router.back()} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', color: 'white', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', marginBottom: '24px', fontSize: '14px' }}>
          ← Back
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 style={{ color: 'white', fontSize: '28px', fontWeight: 700, margin: '0 0 8px' }}>Analytics Dashboard</h1>
            <p style={{ color: 'rgba(255,255,255,0.75)', margin: 0, fontSize: '15px' }}>Claims intelligence overview · {new Date().toLocaleDateString('en-IE', { month: 'long', year: 'numeric' })}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>Last updated</div>
            <div style={{ color: 'white', fontWeight: 600 }}>{new Date().toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#9CA3AF' }}>Loading analytics...</div>
        ) : (
          <>
            {/* Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
              {statCards.map(card => (
                <div key={card.label} style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ fontSize: '24px', marginBottom: '12px' }}>{card.icon}</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: card.color, marginBottom: '4px' }}>{card.value}</div>
                  <div style={{ fontSize: '13px', color: '#6B7280' }}>{card.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
              {/* Claims by Type */}
              <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <h3 style={{ margin: '0 0 20px', color: C.dark, fontSize: '16px', fontWeight: 700 }}>Claims by Type</h3>
                {Object.entries(byType).map(([type, count]: any) => {
                  const pct = stats.total ? Math.round((count / stats.total) * 100) : 0
                  return (
                    <div key={type} style={{ marginBottom: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>{type}</span>
                        <span style={{ fontSize: '13px', color: '#6B7280' }}>{count} ({pct}%)</span>
                      </div>
                      <div style={{ height: '8px', background: '#F3F4F6', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: typeColors[type] || C.teal, borderRadius: '4px', transition: 'width 0.5s' }} />
                      </div>
                    </div>
                  )
                })}
                {Object.keys(byType).length === 0 && <p style={{ color: '#9CA3AF', textAlign: 'center' }}>No data yet</p>}
              </div>

              {/* Status Breakdown */}
              <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <h3 style={{ margin: '0 0 20px', color: C.dark, fontSize: '16px', fontWeight: 700 }}>Status Breakdown</h3>
                {[
                  { label: 'Approved / Paid', count: stats.approved, color: '#059669' },
                  { label: 'Pending Review', count: stats.pending, color: C.gold },
                  { label: 'Rejected', count: stats.rejected, color: C.rose },
                ].map(row => {
                  const pct = stats.total ? Math.round((row.count / stats.total) * 100) : 0
                  return (
                    <div key={row.label} style={{ marginBottom: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>{row.label}</span>
                        <span style={{ fontSize: '13px', color: '#6B7280' }}>{row.count} ({pct}%)</span>
                      </div>
                      <div style={{ height: '8px', background: '#F3F4F6', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: row.color, borderRadius: '4px' }} />
                      </div>
                    </div>
                  )
                })}

                {/* AI Efficiency */}
                <div style={{ marginTop: '24px', padding: '16px', background: C.warm, borderRadius: '12px' }}>
                  <div style={{ fontSize: '12px', color: C.teal, fontWeight: 700, marginBottom: '8px' }}>⚡ AI EFFICIENCY</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: C.dark }}>{stats.total ? Math.round((stats.autoApproved / stats.total) * 100) : 0}%</div>
                      <div style={{ fontSize: '11px', color: '#6B7280' }}>Auto-approved</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: C.rose }}>{stats.fraudFlagged}</div>
                      <div style={{ fontSize: '11px', color: '#6B7280' }}>Fraud flagged</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: C.gold }}>1.8d</div>
                      <div style={{ fontSize: '11px', color: '#6B7280' }}>Avg processing</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Claims Table */}
            <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <h3 style={{ margin: '0 0 20px', color: C.dark, fontSize: '16px', fontWeight: 700 }}>Recent Claims</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #F3F4F6' }}>
                    {['Claim ID', 'Type', 'Amount', 'Date', 'Status', 'Fraud Score'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: '11px', color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {claims.slice(0, 10).map(claim => {
                    const statusColor: Record<string, string> = { Submitted: '#3B82F6', 'In Review': C.gold, Approved: '#059669', Paid: C.teal, Rejected: C.rose, 'Info Required': '#F97316' }
                    const fraudPct = Math.round((claim.fraud_score || 0) * 100)
                    return (
                      <tr key={claim.id} style={{ borderBottom: '1px solid #F9FAFB' }}>
                        <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: '13px', color: C.teal }}>{claim.claim_id}</td>
                        <td style={{ padding: '12px', fontSize: '13px', color: '#374151' }}>{claim.claim_type}</td>
                        <td style={{ padding: '12px', fontSize: '13px', fontWeight: 600, color: C.dark }}>€{claim.total_amount?.toFixed(2)}</td>
                        <td style={{ padding: '12px', fontSize: '13px', color: '#6B7280' }}>{new Date(claim.service_date).toLocaleDateString('en-IE')}</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ background: statusColor[claim.status] + '20', color: statusColor[claim.status], padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>{claim.status}</span>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ color: fraudPct > 50 ? C.rose : fraudPct > 25 ? C.gold : '#059669', fontWeight: 700, fontSize: '13px' }}>{fraudPct}%</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {claims.length === 0 && <p style={{ textAlign: 'center', color: '#9CA3AF', padding: '24px 0' }}>No claims data yet</p>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
