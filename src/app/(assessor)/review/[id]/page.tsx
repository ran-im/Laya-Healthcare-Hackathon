'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  ChevronLeft, Shield, Brain, CheckCircle2, XCircle,
  AlertCircle, Send, Loader2, FileText, User,
  Building2, Calendar, DollarSign, Activity,
  MessageSquare, Zap, RefreshCw, Download
} from 'lucide-react'

interface Claim {
  id: string; claim_id: string; claim_type: string; service_type: string
  status: string; routing: string; priority: string
  provider_name: string; provider_type: string; service_location: string | null
  service_date: string; admission_date: string | null; discharge_date: string | null
  diagnosis: string | null; description: string | null
  total_amount: number; approved_amount: number | null; currency: string
  treatment_country: string; is_pre_authorized: boolean
  fraud_score: number | null; complexity_score: number | null; anomaly_score: number | null
  ai_summary: string | null; ai_recommendation: string | null
  assessor_notes: string | null; rejection_reason: string | null
  submitted_at: string; updated_at: string
  profiles?: { full_name: string; member_id: string; plan_name: string; email: string }
}

interface Document {
  id: string; document_type: string; file_name: string; file_url: string | null; file_size: number
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(n)
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' })
}
function scoreColor(s: number) {
  if (s >= 75) return { color: '#DC2626', bg: '#FEF2F2', label: 'High Risk' }
  if (s >= 40) return { color: '#D97706', bg: '#FFFBEB', label: 'Medium Risk' }
  return { color: '#059669', bg: '#ECFDF5', label: 'Low Risk' }
}

export default function AIReviewPage() {
  const router  = useRouter()
  const params  = useParams()
  const supabase = createClient()
  const chatEndRef = useRef<HTMLDivElement>(null)

  const [claim, setClaim]   = useState<Claim | null>(null)
  const [docs, setDocs]     = useState<Document[]>([])
  const [loading, setLoading]   = useState(true)
  const [generating, setGenerating] = useState(false)
  const [deciding, setDeciding]     = useState(false)

  // AI Chat
  const [chat, setChat]         = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  // Decision
  const [showDecision, setShowDecision] = useState(false)
  const [decision, setDecision]         = useState<'approve'|'reject'|'info'|null>(null)
  const [approvedAmt, setApprovedAmt]   = useState('')
  const [assessorNotes, setAssessorNotes] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')

  useEffect(() => { loadData() }, [params.id])
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat])

  async function loadData() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

    const [claimRes, docsRes] = await Promise.all([
      supabase.from('claims').select('*')
        .eq('id', params.id).single(),
      supabase.from('claim_documents').select('*').eq('claim_id', params.id),
    ])

    if (claimRes.data) {
      // Fetch profile separately
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, member_id, plan_name, email')
        .eq('id', claimRes.data.member_id)
        .single()
      setClaim({ ...claimRes.data, profiles: profileData })
        setApprovedAmt(claimRes.data.total_amount?.toString() || '')
        // If AI summary already exists, add to chat
        if (claimRes.data.ai_summary) {
          setChat([{
            role: 'assistant',
            content: claimRes.data.ai_summary,
            timestamp: new Date(),
          }])
        }
      }
      if (docsRes.data) setDocs(docsRes.data)
    } finally { setLoading(false) }
  }

  // ── Generate AI Summary ──
  async function generateSummary() {
    if (!claim) return
    setGenerating(true)
    try {
      const response = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimId: claim.id }),
      })
      const data = await response.json()
      if (data.summary) {
        setChat(prev => [...prev, {
          role: 'assistant',
          content: data.summary,
          timestamp: new Date(),
        }])
        // Refresh claim to get updated scores
        loadData()
      }
    } catch {
      setChat(prev => [...prev, {
        role: 'assistant',
        content: 'Error generating AI summary. Please check your OpenAI API key is set in environment variables.',
        timestamp: new Date(),
      }])
    } finally { setGenerating(false) }
  }

  // ── AI Chat ──
  async function sendChatMessage() {
    if (!chatInput.trim() || !claim || chatLoading) return
    const userMsg = chatInput.trim()
    setChatInput('')
    setChat(prev => [...prev, { role: 'user', content: userMsg, timestamp: new Date() }])
    setChatLoading(true)

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimId: claim.id,
          message: userMsg,
          history: chat.slice(-6).map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await response.json()
      setChat(prev => [...prev, {
        role: 'assistant',
        content: data.reply || 'I could not process that request.',
        timestamp: new Date(),
      }])
    } catch {
      setChat(prev => [...prev, {
        role: 'assistant',
        content: 'Error connecting to AI. Check your OpenAI API key.',
        timestamp: new Date(),
      }])
    } finally { setChatLoading(false) }
  }

  // ── Submit Decision ──
  async function submitDecision() {
    if (!claim || !decision) return
    setDeciding(true)
    try {
      const statusMap = { approve: 'Approved', reject: 'Rejected', info: 'Info Required' }
      const updates: Record<string, unknown> = {
        status: statusMap[decision],
        updated_at: new Date().toISOString(),
        assessor_notes: assessorNotes || null,
      }
      if (decision === 'approve') updates.approved_amount = Number(approvedAmt)
      if (decision === 'reject')  updates.rejection_reason = rejectionReason

      await supabase.from('claims').update(updates).eq('id', claim.id)

      // Notification
      await supabase.from('notifications').insert({
        user_id: claim.profiles ? (claim as any).member_id : null,
        claim_id: claim.id,
        type: 'status_update',
        title: `Claim ${statusMap[decision]}`,
        message: decision === 'approve'
          ? `Your claim ${claim.claim_id} has been approved for ${fmt(Number(approvedAmt))}.`
          : decision === 'reject'
          ? `Your claim ${claim.claim_id} has been rejected. ${rejectionReason}`
          : `Additional information required for claim ${claim.claim_id}.`,
        action_url: `/claims/${claim.id}`,
      })

      router.push('/assessor-dashboard')
    } finally { setDeciding(false) }
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
                  background:'#F8FAFB', fontFamily:'Inter,system-ui,sans-serif' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:'40px', height:'40px', border:'3px solid #E5E7EB', borderTopColor:'#00A89D',
                      borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 12px' }} />
        <p style={{ color:'#9CA3AF', fontSize:'14px' }}>Loading claim for review...</p>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  if (!claim) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
                  background:'#F8FAFB', fontFamily:'Inter,system-ui,sans-serif' }}>
      <div style={{ textAlign:'center' }}>
        <h2 style={{ color:'#111827', margin:'0 0 12px 0' }}>Claim not found</h2>
        <button onClick={() => router.push('/assessor-dashboard')} style={{
          padding:'10px 20px', borderRadius:'10px', border:'none', cursor:'pointer',
          background:'#003C3A', color:'white', fontSize:'14px', fontWeight:600,
        }}>Back to Queue</button>
      </div>
    </div>
  )

  const fs = scoreColor(Math.round((claim.fraud_score ?? 0) * 100))
  const cs = scoreColor(Math.round((claim.complexity_score ?? 0) * 100))

  return (
    <div style={{ minHeight:'100vh', background:'#F8FAFB', fontFamily:'Inter,system-ui,sans-serif' }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} *{box-sizing:border-box}`}</style>

      {/* NAVBAR */}
      <nav style={{ background:'white', borderBottom:'1px solid #F3F4F6', position:'sticky',
                    top:0, zIndex:100, boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ maxWidth:'1400px', margin:'0 auto', padding:'0 24px',
                      display:'flex', alignItems:'center', height:'64px', gap:'14px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <div style={{ width:'36px', height:'36px', borderRadius:'10px',
                          background:'linear-gradient(135deg,#003C3A,#00A89D)',
                          display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Shield size={16} color="white" />
            </div>
            <div>
              <div style={{ fontWeight:700, fontSize:'14px', color:'#111827', lineHeight:1 }}>laya</div>
              <div style={{ color:'#9CA3AF', fontSize:'9px', letterSpacing:'2px', textTransform:'uppercase' }}>ai review panel</div>
            </div>
          </div>

          <button onClick={() => router.push('/assessor-dashboard')} style={{
            display:'flex', alignItems:'center', gap:'6px', padding:'7px 14px',
            borderRadius:'10px', border:'1px solid #E5E7EB', background:'#F9FAFB',
            fontSize:'13px', color:'#374151', cursor:'pointer', fontWeight:500,
          }}>
            <ChevronLeft size={14} /> Back to Queue
          </button>

          <div style={{ flex:1 }} />

          {/* Claim ID badge */}
          <div style={{ padding:'6px 14px', borderRadius:'10px', background:'#F2FAF9',
                        fontFamily:'monospace', fontSize:'13px', fontWeight:700, color:'#003C3A' }}>
            {claim.claim_id}
          </div>

          {/* Status */}
          <span style={{ fontSize:'12px', fontWeight:600, padding:'5px 12px', borderRadius:'999px',
                         background: claim.status === 'Approved' ? '#ECFDF5' :
                                     claim.status === 'Rejected' ? '#FEF2F2' :
                                     claim.status === 'In Review' ? '#FFFBEB' : '#EFF6FF',
                         color:      claim.status === 'Approved' ? '#059669' :
                                     claim.status === 'Rejected' ? '#DC2626' :
                                     claim.status === 'In Review' ? '#D97706' : '#2563EB' }}>
            {claim.status}
          </span>
        </div>
      </nav>

      <div style={{ maxWidth:'1400px', margin:'0 auto', padding:'24px',
                    display:'grid', gridTemplateColumns:'1fr 400px', gap:'20px', alignItems:'start' }}>

        {/* ── LEFT COLUMN: Claim Info + Decision ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>

          {/* Claim Overview */}
          <div style={{ background:'white', borderRadius:'16px', border:'1px solid #F3F4F6',
                        boxShadow:'0 1px 3px rgba(0,0,0,0.05)', overflow:'hidden' }}>
            <div style={{ background:'linear-gradient(135deg,#003C3A,#005C58)',
                          padding:'20px 24px', color:'white' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <p style={{ color:'rgba(255,255,255,0.55)', fontSize:'12px', margin:'0 0 4px 0' }}>
                    {claim.claim_type} · {claim.service_type}
                  </p>
                  <h2 style={{ color:'white', fontSize:'20px', fontWeight:700, margin:'0 0 4px 0' }}>
                    {claim.provider_name}
                  </h2>
                  <p style={{ color:'rgba(255,255,255,0.6)', fontSize:'13px', margin:0 }}>
                    {formatDate(claim.service_date)}
                    {claim.service_location && ` · ${claim.service_location}`}
                  </p>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:'28px', fontWeight:800, color:'white' }}>
                    {fmt(claim.total_amount)}
                  </div>
                  <div style={{ fontSize:'12px', color:'rgba(255,255,255,0.5)', marginTop:'4px' }}>
                    Claimed amount
                  </div>
                </div>
              </div>
            </div>

            <div style={{ padding:'20px 24px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
              {/* Member */}
              <div>
                <p style={{ fontSize:'11px', fontWeight:600, color:'#9CA3AF',
                            textTransform:'uppercase', letterSpacing:'0.5px', margin:'0 0 10px 0' }}>
                  Member
                </p>
                <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                  <div style={{ width:'38px', height:'38px', borderRadius:'50%', flexShrink:0,
                                background:'linear-gradient(135deg,#003C3A,#00A89D)',
                                display:'flex', alignItems:'center', justifyContent:'center',
                                color:'white', fontWeight:700, fontSize:'14px' }}>
                    {(claim.profiles as any)?.full_name?.[0] || 'M'}
                  </div>
                  <div>
                    <div style={{ fontSize:'14px', fontWeight:600, color:'#111827' }}>
                      {(claim.profiles as any)?.full_name || 'Unknown'}
                    </div>
                    <div style={{ fontSize:'12px', color:'#9CA3AF', fontFamily:'monospace' }}>
                      {(claim.profiles as any)?.member_id || '—'}
                    </div>
                    <div style={{ fontSize:'11px', color:'#9CA3AF' }}>
                      {(claim.profiles as any)?.plan_name || '—'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Key Details */}
              <div>
                <p style={{ fontSize:'11px', fontWeight:600, color:'#9CA3AF',
                            textTransform:'uppercase', letterSpacing:'0.5px', margin:'0 0 10px 0' }}>
                  Details
                </p>
                <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
                  {([
                    ['Provider type', claim.provider_type],
                    ['Country', claim.treatment_country],
                    ['Pre-authorized', claim.is_pre_authorized ? 'Yes ✓' : 'No'],
                    claim.diagnosis ? ['Diagnosis', claim.diagnosis] as [string, string] : null,
                  ] as ([string, string] | null)[]).filter((x): x is [string, string] => x !== null).map(([k, v]) => (
                    <div key={k as string} style={{ display:'flex', gap:'8px', fontSize:'12px' }}>
                      <span style={{ color:'#9CA3AF', width:'100px', flexShrink:0 }}>{k}:</span>
                      <span style={{ color:'#374151', fontWeight:500 }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* AI Risk Scores */}
          <div style={{ background:'white', borderRadius:'16px', border:'1px solid #F3F4F6',
                        boxShadow:'0 1px 3px rgba(0,0,0,0.05)', padding:'20px 24px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'18px' }}>
              <Brain size={16} color="#00A89D" />
              <h3 style={{ fontSize:'14px', fontWeight:600, color:'#111827', margin:0 }}>
                AI Risk Assessment
              </h3>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'16px' }}>
              {[
                { label:'Fraud Score',      value: Math.round((claim.fraud_score ?? 0) * 100),      style: fs },
                { label:'Complexity Score', value: Math.round((claim.complexity_score ?? 0) * 100),  style: cs },
                { label:'Anomaly Score',    value: Math.round((claim.anomaly_score ?? 0) * 100),
                  style: scoreColor(Math.round((claim.anomaly_score ?? 0) * 100)) },
              ].map(score => (
                <div key={score.label} style={{ padding:'16px', borderRadius:'12px',
                                                background: score.style.bg, textAlign:'center' }}>
                  <div style={{ fontSize:'32px', fontWeight:800, color: score.style.color, lineHeight:1 }}>
                    {score.value}
                    <span style={{ fontSize:'16px' }}>%</span>
                  </div>
                  <div style={{ fontSize:'11px', color: score.style.color, fontWeight:600,
                                marginTop:'4px', marginBottom:'8px' }}>
                    {score.style.label}
                  </div>
                  <div style={{ height:'6px', borderRadius:'999px', background:'rgba(0,0,0,0.08)', overflow:'hidden' }}>
                    <div style={{ height:'100%', borderRadius:'999px', width: score.value + '%',
                                  background: score.style.color, transition:'width 0.5s' }} />
                  </div>
                  <div style={{ fontSize:'11px', color:'rgba(0,0,0,0.4)', marginTop:'6px' }}>
                    {score.label}
                  </div>
                </div>
              ))}
            </div>

            {/* AI Recommendation */}
            {claim.ai_recommendation && (
              <div style={{ marginTop:'16px', padding:'14px 16px',
                            background:'linear-gradient(135deg,#003C3A,#005C58)',
                            borderRadius:'12px', color:'white' }}>
                <p style={{ fontSize:'11px', color:'rgba(255,255,255,0.5)',
                            textTransform:'uppercase', letterSpacing:'1px', margin:'0 0 6px 0' }}>
                  AI Recommendation
                </p>
                <p style={{ fontSize:'13px', color:'rgba(255,255,255,0.85)', margin:0, lineHeight:1.5 }}>
                  {claim.ai_recommendation}
                </p>
              </div>
            )}
          </div>

          {/* Documents */}
          {docs.length > 0 && (
            <div style={{ background:'white', borderRadius:'16px', border:'1px solid #F3F4F6',
                          boxShadow:'0 1px 3px rgba(0,0,0,0.05)', padding:'20px 24px' }}>
              <h3 style={{ fontSize:'14px', fontWeight:600, color:'#111827', margin:'0 0 14px 0' }}>
                Attached Documents ({docs.length})
              </h3>
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {docs.map(doc => (
                  <div key={doc.id} style={{ display:'flex', alignItems:'center', gap:'12px',
                                             padding:'10px 12px', borderRadius:'10px',
                                             background:'#F9FAFB', border:'1px solid #F3F4F6' }}>
                    <div style={{ width:'36px', height:'36px', borderRadius:'8px', flexShrink:0,
                                  background:'#F2FAF9', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <FileText size={16} color="#00A89D" />
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:'13px', fontWeight:500, color:'#111827', margin:'0 0 2px 0',
                                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {doc.file_name}
                      </p>
                      <p style={{ fontSize:'11px', color:'#9CA3AF', margin:0 }}>
                        {doc.document_type} · {(doc.file_size / 1024).toFixed(0)} KB
                      </p>
                    </div>
                    {doc.file_url && (
                      <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                        style={{ padding:'6px 10px', borderRadius:'8px', background:'#003C3A',
                                 color:'white', fontSize:'11px', fontWeight:600, display:'flex',
                                 alignItems:'center', gap:'4px', textDecoration:'none' }}>
                        <Download size={12} /> View
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DECISION PANEL */}
          {!['Approved','Rejected','Paid'].includes(claim.status) && (
            <div style={{ background:'white', borderRadius:'16px', border:'1px solid #F3F4F6',
                          boxShadow:'0 1px 3px rgba(0,0,0,0.05)', padding:'20px 24px' }}>
              <h3 style={{ fontSize:'14px', fontWeight:600, color:'#111827', margin:'0 0 16px 0' }}>
                Issue Decision
              </h3>

              {/* Decision buttons */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', marginBottom:'16px' }}>
                {[
                  { key:'approve' as const, label:'Approve', icon:<CheckCircle2 size={16}/>, color:'#059669', bg:'#ECFDF5', activeBg:'#059669' },
                  { key:'reject'  as const, label:'Reject',  icon:<XCircle size={16}/>,      color:'#DC2626', bg:'#FEF2F2', activeBg:'#DC2626' },
                  { key:'info'    as const, label:'Request Info', icon:<AlertCircle size={16}/>, color:'#D97706', bg:'#FFFBEB', activeBg:'#D97706' },
                ].map(d => (
                  <button key={d.key} onClick={() => setDecision(prev => prev === d.key ? null : d.key)}
                    style={{
                      display:'flex', flexDirection:'column', alignItems:'center', gap:'6px',
                      padding:'14px 10px', borderRadius:'12px', border:'2px solid',
                      cursor:'pointer', transition:'all 0.15s', fontWeight:600, fontSize:'13px',
                      borderColor: decision === d.key ? d.activeBg : d.bg,
                      background:  decision === d.key ? d.activeBg : d.bg,
                      color:       decision === d.key ? 'white' : d.color,
                    }}>
                    {d.icon} {d.label}
                  </button>
                ))}
              </div>

              {/* Decision form */}
              {decision && (
                <div style={{ borderTop:'1px solid #F3F4F6', paddingTop:'16px',
                              display:'flex', flexDirection:'column', gap:'12px' }}>
                  {decision === 'approve' && (
                    <div>
                      <label style={{ fontSize:'13px', fontWeight:500, color:'#374151',
                                      display:'block', marginBottom:'6px' }}>
                        Approved amount (€)
                      </label>
                      <input type="number" value={approvedAmt} onChange={e => setApprovedAmt(e.target.value)}
                        style={{ width:'100%', padding:'10px 14px', borderRadius:'10px',
                                 border:'1.5px solid #E5E7EB', fontSize:'14px', fontWeight:600,
                                 color:'#059669', outline:'none' }}
                        onFocus={e => e.target.style.borderColor = '#059669'}
                        onBlur={e  => e.target.style.borderColor = '#E5E7EB'}
                      />
                    </div>
                  )}

                  {decision === 'reject' && (
                    <div>
                      <label style={{ fontSize:'13px', fontWeight:500, color:'#374151',
                                      display:'block', marginBottom:'6px' }}>
                        Rejection reason <span style={{ color:'#DC2626' }}>*</span>
                      </label>
                      <textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)}
                        placeholder="Explain why this claim is being rejected..."
                        rows={3}
                        style={{ width:'100%', padding:'10px 14px', borderRadius:'10px',
                                 border:'1.5px solid #E5E7EB', fontSize:'13px', resize:'none',
                                 outline:'none', fontFamily:'inherit' }}
                        onFocus={e => e.target.style.borderColor = '#DC2626'}
                        onBlur={e  => e.target.style.borderColor = '#E5E7EB'}
                      />
                    </div>
                  )}

                  <div>
                    <label style={{ fontSize:'13px', fontWeight:500, color:'#374151',
                                    display:'block', marginBottom:'6px' }}>
                      Assessor notes (optional)
                    </label>
                    <textarea value={assessorNotes} onChange={e => setAssessorNotes(e.target.value)}
                      placeholder="Internal notes for audit trail..."
                      rows={2}
                      style={{ width:'100%', padding:'10px 14px', borderRadius:'10px',
                               border:'1.5px solid #E5E7EB', fontSize:'13px', resize:'none',
                               outline:'none', fontFamily:'inherit' }}
                      onFocus={e => e.target.style.borderColor = '#00A89D'}
                      onBlur={e  => e.target.style.borderColor = '#E5E7EB'}
                    />
                  </div>

                  <button onClick={submitDecision}
                    disabled={deciding || (decision === 'reject' && !rejectionReason)}
                    style={{
                      padding:'12px', borderRadius:'12px', border:'none', cursor:'pointer',
                      fontWeight:700, fontSize:'14px', color:'white', transition:'all 0.15s',
                      background: decision === 'approve' ? 'linear-gradient(135deg,#059669,#10B981)'
                                : decision === 'reject'  ? 'linear-gradient(135deg,#DC2626,#EF4444)'
                                : 'linear-gradient(135deg,#D97706,#F59E0B)',
                      display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
                      opacity: deciding ? 0.7 : 1,
                    }}>
                    {deciding && <Loader2 size={15} style={{ animation:'spin 1s linear infinite' }} />}
                    {deciding ? 'Processing...' :
                      decision === 'approve' ? `✓ Approve for ${fmt(Number(approvedAmt) || 0)}` :
                      decision === 'reject'  ? '✗ Reject Claim' :
                      '? Request Additional Information'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN: AI Chat ── */}
        <div style={{ position:'sticky', top:'80px' }}>
          <div style={{ background:'white', borderRadius:'16px', border:'1px solid #F3F4F6',
                        boxShadow:'0 4px 20px rgba(0,0,0,0.08)', overflow:'hidden',
                        display:'flex', flexDirection:'column', height:'calc(100vh - 120px)' }}>

            {/* Chat Header */}
            <div style={{ padding:'16px 18px', background:'linear-gradient(135deg,#003C3A,#005C58)',
                          display:'flex', alignItems:'center', gap:'10px' }}>
              <div style={{ width:'34px', height:'34px', borderRadius:'10px', flexShrink:0,
                            background:'rgba(0,212,200,0.25)',
                            display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Brain size={16} color="#00D4C8" />
              </div>
              <div>
                <div style={{ fontSize:'13px', fontWeight:700, color:'white', lineHeight:1 }}>
                  Laya AI Assistant
                </div>
                <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.5)', marginTop:'2px' }}>
                  Powered by GPT-4 · Claims Intelligence
                </div>
              </div>
              <button onClick={generateSummary} disabled={generating}
                style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'5px',
                         padding:'6px 12px', borderRadius:'8px',
                         background:'rgba(0,212,200,0.2)', border:'1px solid rgba(0,212,200,0.3)',
                         color:'#00D4C8', fontSize:'11px', fontWeight:600, cursor:'pointer' }}>
                {generating
                  ? <><Loader2 size={11} style={{ animation:'spin 1s linear infinite' }} /> Analyzing...</>
                  : <><Zap size={11} /> Analyze Claim</>
                }
              </button>
            </div>

            {/* Chat Messages */}
            <div style={{ flex:1, overflowY:'auto', padding:'16px', display:'flex', flexDirection:'column', gap:'12px' }}>
              {chat.length === 0 ? (
                <div style={{ textAlign:'center', padding:'32px 16px', color:'#9CA3AF' }}>
                  <Brain size={32} style={{ margin:'0 auto 12px', display:'block', opacity:0.4 }} />
                  <p style={{ fontSize:'14px', fontWeight:500, margin:'0 0 6px 0', color:'#6B7280' }}>
                    AI Claims Assistant
                  </p>
                  <p style={{ fontSize:'12px', margin:'0 0 16px 0', lineHeight:1.5 }}>
                    Click "Analyze Claim" to get an AI-powered assessment, or ask a question directly.
                  </p>
                  {/* Suggested questions */}
                  <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                    {[
                      'Does this claim look fraudulent?',
                      'Is this amount reasonable for this treatment?',
                      'What documents are missing?',
                      'Should I approve or reject?',
                    ].map(q => (
                      <button key={q} onClick={() => { setChatInput(q) }}
                        style={{ padding:'8px 12px', borderRadius:'8px', border:'1px solid #E5E7EB',
                                 background:'#F9FAFB', fontSize:'12px', color:'#374151',
                                 cursor:'pointer', textAlign:'left', transition:'all 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = '#00A89D'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = '#E5E7EB'}>
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                chat.map((msg, i) => (
                  <div key={i} style={{ display:'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    {msg.role === 'assistant' && (
                      <div style={{ width:'28px', height:'28px', borderRadius:'8px', flexShrink:0,
                                    background:'linear-gradient(135deg,#003C3A,#00A89D)', marginRight:'8px',
                                    display:'flex', alignItems:'center', justifyContent:'center', alignSelf:'flex-end' }}>
                        <Brain size={13} color="white" />
                      </div>
                    )}
                    <div style={{
                      maxWidth:'85%', padding:'10px 14px', borderRadius:'14px',
                      background: msg.role === 'user' ? '#003C3A' : '#F3F4F6',
                      color: msg.role === 'user' ? 'white' : '#111827',
                      borderBottomRightRadius: msg.role === 'user' ? '4px' : '14px',
                      borderBottomLeftRadius: msg.role === 'assistant' ? '4px' : '14px',
                    }}>
                      <p style={{ fontSize:'13px', lineHeight:1.6, margin:'0 0 6px 0',
                                  whiteSpace:'pre-wrap', wordBreak:'break-word' }}>
                        {msg.content}
                      </p>
                      <p style={{ fontSize:'10px', margin:0,
                                  color: msg.role === 'user' ? 'rgba(255,255,255,0.4)' : '#9CA3AF' }}>
                        {msg.timestamp.toLocaleTimeString('en-IE', { hour:'2-digit', minute:'2-digit' })}
                      </p>
                    </div>
                  </div>
                ))
              )}

              {chatLoading && (
                <div style={{ display:'flex', gap:'8px', alignItems:'flex-end' }}>
                  <div style={{ width:'28px', height:'28px', borderRadius:'8px', flexShrink:0,
                                background:'linear-gradient(135deg,#003C3A,#00A89D)',
                                display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <Brain size={13} color="white" />
                  </div>
                  <div style={{ padding:'10px 14px', borderRadius:'14px', borderBottomLeftRadius:'4px',
                                background:'#F3F4F6' }}>
                    <div style={{ display:'flex', gap:'4px', alignItems:'center', height:'20px' }}>
                      {[0,1,2].map(i => (
                        <div key={i} style={{ width:'6px', height:'6px', borderRadius:'50%',
                                              background:'#9CA3AF', animation:`bounce 1.2s ${i*0.2}s infinite` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <div style={{ padding:'12px', borderTop:'1px solid #F3F4F6',
                          display:'flex', gap:'8px', alignItems:'flex-end' }}>
              <textarea value={chatInput} onChange={e => setChatInput(e.target.value)}
                placeholder="Ask about this claim..."
                rows={2}
                style={{ flex:1, padding:'10px 12px', borderRadius:'12px', border:'1.5px solid #E5E7EB',
                         fontSize:'13px', color:'#111827', resize:'none', outline:'none', fontFamily:'inherit' }}
                onFocus={e => e.target.style.borderColor = '#00A89D'}
                onBlur={e  => e.target.style.borderColor = '#E5E7EB'}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage() } }}
              />
              <button onClick={sendChatMessage} disabled={chatLoading || !chatInput.trim()}
                style={{ padding:'10px 14px', borderRadius:'12px', border:'none', cursor:'pointer',
                         background: chatInput.trim() ? 'linear-gradient(135deg,#003C3A,#00A89D)' : '#E5E7EB',
                         color: chatInput.trim() ? 'white' : '#9CA3AF',
                         display:'flex', alignItems:'center', gap:'6px',
                         fontSize:'13px', fontWeight:600, transition:'all 0.15s', flexShrink:0 }}>
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)}
        }
      `}</style>
    </div>
  )
}
