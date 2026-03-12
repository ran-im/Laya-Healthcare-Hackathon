'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  FileText, Plus, Clock, CheckCircle2, XCircle,
  AlertCircle, CreditCard, Bell, ChevronRight,
  TrendingUp, Shield, Activity, LogOut, User,
  Stethoscope, Eye
} from 'lucide-react'

interface Profile {
  id: string; full_name: string; email: string
  member_id: string; plan_name: string; role: string
}
interface Claim {
  id: string; claim_id: string; claim_type: string; status: string
  provider_name: string; total_amount: number; currency: string
  service_date: string; created_at: string
}
interface Notification {
  id: string; title: string; message: string
  type: string; is_read: boolean; created_at: string
}

function statusStyle(status: string) {
  const map: Record<string, { color: string; bg: string }> = {
    'Submitted':     { color: '#2563EB', bg: '#EFF6FF' },
    'In Review':     { color: '#D97706', bg: '#FFFBEB' },
    'Approved':      { color: '#059669', bg: '#ECFDF5' },
    'Paid':          { color: '#00A89D', bg: '#F2FAF9' },
    'Rejected':      { color: '#DC2626', bg: '#FEF2F2' },
    'Info Required': { color: '#EA580C', bg: '#FFF7ED' },
  }
  return map[status] || { color: '#6B7280', bg: '#F9FAFB' }
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmt(amount: number) {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(amount)
}

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [claims, setClaims] = useState<Claim[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [showNotif, setShowNotif] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const [p, c, n] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('claims').select('*').eq('member_id', user.id)
          .order('created_at', { ascending: false }).limit(8),
        supabase.from('notifications').select('*').eq('user_id', user.id)
          .order('created_at', { ascending: false }).limit(5),
      ])
      if (p.data) setProfile(p.data)
      if (c.data) setClaims(c.data)
      if (n.data) setNotifications(n.data)
    } finally { setLoading(false) }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const totalClaims    = claims.length
  const pendingClaims  = claims.filter(c => ['Submitted','In Review'].includes(c.status)).length
  const approvedClaims = claims.filter(c => ['Approved','Paid'].includes(c.status)).length
  const totalPaid      = claims.filter(c => c.status === 'Paid').reduce((s, c) => s + c.total_amount, 0)
  const unread         = notifications.filter(n => !n.is_read).length

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#003C3A,#00A89D)', fontFamily:'Inter,system-ui,sans-serif' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:'44px', height:'44px', border:'3px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 12px' }} />
        <p style={{ color:'rgba(255,255,255,0.7)', fontSize:'14px' }}>Loading your dashboard...</p>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#F8FAFB', fontFamily:'Inter,system-ui,sans-serif' }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} * { box-sizing: border-box; } a { text-decoration: none; }`}</style>

      <div style={{ background:'linear-gradient(135deg,#003C3A 0%,#005C58 55%,#00A89D 100%)', padding:'32px 24px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', right:'-60px', top:'-60px', width:'280px', height:'280px', borderRadius:'50%', background:'rgba(0,212,200,0.08)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', right:'80px', bottom:'-40px', width:'160px', height:'160px', borderRadius:'50%', background:'rgba(0,212,200,0.06)', pointerEvents:'none' }} />

        <div style={{ maxWidth:'1280px', margin:'0 auto', position:'relative' }}>
          <p style={{ color:'rgba(255,255,255,0.65)', fontSize:'14px', margin:'0 0 6px 0' }}>Good day</p>
          <h1 style={{ color:'white', fontSize:'28px', fontWeight:700, margin:'0 0 6px 0', lineHeight:1.2 }}>{profile?.full_name || 'Member'}</h1>
          <p style={{ color:'rgba(255,255,255,0.55)', fontSize:'14px', margin:'0 0 20px 0' }}>
            {profile?.plan_name || 'Essential Health'} · Member ID:{' '}
            <span style={{ fontFamily:'monospace', color:'rgba(255,255,255,0.85)' }}>{profile?.member_id || '—'}</span>
          </p>
          <button onClick={() => router.push('/submit-claim')} style={{ display:'inline-flex', alignItems:'center', gap:'8px', padding:'10px 22px', background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', borderRadius:'12px', color:'white', fontSize:'14px', fontWeight:600, cursor:'pointer' }}>
            <Plus size={15} /> Submit New Claim
          </button>
        </div>
      </div>

      <div style={{ maxWidth:'1280px', margin:'0 auto', padding:'28px 24px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'16px', marginBottom:'28px' }}>
          {[
            { label:'Total Claims',  value: totalClaims,       sub:'All time',           icon:<FileText size={20}/>,    color:'#2563EB' },
            { label:'Pending',       value: pendingClaims,      sub:'Awaiting decision',  icon:<Clock size={20}/>,       color:'#D97706' },
            { label:'Approved',      value: approvedClaims,     sub:'Successful claims',  icon:<CheckCircle2 size={20}/>,color:'#059669' },
            { label:'Total Paid',    value: fmt(totalPaid),     sub:'Reimbursed to you',  icon:<TrendingUp size={20}/>,  color:'#00A89D' },
          ].map(stat => (
            <div key={stat.label} style={{ background:'white', borderRadius:'16px', padding:'22px', border:'1px solid #F3F4F6', boxShadow:'0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ width:'42px', height:'42px', borderRadius:'12px', marginBottom:'16px', display:'flex', alignItems:'center', justifyContent:'center', background: stat.color + '15', color: stat.color }}>{stat.icon}</div>
              <div style={{ fontSize:'26px', fontWeight:700, color:'#111827', marginBottom:'4px' }}>{stat.value}</div>
              <div style={{ fontSize:'13px', fontWeight:500, color:'#6B7280' }}>{stat.label}</div>
              <div style={{ fontSize:'11px', color:'#9CA3AF', marginTop:'2px' }}>{stat.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ background:'white', borderRadius:'16px', border:'1px solid #F3F4F6', boxShadow:'0 1px 3px rgba(0,0,0,0.05)', overflow:'hidden' }}>
            <div style={{ padding:'18px 20px', borderBottom:'1px solid #F9FAFB', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <h2 style={{ fontSize:'15px', fontWeight:600, color:'#111827', margin:0 }}>Recent Claims</h2>
              <a href="/claims" style={{ fontSize:'13px', fontWeight:500, color:'#00A89D', display:'flex', alignItems:'center', gap:'4px' }}>View all <ChevronRight size={14} /></a>
            </div>

            {claims.length === 0 ? (
              <div style={{ padding:'60px 20px', textAlign:'center' }}>
                <div style={{ width:'56px', height:'56px', borderRadius:'16px', background:'#F2FAF9', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}>
                  <FileText size={24} color="#00A89D" />
                </div>
                <h3 style={{ fontSize:'15px', fontWeight:600, color:'#111827', margin:'0 0 8px 0' }}>No claims yet</h3>
                <p style={{ color:'#6B7280', fontSize:'13px', margin:'0 0 20px 0' }}>Submit your first claim to get started</p>
                <button onClick={() => router.push('/submit-claim')} style={{ display:'inline-flex', alignItems:'center', gap:'8px', padding:'10px 20px', borderRadius:'12px', border:'none', cursor:'pointer', background:'linear-gradient(135deg,#003C3A,#00A89D)', color:'white', fontSize:'13px', fontWeight:600 }}>
                  <Plus size={14} /> Submit a claim
                </button>
              </div>
            ) : (
              claims.map((claim, i) => {
                const sc = statusStyle(claim.status)
                return (
                  <div key={claim.id} onClick={() => router.push(`/claims/${claim.id}`)} style={{ display:'flex', alignItems:'center', gap:'14px', padding:'14px 20px', cursor:'pointer', transition:'background 0.15s', borderBottom: i < claims.length - 1 ? '1px solid #F9FAFB' : 'none' }} onMouseEnter={e => (e.currentTarget.style.background = '#FAFAFA')} onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                    <div style={{ width:'38px', height:'38px', borderRadius:'10px', flexShrink:0, background:'#F2FAF9', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <Stethoscope size={16} color="#00A89D" />
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'3px' }}>
                        <span style={{ fontWeight:600, fontSize:'13px', color:'#111827', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{claim.provider_name}</span>
                        <span style={{ fontSize:'11px', padding:'2px 8px', borderRadius:'999px', background:'#F2FAF9', color:'#00A89D', fontWeight:500, flexShrink:0 }}>{claim.claim_type}</span>
                      </div>
                      <div style={{ display:'flex', gap:'10px', fontSize:'11px', color:'#9CA3AF' }}>
                        <span style={{ fontFamily:'monospace' }}>{claim.claim_id}</span>
                        <span>·</span>
                        <span>{formatDate(claim.service_date)}</span>
                      </div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ fontWeight:700, fontSize:'13px', color:'#111827', marginBottom:'5px' }}>{fmt(claim.total_amount)}</div>
                      <span style={{ display:'inline-flex', alignItems:'center', gap:'4px', fontSize:'11px', fontWeight:500, padding:'3px 8px', borderRadius:'999px', background: sc.bg, color: sc.color }}>{claim.status}</span>
                    </div>
                    <ChevronRight size={15} color="#E5E7EB" />
                  </div>
                )
              })
            )}
        </div>
      </div>
    </div>
  )
}
