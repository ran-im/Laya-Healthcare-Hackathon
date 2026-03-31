'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { deriveEffectiveClaimStatus } from '@/lib/claim-status'
import type { HybridDecisionResult } from '@/types'
import {
  FileText, Plus, Search, Filter, ChevronRight,
  Clock, CheckCircle2, XCircle, AlertCircle,
  CreditCard, Activity, Shield, LogOut,
  ChevronDown, Calendar, ArrowUpDown
} from 'lucide-react'

interface Claim {
  id: string
  claim_id: string
  claim_type: string
  status: string
  provider_name: string
  service_type: string
  total_amount: number
  approved_amount: number | null
  currency: string
  service_date: string
  created_at: string
  description: string | null
  ai_decision?: string
  ai_decision_reason?: string
  decision_result?: HybridDecisionResult
  fraud_score?: number | null
  complexity_score?: number | null
  anomaly_score?: number | null
}

interface Profile {
  full_name: string
  member_id: string
  plan_name: string
}

const STATUS_OPTIONS = ['All', 'Submitted', 'In Review', 'Approved', 'Paid', 'Rejected', 'Info Required']
const TYPE_OPTIONS   = ['All', 'Outpatient', 'Inpatient', 'Emergency', 'Pharmacy', 'Dental', 'Optical']

function statusStyle(status: string) {
  const map: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
    'Submitted':     { color: '#2563EB', bg: '#EFF6FF', icon: <Clock size={12} /> },
    'In Review':     { color: '#D97706', bg: '#FFFBEB', icon: <Activity size={12} /> },
    'Approved':      { color: '#059669', bg: '#ECFDF5', icon: <CheckCircle2 size={12} /> },
    'Paid':          { color: '#00A89D', bg: '#F2FAF9', icon: <CreditCard size={12} /> },
    'Rejected':      { color: '#DC2626', bg: '#FEF2F2', icon: <XCircle size={12} /> },
    'Info Required': { color: '#EA580C', bg: '#FFF7ED', icon: <AlertCircle size={12} /> },
  }
  return map[status] || { color: '#6B7280', bg: '#F9FAFB', icon: <Clock size={12} /> }
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(amount)
}

export default function ClaimsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile]   = useState<Profile | null>(null)
  const [claims, setClaims]     = useState<Claim[]>([])
  const [filtered, setFiltered] = useState<Claim[]>([])
  const [loading, setLoading]   = useState(true)
  const [userId, setUserId]     = useState<string | null>(null)

  // Filters
  const [search, setSearch]         = useState('')
  const [statusFilter, setStatus]   = useState('All')
  const [typeFilter, setType]       = useState('All')
  const [sortBy, setSortBy]         = useState<'date' | 'amount'>('date')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    let result = [...claims].map((claim) => ({
      ...claim,
      status: deriveEffectiveClaimStatus(claim),
    }))
    if (search)                result = result.filter(c =>
      c.claim_id.toLowerCase().includes(search.toLowerCase()) ||
      c.provider_name.toLowerCase().includes(search.toLowerCase()) ||
      c.claim_type.toLowerCase().includes(search.toLowerCase())
    )
    if (statusFilter !== 'All') result = result.filter(c => c.status === statusFilter)
    if (typeFilter   !== 'All') result = result.filter(c => c.claim_type === typeFilter)
    result.sort((a, b) => sortBy === 'date'
      ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      : b.total_amount - a.total_amount
    )
    setFiltered(result)
  }, [claims, search, statusFilter, typeFilter, sortBy])

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
        () => loadData()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => loadData()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  async function loadData() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      const [profileRes, claimsRes] = await Promise.all([
        supabase.from('profiles').select('full_name,member_id,plan_name').eq('id', user.id).single(),
        supabase.from('claims').select('*').eq('member_id', user.id).order('created_at', { ascending: false }),
      ])
      if (profileRes.data) setProfile(profileRes.data)
      if (claimsRes.data)  setClaims(claimsRes.data)
    } finally { setLoading(false) }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Stats
  const stats = {
    total:    claims.length,
    pending:  claims.filter(c => ['Submitted','In Review','Info Required'].includes(deriveEffectiveClaimStatus(c))).length,
    approved: claims.filter(c => ['Approved','Paid'].includes(deriveEffectiveClaimStatus(c))).length,
    paid:     claims.filter(c => deriveEffectiveClaimStatus(c) === 'Paid').reduce((s,c) => s + c.total_amount, 0),
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#F8FAFB' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:'40px', height:'40px', border:'3px solid #E5E7EB', borderTopColor:'#00A89D',
                      borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 12px' }} />
        <p style={{ color:'#9CA3AF', fontSize:'14px' }}>Loading your claims...</p>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#F8FAFB', fontFamily:'Inter, system-ui, sans-serif' }}>

      {/* ── Page Header ── */}
      <div style={{
        background:'linear-gradient(135deg,#003C3A 0%,#005C58 60%,#00A89D 100%)',
        padding:'32px 24px',
      }}>
        <div style={{ maxWidth:'1200px', margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'16px' }}>
            <div>
              <h1 style={{ color:'white', fontSize:'24px', fontWeight:700, margin:'0 0 4px 0' }}>My Claims</h1>
              <p style={{ color:'rgba(255,255,255,0.65)', fontSize:'14px', margin:0 }}>
                {claims.length} total claims · Member ID:{' '}
                <span style={{ fontFamily:'monospace', color:'rgba(255,255,255,0.9)' }}>
                  {profile?.member_id || '—'}
                </span>
              </p>
            </div>
            <button onClick={() => router.push('/submit-claim')} style={{
              display:'flex', alignItems:'center', gap:'8px', padding:'10px 20px',
              background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)',
              borderRadius:'12px', color:'white', fontSize:'14px', fontWeight:600,
              cursor:'pointer', transition:'all 0.2s',
            }}>
              <Plus size={16} /> Submit New Claim
            </button>
          </div>

          {/* Mini stats */}
          <div style={{ display:'flex', gap:'24px', marginTop:'24px', flexWrap:'wrap' }}>
            {[
              { label:'Total', value: stats.total, color:'rgba(255,255,255,0.9)' },
              { label:'Pending', value: stats.pending, color:'#FCD34D' },
              { label:'Approved', value: stats.approved, color:'#6EE7B7' },
              { label:'Total Paid', value: formatCurrency(stats.paid), color:'#00D4C8' },
            ].map(s => (
              <div key={s.label} style={{ textAlign:'center' }}>
                <div style={{ color: s.color, fontWeight:700, fontSize:'22px' }}>{s.value}</div>
                <div style={{ color:'rgba(255,255,255,0.5)', fontSize:'11px', marginTop:'2px' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div style={{ maxWidth:'1200px', margin:'0 auto', padding:'24px' }}>

        {/* Search + Filter Bar */}
        <div style={{
          background:'white', borderRadius:'16px', padding:'16px 20px',
          border:'1px solid #F3F4F6', boxShadow:'0 1px 3px rgba(0,0,0,0.05)',
          marginBottom:'20px', display:'flex', gap:'12px', alignItems:'center', flexWrap:'wrap',
        }}>
          {/* Search */}
          <div style={{ position:'relative', flex:'1', minWidth:'200px' }}>
            <Search size={15} style={{ position:'absolute', left:'12px', top:'50%',
                                        transform:'translateY(-50%)', color:'#9CA3AF' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by claim ID, provider or type..."
              style={{
                width:'100%', padding:'9px 12px 9px 36px', borderRadius:'10px',
                border:'1.5px solid #E5E7EB', fontSize:'13px', color:'#374151',
                outline:'none', boxSizing:'border-box', background:'#F9FAFB',
              }}
              onFocus={e => e.target.style.borderColor = '#00A89D'}
              onBlur={e  => e.target.style.borderColor = '#E5E7EB'}
            />
          </div>

          {/* Status filter */}
          <div style={{ position:'relative' }}>
            <select value={statusFilter} onChange={e => setStatus(e.target.value)}
              style={{
                padding:'9px 32px 9px 12px', borderRadius:'10px',
                border:'1.5px solid #E5E7EB', fontSize:'13px', color:'#374151',
                background:'#F9FAFB', outline:'none', cursor:'pointer', appearance:'none',
              }}>
              {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
            </select>
            <ChevronDown size={14} style={{ position:'absolute', right:'10px', top:'50%',
                                            transform:'translateY(-50%)', color:'#9CA3AF', pointerEvents:'none' }} />
          </div>

          {/* Type filter */}
          <div style={{ position:'relative' }}>
            <select value={typeFilter} onChange={e => setType(e.target.value)}
              style={{
                padding:'9px 32px 9px 12px', borderRadius:'10px',
                border:'1.5px solid #E5E7EB', fontSize:'13px', color:'#374151',
                background:'#F9FAFB', outline:'none', cursor:'pointer', appearance:'none',
              }}>
              {TYPE_OPTIONS.map(t => <option key={t}>{t}</option>)}
            </select>
            <ChevronDown size={14} style={{ position:'absolute', right:'10px', top:'50%',
                                            transform:'translateY(-50%)', color:'#9CA3AF', pointerEvents:'none' }} />
          </div>

          {/* Sort */}
          <button onClick={() => setSortBy(s => s === 'date' ? 'amount' : 'date')}
            style={{
              display:'flex', alignItems:'center', gap:'6px', padding:'9px 14px',
              borderRadius:'10px', border:'1.5px solid #E5E7EB', background:'#F9FAFB',
              fontSize:'13px', color:'#6B7280', cursor:'pointer', whiteSpace:'nowrap',
            }}>
            <ArrowUpDown size={13} />
            {sortBy === 'date' ? 'Sort: Date' : 'Sort: Amount'}
          </button>
        </div>

        {/* Claims Table */}
        <div style={{
          background:'white', borderRadius:'16px',
          border:'1px solid #F3F4F6', boxShadow:'0 1px 3px rgba(0,0,0,0.05)',
          overflow:'hidden',
        }}>

          {/* Table header */}
          <div style={{
            display:'grid',
            gridTemplateColumns:'1.5fr 1fr 1fr 1fr 1fr 80px',
            padding:'12px 20px',
            background:'#F9FAFB', borderBottom:'1px solid #F3F4F6',
            gap:'12px',
          }}>
            {['Provider / Claim ID','Type','Date','Amount','Status',''].map(h => (
              <div key={h} style={{ fontSize:'11px', fontWeight:600, color:'#9CA3AF',
                                    textTransform:'uppercase', letterSpacing:'0.5px' }}>
                {h}
              </div>
            ))}
          </div>

          {/* Rows */}
          {filtered.length === 0 ? (
            <div style={{ padding:'60px 20px', textAlign:'center' }}>
              <div style={{ width:'56px', height:'56px', borderRadius:'16px', background:'#F2FAF9',
                            display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                <FileText size={24} color="#00A89D" />
              </div>
              <h3 style={{ fontSize:'16px', fontWeight:600, color:'#111827', margin:'0 0 8px 0' }}>
                {claims.length === 0 ? 'No claims yet' : 'No claims match your filters'}
              </h3>
              <p style={{ color:'#6B7280', fontSize:'14px', margin:'0 0 20px 0' }}>
                {claims.length === 0
                  ? 'Submit your first claim to get started'
                  : 'Try adjusting your search or filters'}
              </p>
              {claims.length === 0 && (
                <button onClick={() => router.push('/submit-claim')} style={{
                  display:'inline-flex', alignItems:'center', gap:'8px',
                  padding:'10px 20px', borderRadius:'12px', border:'none',
                  background:'linear-gradient(135deg,#003C3A,#00A89D)',
                  color:'white', fontSize:'14px', fontWeight:600, cursor:'pointer',
                }}>
                  <Plus size={15} /> Submit a claim
                </button>
              )}
            </div>
          ) : (
            filtered.map((claim, i) => {
              const sc = statusStyle(claim.status)
              const memberSummary =
                claim.decision_result?.final_display_summary ??
                claim.decision_result?.member_decision_summary ??
                claim.ai_decision_reason ??
                claim.decision_result?.next_action_text ??
                null
              return (
                <div key={claim.id}
                  onClick={() => router.push(`/claims/${claim.id}`)}
                  style={{
                    display:'grid', gridTemplateColumns:'1.5fr 1fr 1fr 1fr 1fr 80px',
                    padding:'16px 20px', gap:'12px', alignItems:'center',
                    borderBottom: i < filtered.length - 1 ? '1px solid #F9FAFB' : 'none',
                    cursor:'pointer', transition:'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FAFAFA')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                >
                  {/* Provider */}
                  <div>
                    <div style={{ fontWeight:600, fontSize:'14px', color:'#111827',
                                  marginBottom:'3px', whiteSpace:'nowrap',
                                  overflow:'hidden', textOverflow:'ellipsis' }}>
                      {claim.provider_name}
                    </div>
                    <div style={{ fontSize:'11px', color:'#9CA3AF', fontFamily:'monospace' }}>
                      {claim.claim_id}
                    </div>
                    {memberSummary && (
                      <div style={{ fontSize:'11px', color:'#6B7280', marginTop:'4px' }}>
                        {memberSummary}
                      </div>
                    )}
                  </div>

                  {/* Type */}
                  <div>
                    <span style={{
                      fontSize:'12px', fontWeight:500, padding:'3px 10px',
                      borderRadius:'999px', background:'#F2FAF9', color:'#00A89D',
                    }}>
                      {claim.claim_type}
                    </span>
                  </div>

                  {/* Date */}
                  <div style={{ display:'flex', alignItems:'center', gap:'6px',
                                fontSize:'13px', color:'#6B7280' }}>
                    <Calendar size={13} />
                    {formatDate(claim.service_date)}
                  </div>

                  {/* Amount */}
                  <div>
                    <div style={{ fontWeight:700, fontSize:'14px', color:'#111827' }}>
                      {formatCurrency(claim.total_amount)}
                    </div>
                    {claim.approved_amount && claim.approved_amount !== claim.total_amount && (
                      <div style={{ fontSize:'11px', color:'#059669' }}>
                        Approved: {formatCurrency(claim.approved_amount)}
                      </div>
                    )}
                  </div>

                  {/* Status */}
                  <div>
                    <span style={{
                      display:'inline-flex', alignItems:'center', gap:'5px',
                      fontSize:'12px', fontWeight:500, padding:'4px 10px',
                      borderRadius:'999px', background: sc.bg, color: sc.color,
                    }}>
                      {sc.icon} {claim.status}
                    </span>
                  </div>

                  {/* Arrow */}
                  <div style={{ display:'flex', justifyContent:'flex-end' }}>
                    <ChevronRight size={16} color="#D1D5DB" />
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Result count */}
        {filtered.length > 0 && (
          <p style={{ textAlign:'center', marginTop:'16px', fontSize:'13px', color:'#9CA3AF' }}>
            Showing {filtered.length} of {claims.length} claims
          </p>
        )}
      </div>
    </div>
  )
}
