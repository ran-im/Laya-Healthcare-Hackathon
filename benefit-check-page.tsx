'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const C = { dark: '#003C3A', mid: '#005C58', teal: '#00A89D', accent: '#00D4C8', warm: '#F2FAF9', gold: '#E8A020' }

const BENEFITS = [
  { category: 'Outpatient', icon: '🏥', items: [
    { name: 'GP Visit', covered: true, limit: '€50 per visit', note: 'Up to 10 visits per year' },
    { name: 'Specialist Consultation', covered: true, limit: '€120 per visit', note: 'Referral required' },
    { name: 'Physiotherapy', covered: true, limit: '€50 per session', note: 'Up to 15 sessions per year' },
    { name: 'Mental Health Counselling', covered: true, limit: '€80 per session', note: 'Up to 10 sessions per year' },
  ]},
  { category: 'Inpatient', icon: '🛏️', items: [
    { name: 'Semi-Private Room', covered: true, limit: 'Full cover', note: 'Approved hospitals only' },
    { name: 'Private Room', covered: true, limit: '€150/night supplement', note: 'Subject to availability' },
    { name: 'Day Case Surgery', covered: true, limit: 'Full cover', note: 'Pre-authorisation required' },
    { name: 'ICU / High Dependency', covered: true, limit: 'Full cover', note: 'Emergency admission' },
  ]},
  { category: 'Pharmacy', icon: '💊', items: [
    { name: 'Prescription Drugs', covered: true, limit: '€20 per prescription', note: 'Generic substitution applies' },
    { name: 'Over-the-Counter', covered: false, limit: 'Not covered', note: '' },
    { name: 'Chronic Illness Medication', covered: true, limit: '€30 per prescription', note: 'Long-term illness scheme' },
  ]},
  { category: 'Dental', icon: '🦷', items: [
    { name: 'Routine Check-up', covered: true, limit: '€50 per visit', note: 'Twice per year' },
    { name: 'X-Rays', covered: true, limit: '€30 per visit', note: 'Included with check-up' },
    { name: 'Fillings', covered: true, limit: '€80 per filling', note: 'Amalgam or composite' },
    { name: 'Orthodontics', covered: false, limit: 'Not covered', note: 'Cosmetic treatment' },
  ]},
  { category: 'Optical', icon: '👓', items: [
    { name: 'Eye Examination', covered: true, limit: '€50', note: 'Once every 2 years' },
    { name: 'Prescription Glasses', covered: true, limit: '€100 allowance', note: 'Frames and lenses' },
    { name: 'Contact Lenses', covered: true, limit: '€100 allowance', note: 'Annual allowance' },
    { name: 'Laser Eye Surgery', covered: false, limit: 'Not covered', note: 'Cosmetic procedure' },
  ]},
  { category: 'Emergency', icon: '🚨', items: [
    { name: 'A&E Attendance', covered: true, limit: '€100 excess applies', note: 'Any registered hospital' },
    { name: 'Ambulance', covered: true, limit: 'Full cover', note: 'Emergency only' },
    { name: 'Overseas Emergency', covered: true, limit: 'Up to €100,000', note: 'EU/EEA countries' },
  ]},
]

export default function BenefitCheckPage() {
  const router = useRouter()
  const supabase = createClient()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [aiResult, setAiResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const filtered = BENEFITS.map(cat => ({
    ...cat,
    items: cat.items.filter(i =>
      !query || i.name.toLowerCase().includes(query.toLowerCase()) ||
      cat.category.toLowerCase().includes(query.toLowerCase())
    )
  })).filter(cat => cat.items.length > 0)

  async function checkWithAI() {
    if (!query.trim()) return
    setLoading(true)
    setAiResult(null)
    try {
      const res = await fetch('/api/ai/benefit-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      const data = await res.json()
      setAiResult(data.answer || 'Unable to get AI response.')
    } catch {
      setAiResult('Unable to check at this time. Please call 1890 700 890.')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFA' }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${C.dark} 0%, ${C.mid} 50%, ${C.teal} 100%)`, padding: '40px 32px 48px' }}>
        <button onClick={() => router.back()} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', color: 'white', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', marginBottom: '24px', fontSize: '14px' }}>
          ← Dashboard
        </button>
        <h1 style={{ color: 'white', fontSize: '28px', fontWeight: 700, margin: '0 0 8px' }}>Benefit Check</h1>
        <p style={{ color: 'rgba(255,255,255,0.75)', margin: '0 0 28px', fontSize: '15px' }}>Check what's covered under your Premium Health plan</p>

        {/* Search */}
        <div style={{ position: 'relative', maxWidth: '600px' }}>
          <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '18px' }}>🔍</span>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search treatments, e.g. 'physiotherapy', 'dental'..."
            style={{ width: '100%', padding: '14px 120px 14px 48px', borderRadius: '12px', border: 'none', fontSize: '15px', background: 'white', boxSizing: 'border-box', outline: 'none' }}
          />
          <button
            onClick={checkWithAI}
            disabled={loading || !query.trim()}
            style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: loading ? '#999' : C.teal, color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600 }}
          >
            {loading ? '...' : '✨ Ask AI'}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>
        {/* AI Result */}
        {aiResult && (
          <div style={{ background: 'white', border: `2px solid ${C.teal}`, borderRadius: '16px', padding: '24px', marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <span style={{ fontSize: '20px' }}>🤖</span>
              <span style={{ fontWeight: 700, color: C.dark, fontSize: '15px' }}>Laya AI · Benefit Check</span>
            </div>
            <p style={{ color: '#374151', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{aiResult}</p>
          </div>
        )}

        {/* Plan Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
          {[
            { icon: '🏥', label: 'Plan', value: 'Premium Health' },
            { icon: '📅', label: 'Renewal', value: '1 Jan 2027' },
            { icon: '📞', label: 'Helpline', value: '1890 700 890' },
          ].map(card => (
            <div key={card.label} style={{ background: 'white', borderRadius: '12px', padding: '20px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>{card.icon}</div>
              <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>{card.label}</div>
              <div style={{ fontWeight: 700, color: C.dark, fontSize: '14px' }}>{card.value}</div>
            </div>
          ))}
        </div>

        {/* Benefits Grid */}
        {filtered.map(cat => (
          <div key={cat.category} style={{ background: 'white', borderRadius: '16px', marginBottom: '16px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div
              onClick={() => setSelected(selected === cat.category ? null : cat.category)}
              style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', borderBottom: selected === cat.category ? '1px solid #F3F4F6' : 'none' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '22px' }}>{cat.icon}</span>
                <span style={{ fontWeight: 700, color: C.dark, fontSize: '16px' }}>{cat.category}</span>
                <span style={{ background: C.warm, color: C.teal, fontSize: '12px', fontWeight: 600, padding: '2px 10px', borderRadius: '20px' }}>{cat.items.length} benefits</span>
              </div>
              <span style={{ color: '#9CA3AF', fontSize: '18px' }}>{selected === cat.category ? '▲' : '▼'}</span>
            </div>

            {selected === cat.category && (
              <div>
                {cat.items.map((item, i) => (
                  <div key={i} style={{ padding: '16px 24px', borderBottom: i < cat.items.length - 1 ? '1px solid #F9FAFB' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '16px' }}>{item.covered ? '✅' : '❌'}</span>
                      <div>
                        <div style={{ fontWeight: 600, color: '#1F2937', fontSize: '14px' }}>{item.name}</div>
                        {item.note && <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>{item.note}</div>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{
                        background: item.covered ? '#ECFDF5' : '#FEF2F2',
                        color: item.covered ? '#059669' : '#DC2626',
                        padding: '4px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 600
                      }}>{item.limit}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {filtered.length === 0 && query && (
          <div style={{ textAlign: 'center', padding: '48px', background: 'white', borderRadius: '16px' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔍</div>
            <p style={{ color: '#6B7280' }}>No benefits found for "{query}"</p>
            <button onClick={checkWithAI} style={{ background: C.teal, color: 'white', border: 'none', padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, marginTop: '8px' }}>
              Ask AI about this treatment
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
