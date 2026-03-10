'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  ChevronLeft, FileText, Download, MessageSquare,
  Clock, CheckCircle2, XCircle, AlertCircle, CreditCard,
  Activity, Shield, LogOut, Send, Paperclip,
  Building2, Calendar, DollarSign, User
} from 'lucide-react'

interface Claim {
  id: string; claim_id: string; claim_type: string; service_type: string
  status: string; routing: string; priority: string
  provider_name: string; provider_type: string; service_location: string
  service_date: string; admission_date: string | null; discharge_date: string | null
  diagnosis: string | null; description: string | null
  total_amount: number; approved_amount: number | null; currency: string
  treatment_country: string; is_pre_authorized: boolean
  member_already_paid: boolean; reimbursement_type: string
  fraud_score: number | null; complexity_score: number | null
  ai_summary: string | null; ai_recommendation: string | null
  assessor_notes: string | null; rejection_reason: string | null
  payment_date: string | null; payment_reference: string | null
  created_at: string; updated_at: string; submitted_at: string
}

interface ClaimDocument {
  id: string; document_type: string; file_name: string
  file_url: string | null; file_size: number; uploaded_at: string
}

interface StatusHistory {
  id: string; previous_status: string | null; new_status: string
  changed_by_role: string; is_ai_action: boolean; created_at: string; notes: string | null
}

interface Message {
  id: string; sender_role: string; message: string
  is_internal: boolean; is_read: boolean; created_at: string
}

function fmt(amount: number) {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(amount)
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' })
}
function formatDateTime(d: string) {
  return new Date(d).toLocaleString('en-IE', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

function statusStyle(status: string) {
  const map: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
    'Submitted':     { color: '#2563EB', bg: '#EFF6FF', icon: <Clock size={14}/> },
    'In Review':     { color: '#D97706', bg: '#FFFBEB', icon: <Activity size={14}/> },
    'Approved':      { color: '#059669', bg: '#ECFDF5', icon: <CheckCircle2 size={14}/> },
    'Paid':          { color: '#00A89D', bg: '#F2FAF9', icon: <CreditCard size={14}/> },
    'Rejected':      { color: '#DC2626', bg: '#FEF2F2', icon: <XCircle size={14}/> },
    'Info Required': { color: '#EA580C', bg: '#FFF7ED', icon: <AlertCircle size={14}/> },
  }
  return map[status] || { color: '#6B7280', bg: '#F9FAFB', icon: <Clock size={14}/> }
}

const STATUS_TIMELINE = ['Submitted', 'In Review', 'Approved', 'Paid']

export default function ClaimDetailPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()

  const [claim, setClaim]       = useState<Claim | null>(null)
  const [docs, setDocs]         = useState<ClaimDocument[]>([])
  const [history, setHistory]   = useState<StatusHistory[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading]   = useState(true)
  const [newMsg, setNewMsg]     = useState('')
  const [sending, setSending]   = useState(false)
  const [activeTab, setActiveTab] = useState<'details'|'documents'|'messages'|'timeline'>('details')
  const [profileRole, setProfileRole] = useState('member')

  useEffect(() => { loadData() }, [params.id])

  async function loadData() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase.from('profiles')
        .select('role').eq('id', user.id).single()
      setProfileRole(profile?.role || 'member')

      const [claimRes, docsRes, historyRes, msgRes] = await Promise.all([
        supabase.from('claims').select('*').eq('id', params.id).single(),
        supabase.from('claim_documents').select('*').eq('claim_id', params.id).order('uploaded_at'),
        supabase.from('claim_status_history').select('*').eq('claim_id', params.id).order('created_at'),
        supabase.from('claim_messages').select('*').eq('claim_id', params.id)
          .eq('is_internal', false).order('created_at'),
      ])

      if (claimRes.data) setClaim(claimRes.data)
      if (docsRes.data)  setDocs(docsRes.data)
      if (historyRes.data) setHistory(historyRes.data)
      if (msgRes.data)   setMessages(msgRes.data)
    } finally { setLoading(false) }
  }

  async function sendMessage() {
    if (!newMsg.trim() || !claim) return
    setSending(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('claim_messages').insert({
        claim_id: claim.id,
        sender_id: user.id,
        sender_role: profileRole,
        message: newMsg.trim(),
        is_internal: false,
      })
      setNewMsg('')
      loadData()
    } finally { setSending(false) }
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
                  background:'#F8FAFB', fontFamily:'Inter,system-ui,sans-serif' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:'40px', height:'40px', border:'3px solid #E5E7EB',
                      borderTopColor:'#00A89D', borderRadius:'50%',
                      animation:'spin 0.8s linear infinite', margin:'0 auto 12px' }} />
        <p style={{ color:'#9CA3AF', fontSize:'14px' }}>Loading claim...</p>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  if (!claim) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
                  background:'#F8FAFB', fontFamily:'Inter,system-ui,sans-serif' }}>
      <div style={{ textAlign:'center' }}>
        <h2 style={{ fontSize:'20px', fontWeight:600, color:'#111827', margin:'0 0 8px 0' }}>Claim not found</h2>
        <button onClick={() => router.push('/claims')} style={{
          padding:'10px 20px', borderRadius:'10px', border:'none', cursor:'pointer',
          background:'#003C3A', color:'white', fontSize:'14px', fontWeight:600,
        }}>Back to Claims</button>
      </div>
    </div>
  )

  const sc = statusStyle(claim.status)
  const currentStep = STATUS_TIMELINE.indexOf(
    claim.status === 'Rejected' || claim.status === 'Info Required'
      ? 'In Review' : claim.status
  )

  return (
    <div style={{ minHeight:'100vh', background:'#F8FAFB', fontFamily:'Inter,system-ui,sans-serif' }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} *{box-sizing:border-box}`}</style>

      {/* NAVBAR */}
      <nav style={{ background:'white', borderBottom:'1px solid #F3F4F6', position:'sticky',
                    top:0, zIndex:100, boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ maxWidth:'1200px', margin:'0 auto', padding:'0 24px',
                      display:'flex', alignItems:'center', height:'64px', gap:'12px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <div style={{ width:'36px', height:'36px', borderRadius:'10px',
                          background:'linear-gradient(135deg,#003C3A,#00A89D)',
                          display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Shield size={16} color="white" />
            </div>
            <div>
              <div style={{ fontWeight:700, fontSize:'14px', color:'#111827', lineHeight:1 }}>laya</div>
              <div style={{ color:'#9CA3AF', fontSize:'9px', letterSpacing:'2px', textTransform:'uppercase' }}>healthcare</div>
            </div>
          </div>
          <div style={{ flex:1 }} />
          <button onClick={() => router.push('/claims')} style={{
            display:'flex', alignItems:'center', gap:'6px', padding:'7px 14px',
            borderRadius:'10px', border:'1px solid #E5E7EB', background:'#F9FAFB',
            fontSize:'13px', color:'#374151', cursor:'pointer', fontWeight:500,
          }}>
            <ChevronLeft size={14} /> Back to Claims
          </button>
        </div>
      </nav>

      {/* HEADER */}
      <div style={{ background:'linear-gradient(135deg,#003C3A 0%,#005C58 60%,#00A89D 100%)',
                    padding:'28px 24px' }}>
        <div style={{ maxWidth:'1200px', margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between',
                        flexWrap:'wrap', gap:'16px' }}>
            <div>
              <p style={{ color:'rgba(255,255,255,0.55)', fontSize:'12px',
                          fontFamily:'monospace', margin:'0 0 6px 0' }}>
                {claim.claim_id}
              </p>
              <h1 style={{ color:'white', fontSize:'22px', fontWeight:700, margin:'0 0 6px 0' }}>
                {claim.provider_name}
              </h1>
              <div style={{ display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap' }}>
                <span style={{ fontSize:'12px', padding:'3px 10px', borderRadius:'999px',
                               background:'rgba(255,255,255,0.15)', color:'rgba(255,255,255,0.9)',
                               fontWeight:500 }}>
                  {claim.claim_type}
                </span>
                <span style={{ color:'rgba(255,255,255,0.5)', fontSize:'13px' }}>
                  {formatDate(claim.service_date)}
                </span>
                <span style={{ color:'rgba(255,255,255,0.5)', fontSize:'13px' }}>·</span>
                <span style={{ color:'rgba(255,255,255,0.5)', fontSize:'13px' }}>
                  Submitted {formatDate(claim.submitted_at)}
                </span>
              </div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ color:'white', fontSize:'28px', fontWeight:800, marginBottom:'6px' }}>
                {fmt(claim.total_amount)}
              </div>
              {claim.approved_amount && (
                <div style={{ color:'rgba(255,255,255,0.7)', fontSize:'13px', marginBottom:'8px' }}>
                  Approved: {fmt(claim.approved_amount)}
                </div>
              )}
              <span style={{ display:'inline-flex', alignItems:'center', gap:'6px',
                             fontSize:'13px', fontWeight:600, padding:'6px 14px',
                             borderRadius:'999px', background: sc.bg, color: sc.color }}>
                {sc.icon} {claim.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* STATUS TIMELINE */}
      <div style={{ background:'white', borderBottom:'1px solid #F3F4F6',
                    padding:'20px 24px' }}>
        <div style={{ maxWidth:'1200px', margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:0 }}>
            {STATUS_TIMELINE.map((step, i) => {
              const done   = i <= currentStep && claim.status !== 'Rejected'
              const active = i === currentStep
              const rejected = claim.status === 'Rejected' && i === 1
              return (
                <div key={step} style={{ display:'flex', alignItems:'center' }}>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
                    <div style={{
                      width:'36px', height:'36px', borderRadius:'50%',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontWeight:700, fontSize:'13px', transition:'all 0.3s',
                      background: rejected ? '#FEF2F2' : done ? '#00A89D' : '#F3F4F6',
                      color: rejected ? '#DC2626' : done ? 'white' : '#9CA3AF',
                      border: active && !done ? '2px solid #00A89D' : 'none',
                    }}>
                      {rejected ? <XCircle size={16}/> : done ? <CheckCircle2 size={16}/> : i + 1}
                    </div>
                    <span style={{ fontSize:'11px', marginTop:'6px', fontWeight:500, whiteSpace:'nowrap',
                                   color: done ? '#003C3A' : '#9CA3AF' }}>
                      {rejected && i === 1 ? 'Rejected' : step}
                    </span>
                  </div>
                  {i < STATUS_TIMELINE.length - 1 && (
                    <div style={{ width:'80px', height:'2px', margin:'0 8px 20px 8px',
                                  background: i < currentStep ? '#00A89D' : '#E5E7EB',
                                  transition:'background 0.3s' }} />
                  )}
                </div>
              )
            })}
          </div>

          {/* Info Required or Rejection notice */}
          {claim.status === 'Info Required' && (
            <div style={{ marginTop:'16px', padding:'12px 16px', background:'#FFF7ED',
                          border:'1px solid #FED7AA', borderRadius:'12px',
                          display:'flex', alignItems:'flex-start', gap:'10px' }}>
              <AlertCircle size={16} color="#EA580C" style={{ marginTop:'1px', flexShrink:0 }} />
              <div>
                <p style={{ fontSize:'13px', fontWeight:600, color:'#EA580C', margin:'0 0 2px 0' }}>
                  Additional information required
                </p>
                <p style={{ fontSize:'12px', color:'#9A3412', margin:0 }}>
                  Please upload the missing documents or respond in the messages tab below.
                </p>
              </div>
            </div>
          )}
          {claim.status === 'Rejected' && claim.rejection_reason && (
            <div style={{ marginTop:'16px', padding:'12px 16px', background:'#FEF2F2',
                          border:'1px solid #FECACA', borderRadius:'12px',
                          display:'flex', alignItems:'flex-start', gap:'10px' }}>
              <XCircle size={16} color="#DC2626" style={{ marginTop:'1px', flexShrink:0 }} />
              <div>
                <p style={{ fontSize:'13px', fontWeight:600, color:'#DC2626', margin:'0 0 2px 0' }}>
                  Claim rejected
                </p>
                <p style={{ fontSize:'12px', color:'#7F1D1D', margin:0 }}>{claim.rejection_reason}</p>
              </div>
            </div>
          )}
          {claim.status === 'Paid' && (
            <div style={{ marginTop:'16px', padding:'12px 16px', background:'#F0FDF4',
                          border:'1px solid #BBF7D0', borderRadius:'12px',
                          display:'flex', alignItems:'flex-start', gap:'10px' }}>
              <CheckCircle2 size={16} color="#059669" style={{ marginTop:'1px', flexShrink:0 }} />
              <div>
                <p style={{ fontSize:'13px', fontWeight:600, color:'#059669', margin:'0 0 2px 0' }}>
                  Payment processed
                </p>
                <p style={{ fontSize:'12px', color:'#14532D', margin:0 }}>
                  {claim.payment_date ? `Paid on ${formatDate(claim.payment_date)}` : 'Payment has been processed'}
                  {claim.payment_reference && ` · Ref: ${claim.payment_reference}`}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* TABS + CONTENT */}
      <div style={{ maxWidth:'1200px', margin:'0 auto', padding:'24px' }}>

        {/* Tab Bar */}
        <div style={{ display:'flex', gap:'4px', marginBottom:'20px',
                      background:'white', padding:'6px', borderRadius:'14px',
                      border:'1px solid #F3F4F6', width:'fit-content',
                      boxShadow:'0 1px 3px rgba(0,0,0,0.05)' }}>
          {([
            { key:'details',   label:'Details',   icon:<FileText size={14}/> },
            { key:'documents', label:'Documents', icon:<Paperclip size={14}/>, count: docs.length },
            { key:'messages',  label:'Messages',  icon:<MessageSquare size={14}/>, count: messages.length },
            { key:'timeline',  label:'Timeline',  icon:<Clock size={14}/> },
          ] as const).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{
                display:'flex', alignItems:'center', gap:'6px', padding:'8px 16px',
                borderRadius:'10px', border:'none', cursor:'pointer', fontSize:'13px', fontWeight:500,
                transition:'all 0.15s',
                background: activeTab === tab.key ? '#003C3A' : 'transparent',
                color: activeTab === tab.key ? 'white' : '#6B7280',
              }}>
              {tab.icon} {tab.label}
              {'count' in tab && tab.count > 0 && (
                <span style={{
                  fontSize:'10px', fontWeight:700, padding:'1px 6px', borderRadius:'999px',
                  background: activeTab === tab.key ? 'rgba(255,255,255,0.2)' : '#F3F4F6',
                  color: activeTab === tab.key ? 'white' : '#6B7280',
                }}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* DETAILS TAB */}
        {activeTab === 'details' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
            {[
              {
                title: 'Treatment Details',
                icon: <Activity size={16} color="#00A89D"/>,
                rows: [
                  ['Claim Type',    claim.claim_type],
                  ['Service Type',  claim.service_type],
                  ['Service Date',  formatDate(claim.service_date)],
                  claim.admission_date ? ['Admission', formatDate(claim.admission_date)] : null,
                  claim.discharge_date ? ['Discharge', formatDate(claim.discharge_date)] : null,
                  claim.service_location ? ['Location', claim.service_location] : null,
                  claim.diagnosis ? ['Diagnosis', claim.diagnosis] : null,
                  ['Country', claim.treatment_country],
                  ['Pre-authorized', claim.is_pre_authorized ? 'Yes' : 'No'],
                ].filter(Boolean),
              },
              {
                title: 'Provider Information',
                icon: <Building2 size={16} color="#00A89D"/>,
                rows: [
                  ['Provider Name', claim.provider_name],
                  ['Provider Type', claim.provider_type],
                ],
              },
              {
                title: 'Financial Details',
                icon: <DollarSign size={16} color="#00A89D"/>,
                rows: [
                  ['Claimed Amount', fmt(claim.total_amount)],
                  claim.approved_amount ? ['Approved Amount', fmt(claim.approved_amount)] : null,
                  ['Currency', claim.currency],
                  ['Already Paid', claim.member_already_paid ? 'Yes' : 'No'],
                  ['Reimbursement', claim.reimbursement_type],
                ].filter(Boolean),
              },
              {
                title: 'Claim Status',
                icon: <Calendar size={16} color="#00A89D"/>,
                rows: [
                  ['Status', claim.status],
                  ['Routing', claim.routing],
                  ['Priority', claim.priority],
                  ['Submitted', formatDateTime(claim.submitted_at)],
                  ['Last Updated', formatDateTime(claim.updated_at)],
                  claim.assessor_notes ? ['Assessor Notes', claim.assessor_notes] : null,
                ].filter(Boolean),
              },
            ].map(section => (
              <div key={section.title} style={{
                background:'white', borderRadius:'16px', padding:'20px',
                border:'1px solid #F3F4F6', boxShadow:'0 1px 3px rgba(0,0,0,0.05)',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'16px' }}>
                  {section.icon}
                  <h3 style={{ fontSize:'14px', fontWeight:600, color:'#111827', margin:0 }}>
                    {section.title}
                  </h3>
                </div>
                {(section.rows as [string,string][]).map(([label, value]) => (
                  <div key={label} style={{ display:'flex', justifyContent:'space-between',
                                            alignItems:'flex-start', padding:'8px 0',
                                            borderBottom:'1px solid #F9FAFB', gap:'12px' }}>
                    <span style={{ fontSize:'13px', color:'#9CA3AF', flexShrink:0 }}>{label}</span>
                    <span style={{ fontSize:'13px', fontWeight:500, color:'#111827', textAlign:'right' }}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            ))}

            {/* AI Summary (if available) */}
            {claim.ai_summary && (
              <div style={{
                gridColumn:'1/-1', background:'linear-gradient(135deg,#003C3A,#005C58)',
                borderRadius:'16px', padding:'20px', color:'white',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'12px' }}>
                  <div style={{ fontSize:'16px' }}>🤖</div>
                  <h3 style={{ fontSize:'14px', fontWeight:600, color:'rgba(255,255,255,0.9)', margin:0 }}>
                    AI Assessment Summary
                  </h3>
                  <span style={{ fontSize:'10px', padding:'2px 8px', borderRadius:'999px',
                                 background:'rgba(0,212,200,0.2)', color:'#00D4C8', fontWeight:600,
                                 marginLeft:'auto' }}>
                    AI Generated
                  </span>
                </div>
                <p style={{ fontSize:'14px', color:'rgba(255,255,255,0.75)', lineHeight:1.6, margin:0 }}>
                  {claim.ai_summary}
                </p>
                {claim.ai_recommendation && (
                  <div style={{ marginTop:'12px', padding:'10px 14px', background:'rgba(0,212,200,0.1)',
                                borderRadius:'10px', borderLeft:'3px solid #00D4C8' }}>
                    <p style={{ fontSize:'13px', color:'rgba(255,255,255,0.8)', margin:0 }}>
                      <strong style={{ color:'#00D4C8' }}>Recommendation:</strong>{' '}
                      {claim.ai_recommendation}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* DOCUMENTS TAB */}
        {activeTab === 'documents' && (
          <div>
            {docs.length === 0 ? (
              <div style={{ background:'white', borderRadius:'16px', padding:'48px',
                            textAlign:'center', border:'1px solid #F3F4F6' }}>
                <Paperclip size={32} color="#D1D5DB" style={{ margin:'0 auto 12px', display:'block' }} />
                <h3 style={{ fontSize:'15px', fontWeight:600, color:'#374151', margin:'0 0 6px 0' }}>
                  No documents uploaded
                </h3>
                <p style={{ fontSize:'13px', color:'#9CA3AF', margin:0 }}>
                  Documents attached to this claim will appear here
                </p>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:'12px' }}>
                {docs.map(doc => (
                  <div key={doc.id} style={{
                    background:'white', borderRadius:'14px', padding:'16px',
                    border:'1px solid #F3F4F6', boxShadow:'0 1px 3px rgba(0,0,0,0.05)',
                    display:'flex', alignItems:'center', gap:'12px',
                  }}>
                    <div style={{ width:'42px', height:'42px', borderRadius:'12px', flexShrink:0,
                                  background:'#F2FAF9', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <FileText size={20} color="#00A89D" />
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:'13px', fontWeight:600, color:'#111827', margin:'0 0 3px 0',
                                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {doc.file_name}
                      </p>
                      <p style={{ fontSize:'11px', color:'#9CA3AF', margin:'0 0 3px 0' }}>
                        {doc.document_type}
                      </p>
                      <p style={{ fontSize:'11px', color:'#9CA3AF', margin:0 }}>
                        {(doc.file_size / 1024).toFixed(0)} KB · {formatDate(doc.uploaded_at)}
                      </p>
                    </div>
                    {doc.file_url && (
                      <a href={doc.file_url} target="_blank" rel="noopener noreferrer" style={{
                        padding:'6px', borderRadius:'8px', background:'#F2FAF9',
                        color:'#00A89D', display:'flex', cursor:'pointer',
                      }}>
                        <Download size={15} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MESSAGES TAB */}
        {activeTab === 'messages' && (
          <div style={{ background:'white', borderRadius:'16px', border:'1px solid #F3F4F6',
                        boxShadow:'0 1px 3px rgba(0,0,0,0.05)', overflow:'hidden' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #F3F4F6' }}>
              <h3 style={{ fontSize:'14px', fontWeight:600, color:'#111827', margin:0 }}>
                Messages
              </h3>
              <p style={{ fontSize:'12px', color:'#9CA3AF', margin:'4px 0 0 0' }}>
                Communicate with your assessor about this claim
              </p>
            </div>

            {/* Message list */}
            <div style={{ padding:'16px 20px', minHeight:'200px', maxHeight:'400px', overflowY:'auto' }}>
              {messages.length === 0 ? (
                <div style={{ textAlign:'center', padding:'32px 0' }}>
                  <MessageSquare size={28} color="#D1D5DB" style={{ margin:'0 auto 10px', display:'block' }} />
                  <p style={{ fontSize:'13px', color:'#9CA3AF', margin:0 }}>No messages yet</p>
                </div>
              ) : (
                messages.map(msg => {
                  const isMe = msg.sender_role === 'member'
                  return (
                    <div key={msg.id} style={{
                      display:'flex', justifyContent: isMe ? 'flex-end' : 'flex-start',
                      marginBottom:'12px',
                    }}>
                      <div style={{
                        maxWidth:'70%', padding:'10px 14px', borderRadius:'14px',
                        background: isMe ? '#003C3A' : '#F3F4F6',
                        color: isMe ? 'white' : '#111827',
                      }}>
                        {!isMe && (
                          <p style={{ fontSize:'10px', fontWeight:600, color:'#00A89D',
                                      margin:'0 0 4px 0', textTransform:'capitalize' }}>
                            {msg.sender_role}
                          </p>
                        )}
                        <p style={{ fontSize:'13px', margin:'0 0 6px 0', lineHeight:1.5 }}>{msg.message}</p>
                        <p style={{ fontSize:'10px', margin:0,
                                    color: isMe ? 'rgba(255,255,255,0.5)' : '#9CA3AF' }}>
                          {formatDateTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Message input */}
            <div style={{ padding:'12px 16px', borderTop:'1px solid #F3F4F6',
                          display:'flex', gap:'10px', alignItems:'flex-end' }}>
              <textarea
                value={newMsg}
                onChange={e => setNewMsg(e.target.value)}
                placeholder="Type a message..."
                rows={2}
                style={{
                  flex:1, padding:'10px 14px', borderRadius:'12px', border:'1.5px solid #E5E7EB',
                  fontSize:'13px', color:'#111827', resize:'none', outline:'none',
                  fontFamily:'inherit',
                }}
                onFocus={e => e.target.style.borderColor = '#00A89D'}
                onBlur={e  => e.target.style.borderColor = '#E5E7EB'}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
              />
              <button onClick={sendMessage} disabled={sending || !newMsg.trim()} style={{
                padding:'10px 16px', borderRadius:'12px', border:'none', cursor:'pointer',
                background: newMsg.trim() ? 'linear-gradient(135deg,#003C3A,#00A89D)' : '#E5E7EB',
                color: newMsg.trim() ? 'white' : '#9CA3AF',
                display:'flex', alignItems:'center', gap:'6px', fontSize:'13px', fontWeight:600,
                transition:'all 0.15s',
              }}>
                <Send size={14} /> Send
              </button>
            </div>
          </div>
        )}

        {/* TIMELINE TAB */}
        {activeTab === 'timeline' && (
          <div style={{ background:'white', borderRadius:'16px', padding:'20px',
                        border:'1px solid #F3F4F6', boxShadow:'0 1px 3px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize:'14px', fontWeight:600, color:'#111827', margin:'0 0 20px 0' }}>
              Status History
            </h3>
            {history.length === 0 ? (
              <p style={{ color:'#9CA3AF', fontSize:'13px' }}>No history yet</p>
            ) : (
              <div style={{ position:'relative', paddingLeft:'24px' }}>
                <div style={{ position:'absolute', left:'7px', top:0, bottom:0, width:'2px',
                              background:'linear-gradient(to bottom,#00A89D,#E5E7EB)' }} />
                {history.map((h, i) => (
                  <div key={h.id} style={{ position:'relative', marginBottom:'20px' }}>
                    <div style={{ position:'absolute', left:'-21px', top:'2px', width:'12px', height:'12px',
                                  borderRadius:'50%', background: i === 0 ? '#00A89D' : '#E5E7EB',
                                  border:`2px solid ${i === 0 ? '#00A89D' : '#D1D5DB'}` }} />
                    <div style={{ background:'#F9FAFB', borderRadius:'10px', padding:'12px 14px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px' }}>
                        {h.previous_status && (
                          <>
                            <span style={{ fontSize:'12px', padding:'2px 8px', borderRadius:'999px',
                                           background:'#F3F4F6', color:'#6B7280' }}>
                              {h.previous_status}
                            </span>
                            <span style={{ color:'#9CA3AF', fontSize:'12px' }}>→</span>
                          </>
                        )}
                        <span style={{ fontSize:'12px', fontWeight:600, padding:'2px 8px',
                                       borderRadius:'999px', ...statusStyle(h.new_status) }}>
                          {h.new_status}
                        </span>
                        {h.is_ai_action && (
                          <span style={{ fontSize:'10px', padding:'2px 8px', borderRadius:'999px',
                                         background:'rgba(0,168,157,0.1)', color:'#00A89D', fontWeight:600 }}>
                            🤖 AI
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize:'11px', color:'#9CA3AF', margin:'4px 0 0 0' }}>
                        {formatDateTime(h.created_at)} · by {h.changed_by_role}
                        {h.notes && ` · ${h.notes}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
