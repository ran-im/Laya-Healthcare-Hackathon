'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Shield, LogOut, Clock, CheckCircle2, XCircle,
  AlertCircle, Activity, ChevronRight, Search,
  TrendingUp, Users, FileText, Zap, Brain,
  Filter, RefreshCw, Eye, ChevronDown
} from 'lucide-react'

interface Claim {
  id: string; claim_id: string; claim_type: string; status: string
  routing: string; priority: string
  provider_name: string; service_type: string
  total_amount: number; currency: string; service_date: string
  created_at: string; submitted_at: string
  fraud_score: number | null; complexity_score: number | null
  ai_summary: string | null
  member_id: string
  profiles?: { full_name: string; member_id: string }
}

interface Stats {
  total: number; pending: number; approved: number
  rejected: number; avgProcessTime: string; autoApproveRate: number
}

function priorityStyle(p: string) {
  const map: Record<string, { color: string; bg: string }> = {
    'urgent':  { color: '#DC2626', bg: '#FEF2F2' },
    'high':    { color: '#D97706', bg: '#FFFBEB' },
    'normal':  { color: '#2563EB', bg: '#EFF6FF' },
    'low':     { color: '#059669', bg: '#ECFDF5' },
  }
  return map[p] || { color: '#6B7280', bg: '#F9FAFB' }
}

function routingStyle(r: string) {
  const map: Record<string, { color: string; bg: string; label: string }> = {
    'auto_approve': { color: '#059669', bg: '#ECFDF5', label: '✓ Auto-Approve' },
    'manual':       { color: '#D97706', bg: '#FFFBEB', label: '👤 Manual Review' },
    'fraud':        { color: '#DC2626', bg: '#FEF2F2', label: '🚨 Fraud Review' },
    'pending':      { color: '#6B7280', bg: '#F3F4F6', label: '⏳ Pending' },
  }
  return map[r] || { color: '#6B7280', bg: '#F9FAFB', label: r }
}

function scoreColor(score: number) {
  if (score >= 75) return '#DC2626'
  if (score >= 40) return '#D97706'
  return '#059669'
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(n)
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })
}
function timeAgo(d: string) {
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function AssessorDashboardPage() {
  const router = useRouter()
  const supabase = createClient()

  const [claims, setClaims]         = useState<Claim[]>([])
  const [filtered, setFiltered]     = useState<Claim[]>([])
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [assessorName, setAssessorName] = useState('')

  // Filters
  const [search, setSearch]       = useState('')
  const [routingF, setRoutingF]   = useState('all')
  const [priorityF, setPriorityF] = useState('all')
  const [activeTab, setActiveTab] = useState<'queue'|'stats'>('queue')

  const stats: Stats = {
    total:           claims.length,
    pending:         claims.filter(c => ['Submitted','In Review'].includes(c.status)).length,
    approved:        claims.filter(c => ['Approved','Paid'].includes(c.status)).length,
    rejected:        claims.filter(c => c.status === 'Rejected').length,
    avgProcessTime:  '1.8 days',
    autoApproveRate: claims.length
      ? Math.round(claims.filter(c => c.routing === 'auto_approve').length / claims.length * 100)
      : 0,
  }

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    let r = [...claims]
    if (search)          r = r.filter(c =>
      c.claim_id.toLowerCase().includes(search.toLowerCase()) ||
      c.provider_name.toLowerCase().includes(search.toLowerCase()) ||
      c.profiles?.full_name?.toLowerCase().includes(search.toLowerCase()) || false
    )
    if (routingF  !== 'all') r = r.filter(c => c.routing  === routingF)
    if (priorityF !== 'all') r = r.filter(c => c.priority === priorityF)
    setFiltered(r)
  }, [claims, search, routingF, priorityF])

  async function loadData() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles').select('full_name,role').eq('id', user.id).single()
      if (profile?.role === 'member') { router.push('/dashboard'); return }
      setAssessorName(profile?.full_name || 'Assessor')

      const { data } = await supabase
        .from('claims')
        .select(`
          *,
          profiles!claims_member_id_fkey(full_name, member_id)
        `)
        .order('created_at', { ascending: false })
        .limit(100)

      if (data) setClaims(data)
    } finally { setLoading(false) }
  }

  async function refresh() {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  async function quickAction(claimId: string, action: 'approve' | 'reject' | 'review') {
    const statusMap = { approve: 'Approved', reject: 'Rejected', review: 'In Review' }
    await supabase.from('claims')
      .update({ status: statusMap[action], updated_at: new Date().toISOString() })
      .eq('id', claimId)
    loadData()
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
                  background:'#F8FAFB', fontFamily:'Inter,system-ui,sans-serif' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:'40px', height:'40px', border:'3px solid #E5E7EB',
                      borderTopColor:'#00A89D', borderRadius:'50%',
                      animation:'spin 0.8s linear infinite', margin:'0 auto 12px' }} />
        <p style={{ color:'#9CA3AF', fontSize:'14px' }}>Loading assessor dashboard...</p>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#F8FAFB', fontFamily:'Inter,system-ui,sans-serif' }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} *{box-sizing:border-box}`}</style>

      {/* NAVBAR */}
      <nav style={{ background:'white', borderBottom:'1px solid #F3F4F6', position:'sticky',
                    top:0, zIndex:100, boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ maxWidth:'1400px', margin:'0 auto', padding:'0 24px',
                      display:'flex', alignItems:'center', height:'64px', gap:'16px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <div style={{ width:'36px', height:'36px', borderRadius:'10px', flexShrink:0,
                          background:'linear-gradient(135deg,#003C3A,#00A89D)',
                          display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Shield size={16} color="white" />
            </div>
            <div>
              <div style={{ fontWeight:700, fontSize:'14px', color:'#111827', lineHeight:1 }}>laya</div>
              <div style={{ color:'#9CA3AF', fontSize:'9px', letterSpacing:'2px', textTransform:'uppercase' }}>assessor portal</div>
            </div>
          </div>

          {/* Role badge */}
          <div style={{ padding:'4px 12px', borderRadius:'999px', fontSize:'11px', fontWeight:700,
                        background:'rgba(0,168,157,0.12)', color:'#00A89D', letterSpacing:'0.5px' }}>
            ASSESSOR
          </div>

          <div style={{ flex:1 }} />

          {/* Live indicator */}
          <div style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'12px', color:'#6B7280' }}>
            <div style={{ width:'7px', height:'7px', borderRadius:'50%', background:'#22C55E',
                          animation:'pulse 2s infinite' }} />
            Live queue
          </div>

          <button onClick={refresh} style={{
            display:'flex', alignItems:'center', gap:'6px', padding:'7px 14px',
            borderRadius:'10px', border:'1px solid #E5E7EB', background:'#F9FAFB',
            fontSize:'13px', color:'#374151', cursor:'pointer', fontWeight:500,
          }}>
            <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>

          <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'6px 12px',
                        background:'#F9FAFB', border:'1px solid #E5E7EB', borderRadius:'10px' }}>
            <div style={{ width:'28px', height:'28px', borderRadius:'50%',
                          background:'linear-gradient(135deg,#003C3A,#00A89D)',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          color:'white', fontSize:'12px', fontWeight:700 }}>
              {assessorName[0] || 'A'}
            </div>
            <span style={{ fontSize:'13px', fontWeight:600, color:'#374151' }}>
              {assessorName.split(' ')[0] || 'Assessor'}
            </span>
          </div>

          <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
            style={{ padding:'8px', borderRadius:'10px', background:'none', border:'1px solid #E5E7EB',
                     cursor:'pointer', color:'#9CA3AF', display:'flex' }}>
            <LogOut size={15} />
          </button>
        </div>
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
      </nav>

      {/* HEADER BANNER */}
      <div style={{ background:'linear-gradient(135deg,#003C3A 0%,#005C58 60%,#00A89D 100%)',
                    padding:'28px 24px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', right:'-40px', top:'-40px', width:'220px', height:'220px',
                      borderRadius:'50%', background:'rgba(0,212,200,0.08)', pointerEvents:'none' }} />
        <div style={{ maxWidth:'1400px', margin:'0 auto', position:'relative' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'16px' }}>
            <div>
              <p style={{ color:'rgba(255,255,255,0.6)', fontSize:'13px', margin:'0 0 4px 0' }}>
                Welcome back, {assessorName.split(' ')[0]}
              </p>
              <h1 style={{ color:'white', fontSize:'22px', fontWeight:700, margin:'0 0 4px 0' }}>
                Claims Review Queue
              </h1>
              <p style={{ color:'rgba(255,255,255,0.55)', fontSize:'13px', margin:0 }}>
                {stats.pending} claims awaiting review · {stats.autoApproveRate}% auto-approval rate
              </p>
            </div>
            {/* Quick stats in header */}
            <div style={{ display:'flex', gap:'28px' }}>
              {[
                { label:'In Queue',      value: stats.pending,                color:'#FCD34D' },
                { label:'Auto-Approved', value: stats.autoApproveRate + '%',  color:'#6EE7B7' },
                { label:'Avg Time',      value: stats.avgProcessTime,         color:'#93C5FD' },
              ].map(s => (
                <div key={s.label} style={{ textAlign:'center' }}>
                  <div style={{ color: s.color, fontWeight:700, fontSize:'22px', lineHeight:1 }}>{s.value}</div>
                  <div style={{ color:'rgba(255,255,255,0.45)', fontSize:'11px', marginTop:'4px' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ maxWidth:'1400px', margin:'0 auto', padding:'24px' }}>

        {/* STATS CARDS */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'14px', marginBottom:'24px' }}>
          {[
            { label:'Total Claims',    value: stats.total,    icon:<FileText size={18}/>,     color:'#2563EB' },
            { label:'Pending Review',  value: stats.pending,  icon:<Clock size={18}/>,         color:'#D97706' },
            { label:'Approved',        value: stats.approved, icon:<CheckCircle2 size={18}/>,  color:'#059669' },
            { label:'Rejected',        value: stats.rejected, icon:<XCircle size={18}/>,       color:'#DC2626' },
            { label:'Auto-Approve %',  value: stats.autoApproveRate + '%', icon:<Zap size={18}/>, color:'#00A89D' },
          ].map(s => (
            <div key={s.label} style={{ background:'white', borderRadius:'14px', padding:'18px',
                                        border:'1px solid #F3F4F6', boxShadow:'0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ width:'38px', height:'38px', borderRadius:'10px', marginBottom:'12px',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            background: s.color + '15', color: s.color }}>
                {s.icon}
              </div>
              <div style={{ fontSize:'24px', fontWeight:700, color:'#111827', marginBottom:'2px' }}>{s.value}</div>
              <div style={{ fontSize:'12px', color:'#9CA3AF', fontWeight:500 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* FILTER BAR */}
        <div style={{ background:'white', borderRadius:'14px', padding:'14px 18px',
                      border:'1px solid #F3F4F6', boxShadow:'0 1px 3px rgba(0,0,0,0.05)',
                      marginBottom:'16px', display:'flex', gap:'12px', alignItems:'center', flexWrap:'wrap' }}>
          <div style={{ position:'relative', flex:1, minWidth:'200px' }}>
            <Search size={14} style={{ position:'absolute', left:'11px', top:'50%',
                                        transform:'translateY(-50%)', color:'#9CA3AF' }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by claim ID, member, or provider..."
              style={{ width:'100%', padding:'8px 12px 8px 32px', borderRadius:'10px',
                       border:'1.5px solid #E5E7EB', fontSize:'13px', color:'#374151',
                       outline:'none', background:'#F9FAFB', boxSizing:'border-box' }}
              onFocus={e => e.target.style.borderColor = '#00A89D'}
              onBlur={e  => e.target.style.borderColor = '#E5E7EB'}
            />
          </div>

          {/* Routing filter */}
          <div style={{ position:'relative' }}>
            <select value={routingF} onChange={e => setRoutingF(e.target.value)}
              style={{ padding:'8px 28px 8px 12px', borderRadius:'10px', border:'1.5px solid #E5E7EB',
                       fontSize:'13px', color:'#374151', background:'#F9FAFB',
                       outline:'none', cursor:'pointer', appearance:'none' }}>
              <option value="all">All Routing</option>
              <option value="manual">Manual Review</option>
              <option value="fraud">Fraud Review</option>
              <option value="auto_approve">Auto-Approve</option>
            </select>
            <ChevronDown size={13} style={{ position:'absolute', right:'8px', top:'50%',
                                            transform:'translateY(-50%)', color:'#9CA3AF', pointerEvents:'none' }} />
          </div>

          {/* Priority filter */}
          <div style={{ position:'relative' }}>
            <select value={priorityF} onChange={e => setPriorityF(e.target.value)}
              style={{ padding:'8px 28px 8px 12px', borderRadius:'10px', border:'1.5px solid #E5E7EB',
                       fontSize:'13px', color:'#374151', background:'#F9FAFB',
                       outline:'none', cursor:'pointer', appearance:'none' }}>
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
            <ChevronDown size={13} style={{ position:'absolute', right:'8px', top:'50%',
                                            transform:'translateY(-50%)', color:'#9CA3AF', pointerEvents:'none' }} />
          </div>

          <span style={{ fontSize:'12px', color:'#9CA3AF', marginLeft:'auto', flexShrink:0 }}>
            Showing {filtered.length} of {claims.length}
          </span>
        </div>

        {/* CLAIMS TABLE */}
        <div style={{ background:'white', borderRadius:'16px', border:'1px solid #F3F4F6',
                      boxShadow:'0 1px 3px rgba(0,0,0,0.05)', overflow:'hidden' }}>

          {/* Table header */}
          <div style={{ display:'grid',
                        gridTemplateColumns:'1.8fr 1fr 0.9fr 0.9fr 1fr 1fr 1fr 120px',
                        padding:'11px 20px', background:'#F9FAFB',
                        borderBottom:'1px solid #F3F4F6', gap:'10px' }}>
            {['Member / Claim','Type','Amount','Date','Routing','AI Scores','Status','Actions'].map(h => (
              <div key={h} style={{ fontSize:'11px', fontWeight:600, color:'#9CA3AF',
                                    textTransform:'uppercase', letterSpacing:'0.5px' }}>
                {h}
              </div>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding:'60px 20px', textAlign:'center' }}>
              <Brain size={32} color="#D1D5DB" style={{ margin:'0 auto 12px', display:'block' }} />
              <h3 style={{ fontSize:'15px', fontWeight:600, color:'#374151', margin:'0 0 6px 0' }}>
                {claims.length === 0 ? 'No claims in queue' : 'No claims match your filters'}
              </h3>
              <p style={{ fontSize:'13px', color:'#9CA3AF', margin:0 }}>
                {claims.length === 0 ? 'Claims submitted by members will appear here'
                                     : 'Try adjusting your search or filters'}
              </p>
            </div>
          ) : (
            filtered.map((claim, i) => {
              const rs  = routingStyle(claim.routing)
              const ps  = priorityStyle(claim.priority || 'normal')
              const fraudScore     = claim.fraud_score     ?? 0
              const complexScore   = claim.complexity_score ?? 0
              const isFraudRisk    = fraudScore >= 60
              const isHighComplex  = complexScore >= 70

              return (
                <div key={claim.id}
                  style={{
                    display:'grid', gridTemplateColumns:'1.8fr 1fr 0.9fr 0.9fr 1fr 1fr 1fr 120px',
                    padding:'14px 20px', gap:'10px', alignItems:'center',
                    borderBottom: i < filtered.length - 1 ? '1px solid #F9FAFB' : 'none',
                    background: isFraudRisk ? '#FFF8F8' : 'white',
                    transition:'background 0.15s',
                    borderLeft: isFraudRisk ? '3px solid #DC2626' : '3px solid transparent',
                  }}
                  onMouseEnter={e => !isFraudRisk && (e.currentTarget.style.background = '#FAFAFA')}
                  onMouseLeave={e => !isFraudRisk && (e.currentTarget.style.background = 'white')}
                >
                  {/* Member / Claim */}
                  <div>
                    <div style={{ fontWeight:600, fontSize:'13px', color:'#111827', marginBottom:'2px' }}>
                      {(claim.profiles as any)?.full_name || 'Unknown Member'}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                      <span style={{ fontSize:'11px', fontFamily:'monospace', color:'#9CA3AF' }}>
                        {claim.claim_id}
                      </span>
                      <span style={{ fontSize:'10px', padding:'1px 6px', borderRadius:'999px',
                                     ...ps, fontWeight:600 }}>
                        {(claim.priority || 'normal').toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Type */}
                  <div>
                    <div style={{ fontSize:'13px', fontWeight:500, color:'#374151' }}>{claim.claim_type}</div>
                    <div style={{ fontSize:'11px', color:'#9CA3AF' }}>{claim.service_type}</div>
                  </div>

                  {/* Amount */}
                  <div style={{ fontWeight:700, fontSize:'13px', color:'#111827' }}>
                    {fmt(claim.total_amount)}
                  </div>

                  {/* Date */}
                  <div style={{ fontSize:'12px', color:'#6B7280' }}>
                    <div>{formatDate(claim.service_date)}</div>
                    <div style={{ color:'#9CA3AF', fontSize:'11px' }}>{timeAgo(claim.submitted_at)}</div>
                  </div>

                  {/* Routing */}
                  <div>
                    <span style={{ fontSize:'11px', fontWeight:600, padding:'3px 8px',
                                   borderRadius:'999px', ...rs }}>
                      {rs.label}
                    </span>
                  </div>

                  {/* AI Scores */}
                  <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                      <span style={{ fontSize:'10px', color:'#9CA3AF', width:'46px' }}>Fraud</span>
                      <div style={{ flex:1, height:'5px', borderRadius:'999px', background:'#F3F4F6', overflow:'hidden' }}>
                        <div style={{ height:'100%', borderRadius:'999px', width: fraudScore + '%',
                                      background: scoreColor(fraudScore), transition:'width 0.3s' }} />
                      </div>
                      <span style={{ fontSize:'10px', fontWeight:700, color: scoreColor(fraudScore), width:'28px' }}>
                        {fraudScore}%
                      </span>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                      <span style={{ fontSize:'10px', color:'#9CA3AF', width:'46px' }}>Complex</span>
                      <div style={{ flex:1, height:'5px', borderRadius:'999px', background:'#F3F4F6', overflow:'hidden' }}>
                        <div style={{ height:'100%', borderRadius:'999px', width: complexScore + '%',
                                      background: scoreColor(complexScore), transition:'width 0.3s' }} />
                      </div>
                      <span style={{ fontSize:'10px', fontWeight:700, color: scoreColor(complexScore), width:'28px' }}>
                        {complexScore}%
                      </span>
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <span style={{ fontSize:'11px', fontWeight:600, padding:'3px 8px', borderRadius:'999px',
                                   background: claim.status === 'Submitted' ? '#EFF6FF' :
                                               claim.status === 'In Review' ? '#FFFBEB' :
                                               claim.status === 'Approved'  ? '#ECFDF5' :
                                               claim.status === 'Paid'      ? '#F2FAF9' :
                                               claim.status === 'Rejected'  ? '#FEF2F2' : '#F3F4F6',
                                   color:     claim.status === 'Submitted' ? '#2563EB' :
                                               claim.status === 'In Review' ? '#D97706' :
                                               claim.status === 'Approved'  ? '#059669' :
                                               claim.status === 'Paid'      ? '#00A89D' :
                                               claim.status === 'Rejected'  ? '#DC2626' : '#6B7280',
                    }}>
                      {claim.status}
                    </span>
                  </div>

                  {/* Actions */}
                  <div style={{ display:'flex', gap:'4px' }}>
                    <button
                      onClick={() => router.push(`/review/${claim.id}`)}
                      title="Full AI Review"
                      style={{ padding:'5px 8px', borderRadius:'8px', border:'none', cursor:'pointer',
                               background:'#003C3A', color:'white', fontSize:'11px', fontWeight:600,
                               display:'flex', alignItems:'center', gap:'4px' }}>
                      <Brain size={12} /> Review
                    </button>
                    {['Submitted','In Review'].includes(claim.status) && (
                      <>
                        <button onClick={() => quickAction(claim.id, 'approve')}
                          title="Quick Approve"
                          style={{ padding:'5px 7px', borderRadius:'8px', border:'none', cursor:'pointer',
                                   background:'#ECFDF5', color:'#059669', fontSize:'12px' }}>
                          <CheckCircle2 size={13} />
                        </button>
                        <button onClick={() => quickAction(claim.id, 'reject')}
                          title="Quick Reject"
                          style={{ padding:'5px 7px', borderRadius:'8px', border:'none', cursor:'pointer',
                                   background:'#FEF2F2', color:'#DC2626', fontSize:'12px' }}>
                          <XCircle size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* AI INSIGHTS PANEL */}
        {claims.filter(c => (c.fraud_score ?? 0) >= 60).length > 0 && (
          <div style={{ marginTop:'20px', background:'linear-gradient(135deg,#7F1D1D,#991B1B)',
                        borderRadius:'16px', padding:'20px', color:'white' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'14px' }}>
              <AlertCircle size={18} color="#FCA5A5" />
              <h3 style={{ fontSize:'14px', fontWeight:700, margin:0, color:'white' }}>
                🚨 High-Risk Claims Requiring Attention
              </h3>
              <span style={{ fontSize:'11px', padding:'2px 8px', borderRadius:'999px',
                             background:'rgba(255,255,255,0.15)', color:'white', fontWeight:600,
                             marginLeft:'auto' }}>
                {claims.filter(c => (c.fraud_score ?? 0) >= 60).length} flagged
              </span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {claims.filter(c => (c.fraud_score ?? 0) >= 60).slice(0, 3).map(c => (
                <div key={c.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                                         padding:'10px 14px', background:'rgba(255,255,255,0.1)',
                                         borderRadius:'10px', cursor:'pointer' }}
                  onClick={() => router.push(`/review/${c.id}`)}>
                  <div>
                    <span style={{ fontSize:'13px', fontWeight:600, color:'white' }}>{c.claim_id}</span>
                    <span style={{ fontSize:'12px', color:'rgba(255,255,255,0.6)', marginLeft:'10px' }}>
                      {c.provider_name} · {fmt(c.total_amount)}
                    </span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                    <span style={{ fontSize:'12px', fontWeight:700, color:'#FCA5A5' }}>
                      Fraud Score: {c.fraud_score}%
                    </span>
                    <ChevronRight size={14} color="rgba(255,255,255,0.6)" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
