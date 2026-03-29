'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { HybridDecisionResult } from '@/types'
import { useDropzone } from 'react-dropzone'
import {
  ChevronRight, ChevronLeft, CheckCircle2, Upload,
  FileText, X, AlertCircle, Loader2, Shield
} from 'lucide-react'

// ── Constants ──────────────────────────────────────────
const CLAIM_TYPES = [
  { value: 'Outpatient', label: 'Outpatient', icon: '🏥', description: 'GP visits, consultations' },
  { value: 'Inpatient', label: 'Inpatient', icon: '🛏️', description: 'Hospital stays' },
  { value: 'Emergency', label: 'Emergency', icon: '⚡', description: 'A&E, emergency care' },
  { value: 'Pharmacy', label: 'Pharmacy', icon: '💊', description: 'Prescriptions, medication' },
  { value: 'Dental', label: 'Dental', icon: '🦷', description: 'Dental treatments' },
  { value: 'Optical', label: 'Optical', icon: '👓', description: 'Glasses, eye tests' },
]

const SERVICE_TYPES = ['GP', 'Specialist', 'Surgery', 'Lab', 'Imaging', 'Other']
const PROVIDER_TYPES = ['Hospital', 'Clinic', 'Doctor', 'Pharmacy', 'Other']

const REQUIRED_DOCS: Record<string, string[]> = {
  Outpatient: ['Invoice', 'Receipt'],
  Inpatient:  ['Invoice', 'Receipt', 'Discharge Summary'],
  Emergency:  ['Invoice', 'Receipt', 'Discharge Summary'],
  Pharmacy:   ['Invoice', 'Receipt', 'Prescription'],
  Dental:     ['Invoice', 'Receipt'],
  Optical:    ['Invoice', 'Receipt'],
}

const demoFallbackByEmail: Record<string, {
  member_id: string
  policy_id: string
  member_name: string
}> = {
  'member@laya-demo.com': {
    member_id: 'M-1001',
    policy_id: 'P-2001',
    member_name: 'Aisha Khan',
  },
}

function generateClaimId() {
  const year = new Date().getFullYear()
  const rand = Math.floor(Math.random() * 100000).toString().padStart(5, '0')
  return `CLM-${year}-${rand}`
}

// ── Step indicator ─────────────────────────────────────
function StepIndicator({ current, steps }: { current: number; steps: string[] }) {
  return (
    <div style={{ marginBottom: '32px' }}>
      {/* Desktop view - horizontal timeline */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0' }}>
        {steps.map((step, i) => {
          const done = i < current
          const active = i === current
          return (
            <div key={step} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              {/* Step circle */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flex: '0 0 auto',
                position: 'relative',
                zIndex: 2,
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '14px',
                  transition: 'all 0.3s ease',
                  background: done ? '#00A89D' : active ? 'linear-gradient(135deg,#003C3A,#00A89D)' : '#E5E7EB',
                  color: done || active ? 'white' : '#9CA3AF',
                  boxShadow: active ? '0 4px 12px rgba(0, 168, 157, 0.3)' : 'none',
                }}>
                  {done ? <CheckCircle2 size={20} style={{ color: 'white' }} /> : i + 1}
                </div>
                <span style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  marginTop: '8px',
                  color: active ? '#003C3A' : done ? '#00A89D' : '#6B7280',
                  whiteSpace: 'nowrap',
                  textAlign: 'center',
                }}>
                  {step}
                </span>
              </div>

              {/* Connector line */}
              {i < steps.length - 1 && (
                <div style={{
                  flex: 1,
                  height: '2px',
                  margin: '0 8px',
                  background: done ? '#00A89D' : '#E5E7EB',
                  transition: 'background 0.3s ease',
                  marginBottom: '20px',
                }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Progress bar */}
      <div style={{
        width: '100%',
        height: '3px',
        background: '#E5E7EB',
        borderRadius: '999px',
        overflow: 'hidden',
        marginTop: '12px',
      }}>
        <div style={{
          height: '100%',
          background: 'linear-gradient(90deg, #003C3A, #00A89D)',
          width: `${((current) / steps.length) * 100}%`,
          transition: 'width 0.4s ease',
        }} />
      </div>
    </div>
  )
}

// ── Input component ────────────────────────────────────
function Field({
  label, required, error, children
}: {
  label: string; required?: boolean; error?: string; children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
        {label} {required && <span style={{ color: '#EF4444' }}>*</span>}
      </label>
      {children}
      {error && (
        <p style={{ fontSize: '12px', color: '#EF4444', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <AlertCircle size={12} /> {error}
        </p>
      )}
    </div>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  const { error, ...rest } = props
  return (
    <input
      {...rest}
      style={{
        width: '100%',
        padding: '10px 14px',
        borderRadius: '8px',
        border: error ? '1.5px solid #EF4444' : '1.5px solid #E5E7EB',
        fontSize: '14px',
        outline: 'none',
        boxSizing: 'border-box' as const,
        background: error ? '#FEF2F2' : 'white',
        color: '#1F2937',
      }}
      onFocus={(e) => { e.target.style.borderColor = '#00A89D'; e.target.style.boxShadow = '0 0 0 2px #00A89D40' }}
      onBlur={(e)  => { e.target.style.borderColor = error ? '#EF4444' : '#E5E7EB'; e.target.style.boxShadow = 'none' }}
    />
  )
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      style={{
        width: '100%',
        padding: '10px 14px',
        borderRadius: '8px',
        border: '1.5px solid #E5E7EB',
        fontSize: '14px',
        outline: 'none',
        boxSizing: 'border-box' as const,
        background: 'white',
        color: '#1F2937',
      }}
      onFocus={(e) => { e.target.style.borderColor = '#00A89D'; e.target.style.boxShadow = '0 0 0 2px #00A89D40' }}
      onBlur={(e)  => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none' }}
    >
      {props.children}
    </select>
  )
}

// ── File Upload ────────────────────────────────────────
interface UploadedFile {
  file: File
  docType: string
  preview?: string
}

function DocumentUpload({
  files, onAdd, onRemove, claimType
}: {
  files: UploadedFile[]
  onAdd: (f: UploadedFile[]) => void
  onRemove: (i: number) => void
  claimType: string
}) {
  const [docType, setDocType] = useState('Invoice')
  const required = REQUIRED_DOCS[claimType] || []

  const onDrop = useCallback((accepted: File[]) => {
    onAdd(accepted.map(file => ({
      file, docType,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    })))
  }, [docType, onAdd])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': [], 'image/jpeg': [], 'image/png': [] },
    maxSize: 10 * 1024 * 1024,
  })

  const uploadedTypes = files.map(f => f.docType)
  const missingDocs   = required.filter(r => !uploadedTypes.includes(r))
  const allUploaded   = required.length > 0 && missingDocs.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Required docs tracker */}
      {required.length > 0 && (
        <div style={{
          padding: '16px 20px', borderRadius: '14px',
          background: allUploaded ? '#F0FDF4' : '#FFFBEB',
          border: `1.5px solid ${allUploaded ? '#86EFAC' : '#FDE68A'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: allUploaded ? '#15803D' : '#92400E', margin: 0 }}>
              {allUploaded ? '✓ All required documents uploaded' : `Required for ${claimType} claims`}
            </p>
            <span style={{
              fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px',
              background: allUploaded ? '#DCFCE7' : '#FEF3C7',
              color: allUploaded ? '#16A34A' : '#D97706',
            }}>
              {required.length - missingDocs.length}/{required.length} uploaded
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {required.map(doc => {
              const uploaded = uploadedTypes.includes(doc)
              return (
                <span key={doc} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '5px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 600,
                  background: uploaded ? '#DCFCE7' : 'white',
                  color: uploaded ? '#15803D' : '#B45309',
                  border: `1.5px solid ${uploaded ? '#86EFAC' : '#FDE68A'}`,
                }}>
                  {uploaded
                    ? <CheckCircle2 size={12} />
                    : <span style={{ width: '12px', height: '12px', borderRadius: '50%', border: '1.5px solid #D97706', display: 'inline-block' }} />
                  }
                  {doc}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Doc type selector */}
      <div style={{
        display: 'flex', gap: '12px', alignItems: 'flex-end',
        padding: '16px 20px', background: '#F8FAFC',
        borderRadius: '14px', border: '1px solid #E5E7EB',
      }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#6B7280', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Document type to upload
          </label>
          <Select value={docType} onChange={(e) => setDocType(e.target.value)}>
            {['Invoice','Receipt','Discharge Summary','Prescription',
              'Referral Letter','Lab Report','Pre-authorization','Other'].map(t => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </div>
        <div style={{
          padding: '10px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
          background: required.includes(docType) && !uploadedTypes.includes(docType) ? '#FEF3C7' : '#F0FDF4',
          color: required.includes(docType) && !uploadedTypes.includes(docType) ? '#D97706' : '#16A34A',
          whiteSpace: 'nowrap', border: '1px solid',
          borderColor: required.includes(docType) && !uploadedTypes.includes(docType) ? '#FDE68A' : '#86EFAC',
        }}>
          {required.includes(docType)
            ? uploadedTypes.includes(docType) ? '✓ Uploaded' : '! Required'
            : 'Optional'}
        </div>
      </div>

      {/* Drop zone */}
      <div {...getRootProps()} style={{
        border: `2px dashed ${isDragActive ? '#00A89D' : '#D1D5DB'}`,
        borderRadius: '18px', padding: '48px 24px', textAlign: 'center',
        cursor: 'pointer', transition: 'all 0.2s',
        background: isDragActive ? 'rgba(0,168,157,0.04)' : 'linear-gradient(180deg, #FAFAFA 0%, #F5F5F5 100%)',
      }}>
        <input {...getInputProps()} />
        <div style={{
          width: '64px', height: '64px', borderRadius: '20px',
          background: isDragActive ? '#00A89D' : 'white',
          boxShadow: isDragActive ? 'none' : '0 2px 12px rgba(0,0,0,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px', transition: 'all 0.2s',
        }}>
          <Upload size={28} color={isDragActive ? 'white' : '#9CA3AF'} />
        </div>
        <p style={{ fontSize: '16px', fontWeight: 700, color: '#1F2937', margin: '0 0 6px' }}>
          {isDragActive ? 'Drop your file here' : 'Drag & drop your file'}
        </p>
        <p style={{ fontSize: '13px', color: '#9CA3AF', margin: '0 0 20px' }}>
          PDF, JPG or PNG · Max 10MB per file
        </p>
        <span style={{
          display: 'inline-block', padding: '10px 24px', borderRadius: '10px',
          background: 'linear-gradient(135deg, #003C3A, #00A89D)',
          color: 'white', fontSize: '13px', fontWeight: 600,
          boxShadow: '0 4px 12px rgba(0,168,157,0.25)',
        }}>
          Browse files
        </span>
        <p style={{ fontSize: '12px', color: '#D1D5DB', margin: '14px 0 0' }}>
          Will be uploaded as: <strong style={{ color: '#6B7280' }}>{docType}</strong>
        </p>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ fontSize: '12px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
            Uploaded files ({files.length})
          </p>
          {files.map((f, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '12px 16px', borderRadius: '12px',
              background: 'white', border: '1px solid #E5E7EB',
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '10px',
                background: 'rgba(0,168,157,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <FileText size={18} color='#00A89D' />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.file.name}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px', background: 'rgba(0,168,157,0.1)', color: '#00A89D' }}>{f.docType}</span>
                  <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{(f.file.size / 1024).toFixed(0)} KB</span>
                </div>
              </div>
              <button type="button" onClick={() => onRemove(i)} style={{
                padding: '7px', borderRadius: '8px', border: 'none',
                background: '#FEF2F2', cursor: 'pointer', color: '#EF4444',
                display: 'flex', alignItems: 'center', flexShrink: 0,
              }}>
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Missing warning */}
      {missingDocs.length > 0 && files.length > 0 && (
        <div style={{
          display: 'flex', gap: '12px', padding: '14px 16px',
          borderRadius: '12px', background: '#FFFBEB', border: '1px solid #FDE68A',
        }}>
          <AlertCircle size={17} color='#D97706' style={{ flexShrink: 0, marginTop: '1px' }} />
          <div>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#92400E', margin: '0 0 2px' }}>Still missing</p>
            <p style={{ fontSize: '12px', color: '#B45309', margin: 0 }}>Please also upload: {missingDocs.join(', ')}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Wizard ────────────────────────────────────────
const STEPS = ['Claim Type', 'Details', 'Documents', 'Review']

interface FormData {
  // Step 1
  claimType: string
  isPreAuthorized: boolean
  treatmentCountry: string
  description: string
  // Step 2
  serviceDate: string
  admissionDate: string
  dischargeDate: string
  serviceLocation: string
  serviceType: string
  diagnosis: string
  providerName: string
  providerType: string
  providerRegistration: string
  totalAmount: string
  currency: string
  memberAlreadyPaid: boolean
  reimbursementType: string
  // Bank
  accountHolderName: string
  iban: string
  bic: string
  isAccidentOrInjury: boolean
  isPreExisting: boolean
}

const initialForm: FormData = {
  claimType: '',
  isPreAuthorized: false,
  treatmentCountry: 'Ireland',
  description: '',
  serviceDate: '',
  admissionDate: '',
  dischargeDate: '',
  serviceLocation: '',
  serviceType: 'GP',
  diagnosis: '',
  providerName: '',
  providerType: 'Clinic',
  providerRegistration: '',
  totalAmount: '',
  currency: 'EUR',
  memberAlreadyPaid: true,
  reimbursementType: 'Pay member',
  accountHolderName: '',
  iban: '',
  bic: '',
  isAccidentOrInjury: false,
  isPreExisting: false,
}

export default function SubmitClaimPage() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormData>(initialForm)
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [claimId, setClaimId] = useState('')
  const [consent, setConsent] = useState(false)
  const [decisionResult, setDecisionResult] = useState<HybridDecisionResult | null>(null)
  const [submitWarning, setSubmitWarning] = useState<string | null>(null)
  
  const update = (field: keyof FormData, value: string | boolean) =>
    setForm(prev => ({ ...prev, [field]: value }))

  // ── Validation per step ──
  function validateStep(s: number): boolean {
    const e: Partial<Record<keyof FormData, string>> = {}
    if (s === 1) {
      if (!form.claimType) e.claimType = 'Please select a claim type'
    }
    if (s === 2) {
      if (!form.serviceDate)   e.serviceDate   = 'Service date is required'
      if (!form.providerName)  e.providerName  = 'Provider name is required'
      if (!form.providerType)  e.providerType  = 'Provider type is required'
      if (!form.totalAmount || Number(form.totalAmount) <= 0)
        e.totalAmount = 'Enter a valid amount'
      if (form.reimbursementType === 'Pay member') {
        if (!form.accountHolderName.trim()) e.accountHolderName = 'Account holder name is required for member reimbursement'
        if (!form.iban.trim()) e.iban = 'IBAN is required for member reimbursement'
        if (!form.bic.trim()) e.bic = 'BIC / SWIFT is required for member reimbursement'
      }
      if (form.claimType === 'Inpatient') {
        if (!form.admissionDate) e.admissionDate = 'Admission date required for inpatient'
        if (!form.dischargeDate) e.dischargeDate = 'Discharge date required for inpatient'
      }
      // Future date check
      if (form.serviceDate && new Date(form.serviceDate) > new Date())
        e.serviceDate = 'Service date cannot be in the future'
    }
    if (s === 3) {
      if (files.length === 0) {
        // soft warning — we allow submission but will show warning
      }
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function next() { if (validateStep(step)) setStep(s => Math.min(s + 1, 4)) }
  function back() { setErrors({}); setStep(s => Math.max(s - 1, 1)) }

  // ── Submit ──
  async function handleSubmit() {
    if (!consent) return
    if (!validateStep(2)) {
      setStep(2)
      return
    }
    setSubmitting(true)
    setSubmitWarning(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, member_id, policy_id')
        .eq('id', user.id)
        .single()

      const newClaimId = generateClaimId()
      const normalizedAccountHolderName = form.reimbursementType === 'Pay member' ? form.accountHolderName.trim() || null : null
      const normalizedIban = form.reimbursementType === 'Pay member' ? form.iban.trim().toUpperCase() || null : null
      const normalizedBic = form.reimbursementType === 'Pay member' ? form.bic.trim().toUpperCase() || null : null
      

      // 1. Insert claim
      const { data: claim, error: claimErr } = await supabase
        .from('claims')
        .insert({
          claim_id: newClaimId,
          member_id: user.id,
          contact_email: user.email,
          submission_date: new Date().toISOString(),
          claim_type: form.claimType,
          service_type: form.serviceType,
          is_pre_authorized: form.isPreAuthorized,
          treatment_country: form.treatmentCountry,
          description: form.description,
          service_date: form.serviceDate,
          admission_date: form.admissionDate || null,
          discharge_date: form.dischargeDate || null,
          service_location: form.serviceLocation,
          diagnosis: form.diagnosis,
          provider_name: form.providerName,
          provider_type: form.providerType,
          provider_registration: form.providerRegistration || null,
          total_amount: Number(form.totalAmount),
          currency: form.currency,
          member_already_paid: form.memberAlreadyPaid,
          reimbursement_type: form.reimbursementType,
          // user answers
          is_accident_or_injury: form.isAccidentOrInjury,
          is_pre_existing: form.isPreExisting,
          emergency_overseas: form.claimType === 'Emergency' && form.treatmentCountry === 'Abroad',
          overseas_preapproved: form.treatmentCountry === 'Abroad' && form.isPreAuthorized,
          // consent — all map to the same checkbox
          declaration_confirmed: consent,
          consent_medical_data: consent,
          terms_accepted: consent,
          // server-side defaults (AI/assessor sets these later)
          duplicate_claim: false,
          is_experimental: false,
          is_cosmetic: false,
          infertility_related: false,
          first_steps_fertility_benefit: false,
          low_confidence_ocr: false,
          manual_fraud_flag: false,
          fraud_confirmed: false,
          status: 'Submitted',
          routing: 'pending',
        })
        .select()
        .single()

      if (claimErr) throw claimErr
if (!claim) throw new Error('No claim returned')

// ── Send to FastAPI decision engine ──
try {
  const fallback = user.email ? demoFallbackByEmail[user.email] : undefined

  const payload = {
    member_id: profile?.member_id ?? fallback?.member_id ?? '',
    policy_id: profile?.policy_id ?? fallback?.policy_id ?? '',
    member_name: profile?.full_name ?? fallback?.member_name ?? user.email ?? 'Unknown member',
    contact_email: user.email || '',
    contact_phone: user.user_metadata?.phone || null,
    claim_type: form.claimType,
    service_type: form.serviceType,
    treatment_country: form.treatmentCountry === 'Abroad' ? 'Abroad' : 'Ireland',
    short_description: form.description || null,
    service_date: form.serviceDate,
    admission_date: form.admissionDate || null,
    discharge_date: form.dischargeDate || null,
    provider_name: form.providerName,
    provider_type: form.providerType,
    provider_registration_id: form.providerRegistration || null,
    amount_claimed_eur: Number(form.totalAmount),
    currency: form.currency,
    member_already_paid: form.memberAlreadyPaid,
    reimbursement_type: form.reimbursementType,
    account_holder_name: normalizedAccountHolderName,
    iban: normalizedIban,
    bic_swift: normalizedBic,
    document_types: files.map(f => f.docType.toLowerCase().replace(/ /g, '_')),
    pre_authorized: form.isPreAuthorized,
    declaration_confirmed: consent,
    consent_medical_data: consent,
    terms_accepted: consent,
    submission_date: new Date().toISOString().split('T')[0],
  }

  if (!payload.member_id || !payload.policy_id) {
    throw new Error('Missing member_id/policy_id for decision engine')
  }
  console.log('Sending to FastAPI:', payload)

  const decisionResponse = await fetch(
    `${process.env.NEXT_PUBLIC_FASTAPI_URL}/api/claims/submit-hybrid-simple`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  )

  const decisionJson = await decisionResponse.json()

  if (!decisionResponse.ok) {
    throw new Error(
      Array.isArray(decisionJson?.detail)
        ? decisionJson.detail.map((d: { loc?: string[]; msg?: string }) => `${d.loc?.join('.')}: ${d.msg}`).join(' | ')
        : decisionJson?.detail || 'FastAPI claim evaluation failed'
    )
  }

  const hybridDecision = {
    ...(decisionJson as HybridDecisionResult),
    submitted_claim_input: {
      account_holder_name: normalizedAccountHolderName,
      iban: normalizedIban,
      bic: normalizedBic,
      bic_swift: normalizedBic,
    },
  } as HybridDecisionResult
  const scorecard = hybridDecision.scorecard as { fraud_score?: number; complexity_score?: number; anomaly_score?: number } | undefined
  setDecisionResult(hybridDecision)

  console.log('═══ FASTAPI DECISION ═══')
  console.log(hybridDecision)

  const persistenceResponse = await fetch('/api/claims/hybrid-result', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      claimId: claim.id,
      newClaimId,
      hybridDecision,
    }),
  })

  const persistenceJson = await persistenceResponse.json().catch(() => ({}))

  if (!persistenceResponse.ok) {
    console.warn('Hybrid decision persistence failed:', persistenceJson)
    setSubmitWarning('Claim submitted, but the saved review details are still syncing. Refresh in a moment if the dashboard or assessor view looks outdated.')
  }

} catch (decisionErr) {
  console.warn('FastAPI decision engine failed:', decisionErr)
}

      // 2. Upload documents to Supabase Storage
      for (const uf of files) {
        const ext      = uf.file.name.split('.').pop()
        const filePath = `${user.id}/${claim.id}/${uf.docType}-${Date.now()}.${ext}`

        const { error: uploadErr } = await supabase.storage
          .from('claim-documents')
          .upload(filePath, uf.file)

        if (!uploadErr) {
          const { data: urlData } = supabase.storage
            .from('claim-documents')
            .getPublicUrl(filePath)

          await supabase.from('claim_documents').insert({
            claim_id: claim.id,
            document_type: uf.docType,
            file_name: uf.file.name,
            file_path: filePath,
            file_url: urlData?.publicUrl,
            file_size: uf.file.size,
            mime_type: uf.file.type,
          })
        }
      }

      // 3. Create notification
      await supabase.from('notifications').insert({
        user_id: user.id,
        claim_id: claim.id,
        type: 'status_update',
        title: 'Claim submitted successfully',
        message: `Your claim ${newClaimId} has been received and is being processed.`,
        action_url: `/claims/${claim.id}`,
      })

      setClaimId(newClaimId)
      setSubmitted(true)
    } catch (err) {
  console.error('Full error:', JSON.stringify(err, null, 2))
  console.error('Error object:', err)
  alert(`Error: ${JSON.stringify(err)}`)

    } finally {
      setSubmitting(false)
    }
  }
  function getOutlook(decision: string) {
  switch (decision) {
    case 'APPROVE':             return { label: 'Very likely to be approved', segments: 4, color: '#0F6E56', bg: '#E1F5EE', border: '#9FE1CB' }
    case 'HUMAN_REVIEW':        return { label: 'Good chance of approval',    segments: 3, color: '#0F6E56', bg: '#E1F5EE', border: '#9FE1CB' }
    case 'NEEDS_INFO':          return { label: 'Action needed from you',     segments: 2, color: '#854F0B', bg: '#FAEEDA', border: '#FAC775' }
    case 'REJECT':              return { label: 'Claim could not be approved',segments: 1, color: '#A32D2D', bg: '#FCEBEB', border: '#F7C1C1' }
    case 'FRAUD_INVESTIGATION': return { label: 'We\'re reviewing your claim',segments: 2, color: '#854F0B', bg: '#FAEEDA', border: '#FAC775' }
    default:                    return { label: 'Under review',               segments: 2, color: '#854F0B', bg: '#FAEEDA', border: '#FAC775' }
  }
}
  // ── Success screen ──
  if (submitted) {
  const finalDecision = decisionResult?.final_decision ?? decisionResult?.decision
  const outlook = finalDecision ? getOutlook(finalDecision) : null
  const topTriggeredRule = decisionResult?.triggered_rules_summary?.[0]
  const displayReference = decisionResult?.claim_reference || claimId

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFA', padding: '40px 24px' }}>
      <div style={{ maxWidth: '680px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* ── Header ── */}
        <div style={{ textAlign: 'center', paddingBottom: '8px' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#E1F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <CheckCircle2 size={24} color="#0F6E56" />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: '#111827', margin: '0 0 6px' }}>Claim submitted</h2>
          <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>
            Reference{' '}
            <span style={{ fontFamily: 'monospace', background: '#F3F4F6', padding: '2px 8px', borderRadius: 6, color: '#374151', fontSize: 12 }}>
              {displayReference}
            </span>
          </p>
        </div>

        {!finalDecision && (
          <div style={{ marginTop: 16, padding: 16, borderRadius: 12, background: '#FEF2F2', color: '#991B1B' }}>
            Decision engine did not return a valid result. Please check the API payload.
          </div>
        )}

        {submitWarning && (
          <div style={{ padding: '14px 16px', borderRadius: 12, background: '#FFF7ED', border: '1px solid #FED7AA', color: '#9A3412', fontSize: 14, lineHeight: 1.5 }}>
            {submitWarning}
          </div>
        )}

        {decisionResult && outlook && (
          <>
            {/* ── Approval outlook ── */}
            <div style={{ padding: '20px', borderRadius: 14, background: outlook.bg, border: `1.5px solid ${outlook.border}` }}>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#6B7280', margin: '0 0 8px' }}>Approval outlook</p>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <p style={{ fontSize: 18, fontWeight: 600, color: '#111827', margin: '0 0 3px' }}>{outlook.label}</p>
                  <p style={{ fontSize: 13, color: '#374151', margin: 0 }}>
                    {decisionResult.final_display_summary}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                {[1,2,3,4].map(i => (
                  <div key={i} style={{
                    flex: 1, height: 8, borderRadius: 999,
                    background: i <= outlook.segments ? outlook.color : '#E5E7EB',
                    opacity: i <= outlook.segments ? (0.4 + i * 0.15) : 1,
                  }} />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: '#9CA3AF' }}>Unlikely</span>
                <span style={{ fontSize: 11, color: outlook.color, fontWeight: 500 }}>{outlook.label}</span>
                <span style={{ fontSize: 11, color: '#9CA3AF' }}>Approved</span>
              </div>
            </div>

            {decisionResult.member_decision_summary && (
              <div style={{ padding: '16px 20px', borderRadius: 14, background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: '0 0 10px' }}>Member summary</p>
                <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, margin: 0 }}>
                  {decisionResult.member_decision_summary}
                </p>
              </div>
            )}

            {topTriggeredRule && (
              <div style={{ padding: '16px 20px', borderRadius: 14, background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: '0 0 10px' }}>Top rule triggered</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>
                    {topTriggeredRule.rule_id} · {topTriggeredRule.rule_name}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#6B7280' }}>
                    {topTriggeredRule.outcome}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: '#374151', margin: '0 0 6px' }}>
                  {topTriggeredRule.claim_explanation}
                </p>
                <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>
                  {topTriggeredRule.rule_explanation}
                </p>
              </div>
            )}

            {/* ── What happens next ── */}
            <div style={{ padding: '16px 20px', borderRadius: 14, background: 'white', border: '1px solid #E5E7EB' }}>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#9CA3AF', margin: '0 0 14px' }}>What happens next</p>
              {[
                { label: 'Claim received', sub: 'Today', done: true },
                { label: 'Under review', sub: 'Usually 3–5 business days', done: false, active: true },
                { label: 'Decision & payment', sub: "We'll email you either way", done: false },
              ].map((s, i, arr) => (
                <div key={i}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600,
                      background: s.done ? '#E1F5EE' : s.active ? '#003C3A' : '#F3F4F6',
                      color: s.done ? '#0F6E56' : s.active ? 'white' : '#9CA3AF',
                    }}>
                      {s.done ? <CheckCircle2 size={13} /> : i + 1}
                    </div>
                    <div style={{ paddingBottom: i < arr.length - 1 ? 16 : 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 500, color: s.done || s.active ? '#111827' : '#9CA3AF', margin: '0 0 2px' }}>{s.label}</p>
                      <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>{s.sub}</p>
                    </div>
                  </div>
                  {i < arr.length - 1 && (
                    <div style={{ width: 1, height: 20, background: '#E5E7EB', marginLeft: 11 }} />
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Claim summary ── */}
        <div style={{ padding: '16px 20px', borderRadius: 14, background: 'white', border: '1px solid #E5E7EB' }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#9CA3AF', margin: '0 0 12px' }}>Claim summary</p>
          {[
            ['Type', form.claimType],
            ['Provider', form.providerName],
            ['Service date', form.serviceDate],
            ['Amount claimed', `${form.currency} ${Number(form.totalAmount).toFixed(2)}`],
            ['Documents', `${files.length} uploaded`],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '0.5px solid #F3F4F6' }}>
              <span style={{ fontSize: 13, color: '#6B7280' }}>{k}</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{v}</span>
            </div>
          ))}
        </div>

        {/* ── Buttons ── */}
        <button onClick={() => router.push('/claims')} style={{
          width: '100%', padding: '13px', borderRadius: 12, border: 'none',
          background: 'linear-gradient(135deg, #003C3A, #00A89D)', color: 'white',
          fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>
          View my claims
        </button>
        <button onClick={() => { setSubmitted(false); setStep(1); setForm(initialForm); setFiles([]); setConsent(false); setDecisionResult(null) }} style={{
          width: '100%', padding: '13px', borderRadius: 12,
          border: '1px solid #E5E7EB', background: 'white',
          fontSize: 14, fontWeight: 500, color: '#6B7280', cursor: 'pointer',
          marginBottom: '8px',
        }}>
          Submit another claim
        </button>

      </div>
    </div>
  )
}

  return (
    <div style={{ background: '#F8FAFA', minHeight: '100vh' }}>
      {/* Teal header */}
      <div style={{ background: 'linear-gradient(135deg, #003C3A 0%, #005C58 50%, #00A89D 100%)', padding: '32px', marginBottom: '0' }}>
        <h1 style={{ color: 'white', fontSize: '28px', fontWeight: 700, margin: '0 0 4px' }}>Submit a Claim</h1>
        <p style={{ color: 'rgba(255,255,255,0.75)', margin: 0, fontSize: '15px' }}>Complete all steps to submit your healthcare claim</p>
      </div>

      {/* Step content card */}
      <div style={{ maxWidth: '900px', margin: '32px auto', padding: '0 24px' }}>
        <div style={{ background: 'white', borderRadius: '16px', padding: '32px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          
          {/* Step indicator */}
          <StepIndicator current={step} steps={STEPS} />

          {/* Step content */}
          {step === 1 && (
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Select Claim Type</h2>
              <p className="text-gray-500 text-sm mb-6">
                What type of healthcare service are you claiming for?
              </p>
              {errors.claimType && (
                <p className="text-red-500 text-sm mb-4 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" /> {errors.claimType}
                </p>
              )}
              <div style={{
  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '16px', marginBottom: '32px'
}}>
  {CLAIM_TYPES.map(type => {
    const isSelected = form.claimType === type.value
    return (
      <button
        key={type.value}
        onClick={() => update('claimType', type.value)}
        style={{
          padding: '24px 20px',
          borderRadius: '16px',
          border: isSelected ? '2px solid #00A89D' : '2px solid #E5E7EB',
          background: isSelected ? '#F2FAF9' : 'white',
          boxShadow: isSelected ? '0 4px 16px rgba(0,168,157,0.2)' : '0 1px 3px rgba(0,0,0,0.04)',
          cursor: 'pointer',
          textAlign: 'left',
          transform: isSelected ? 'translateY(-2px)' : 'none',
          transition: 'all 0.15s ease',
        }}
      >
        <div style={{
          width: '44px', height: '44px', borderRadius: '12px',
          background: isSelected ? '#00A89D' : '#F3F4F6',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '22px', marginBottom: '12px',
          transition: 'all 0.15s'
        }}>
          {type.icon}
        </div>
        <div style={{
          fontWeight: 700, fontSize: '15px',
          color: isSelected ? '#003C3A' : '#1F2937',
          marginBottom: '4px'
        }}>
          {type.label}
        </div>
        <div style={{ fontSize: '13px', color: '#6B7280' }}>
          {type.description}
        </div>
        {isSelected && (
          <div style={{
            marginTop: '10px', display: 'inline-flex', alignItems: 'center',
            gap: '4px', color: '#00A89D', fontSize: '12px', fontWeight: 600
          }}>
            ✓ Selected
          </div>
        )}
      </button>
    )
  })}
</div>

              {form.claimType && (
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #F3F4F6' }}>
                  <div style={{ background: 'white', borderRadius: '12px', padding: '20px', border: '1.5px solid #E5E7EB' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: '#1F2937', marginBottom: '4px' }}>Pre-authorized claim?</div>
                        <div style={{ fontSize: '13px', color: '#6B7280' }}>Was this treatment pre-approved by Laya?</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => update('isPreAuthorized', !form.isPreAuthorized)}
                        style={{
                          width: '44px', height: '24px', borderRadius: '999px',
                          background: form.isPreAuthorized ? '#00A89D' : '#D1D5DB',
                          border: 'none', cursor: 'pointer', position: 'relative', transition: 'all 0.2s'
                        }}>
                        <span style={{
                          position: 'absolute', top: '2px', left: form.isPreAuthorized ? '22px' : '2px',
                          width: '20px', height: '20px', borderRadius: '50%', background: 'white',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'all 0.2s'
                        }} />
                      </button>
                    </div>
                  </div>

                  <div style={{ marginTop: '12px', background: 'white', borderRadius: '12px', padding: '20px', border: '1.5px solid #E5E7EB' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: '#1F2937', marginBottom: '4px' }}>Related to accident or injury?</div>
                        <div style={{ fontSize: '13px', color: '#6B7280' }}>Was this claim due to an accident or injury?</div>
                      </div>
                      <button type="button" onClick={() => update('isAccidentOrInjury', !form.isAccidentOrInjury)} style={{ width: '44px', height: '24px', borderRadius: '999px', background: form.isAccidentOrInjury ? '#00A89D' : '#D1D5DB', border: 'none', cursor: 'pointer', position: 'relative', transition: 'all 0.2s', flexShrink: 0 }}>
                        <span style={{ position: 'absolute', top: '2px', left: form.isAccidentOrInjury ? '22px' : '2px', width: '20px', height: '20px', borderRadius: '50%', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'all 0.2s' }} />
                      </button>
                    </div>
                  </div>

                  <div style={{ marginTop: '12px', background: 'white', borderRadius: '12px', padding: '20px', border: '1.5px solid #E5E7EB' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: '#1F2937', marginBottom: '4px' }}>Pre-existing condition?</div>
                        <div style={{ fontSize: '13px', color: '#6B7280' }}>Is this related to a pre-existing condition?</div>
                      </div>
                      <button type="button" onClick={() => update('isPreExisting', !form.isPreExisting)} style={{ width: '44px', height: '24px', borderRadius: '999px', background: form.isPreExisting ? '#00A89D' : '#D1D5DB', border: 'none', cursor: 'pointer', position: 'relative', transition: 'all 0.2s', flexShrink: 0 }}>
                        <span style={{ position: 'absolute', top: '2px', left: form.isPreExisting ? '22px' : '2px', width: '20px', height: '20px', borderRadius: '50%', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'all 0.2s' }} />
                      </button>
                    </div>
                  </div>

                  <div style={{ marginTop: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Treatment country</label>
                    <select
                      value={form.treatmentCountry}
                      onChange={e => update('treatmentCountry', e.target.value)}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #E5E7EB', fontSize: '14px', background: 'white', color: '#1F2937' }}
                    >
                      <option>Ireland</option>
                      <option>Abroad</option>
                    </select>
                  </div>
                  
                  <div style={{ marginTop: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Brief description (optional)</label>
                    <textarea
                      value={form.description}
                      onChange={e => update('description', e.target.value)}
                      placeholder="Brief description of the treatment or reason for claim..."
                      rows={3}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #E5E7EB', fontSize: '14px', background: 'white', color: '#1F2937', minHeight: '80px', resize: 'vertical', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 1: Service + Provider + Cost ── */}
          {step === 1 && (
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Treatment & Provider Details</h2>
              <p className="text-gray-500 text-sm mb-6">
                Tell us about the treatment and who provided it
              </p>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Date of service" required error={errors.serviceDate}>
                    <Input type="date" value={form.serviceDate}
                           onChange={e => update('serviceDate', e.target.value)}
                           max={new Date().toISOString().split('T')[0]}
                           error={errors.serviceDate} />
                  </Field>
                  <Field label="Type of service" required>
                    <Select value={form.serviceType}
                            onChange={e => update('serviceType', e.target.value)}>
                      {SERVICE_TYPES.map(t => <option key={t}>{t}</option>)}
                    </Select>
                  </Field>
                </div>

                {form.claimType === 'Inpatient' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Admission date" required error={errors.admissionDate}>
                      <Input type="date" value={form.admissionDate}
                             onChange={e => update('admissionDate', e.target.value)}
                             error={errors.admissionDate} />
                    </Field>
                    <Field label="Discharge date" required error={errors.dischargeDate}>
                      <Input type="date" value={form.dischargeDate}
                             onChange={e => update('dischargeDate', e.target.value)}
                             min={form.admissionDate}
                             error={errors.dischargeDate} />
                    </Field>
                  </div>
                )}

                <Field label="Service location (hospital/clinic name)">
                  <Input type="text" value={form.serviceLocation} placeholder="e.g. Mater Hospital, Dublin"
                         onChange={e => update('serviceLocation', e.target.value)} />
                </Field>

                <Field label="Diagnosis / symptoms (optional)">
                  <Input type="text" value={form.diagnosis} placeholder="e.g. Acute sinusitis"
                         onChange={e => update('diagnosis', e.target.value)} />
                </Field>

                <div className="border-t border-gray-100 pt-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Provider Information</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Provider name" required error={errors.providerName}>
                      <Input type="text" value={form.providerName} placeholder="e.g. Dr. Sarah Murphy"
                             onChange={e => update('providerName', e.target.value)}
                             error={errors.providerName} />
                    </Field>
                    <Field label="Provider type" required error={errors.providerType}>
                      <Select value={form.providerType}
                              onChange={e => update('providerType', e.target.value)}>
                        {PROVIDER_TYPES.map(t => <option key={t}>{t}</option>)}
                      </Select>
                    </Field>
                  </div>
                  <div className="mt-4">
                    <Field label="Provider registration number (optional)">
                      <Input type="text" value={form.providerRegistration} placeholder="IMC/PSI number if known"
                             onChange={e => update('providerRegistration', e.target.value)} />
                    </Field>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Cost & Payment</h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <Field label="Total amount claimed" required error={errors.totalAmount}>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">
                          €
                        </span>
                        <Input type="number" value={form.totalAmount} placeholder="0.00"
                               min="0" step="0.01"
                               onChange={e => update('totalAmount', e.target.value)}
                               error={errors.totalAmount}
                               className="pl-7" />
                      </div>
                    </Field>
                    <Field label="Currency">
                      <Select value={form.currency}
                              onChange={e => update('currency', e.target.value)}>
                        <option>EUR</option>
                        <option>GBP</option>
                        <option>USD</option>
                      </Select>
                    </Field>
                  </div>

                  <Field label="Reimbursement preference">
                    <Select value={form.reimbursementType}
                            onChange={e => update('reimbursementType', e.target.value)}>
                      <option>Pay member</option>
                      <option>Pay provider</option>
                    </Select>
                  </Field>

                  {form.reimbursementType === 'Pay member' && (
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-xl space-y-3">
                      <p className="text-xs font-semibold text-blue-700">
                        Bank details for reimbursement
                      </p>
                      <Field label="Account holder name">
                        <Input type="text" value={form.accountHolderName}
                               placeholder="As it appears on your account"
                               onChange={e => update('accountHolderName', e.target.value)} />
                      </Field>
                      <Field label="IBAN">
                        <Input type="text" value={form.iban} placeholder="IE00 XXXX XXXX XXXX XXXX XX"
                               onChange={e => update('iban', e.target.value.toUpperCase())} />
                      </Field>
                      <Field label="BIC / SWIFT">
                        <Input type="text" value={form.bic} placeholder="e.g. AIBKIE2D"
                               onChange={e => update('bic', e.target.value.toUpperCase())} />
                      </Field>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: Documents ── */}
          {step === 2 && (
  <div>
    <h2 className="text-lg font-bold text-gray-900 mb-1">Upload Documents</h2>
    <p className="text-gray-500 text-sm mb-6">
      Upload your invoices, receipts, and any other supporting documents
    </p>
    <DocumentUpload
      files={files}
      onAdd={(newFiles) => setFiles(prev => [...prev, ...newFiles])}
      onRemove={(i) => setFiles(prev => prev.filter((_, idx) => idx !== i))}
      claimType={form.claimType}
    />
  </div>
)}


{/* ── STEP 3: Review ── */}

{step === 3 && (
  <div>
    <h2 className="text-lg font-bold text-gray-900 mb-1">Review & Submit</h2>
    <p className="text-gray-500 text-sm mb-6">Please review your claim details before submitting</p>

    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* Claim type */}
      <div style={{ padding: '18px 20px', background: '#F8FAFC', borderRadius: '14px', border: '1px solid #E5E7EB' }}>
        <p style={{ fontSize: '10px', fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 10px' }}>Claim Type</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>{form.claimType}</span>
          {form.isPreAuthorized && (
            <span style={{ padding: '3px 10px', borderRadius: '999px', background: 'rgba(0,168,157,0.1)', color: '#00A89D', fontSize: '12px', fontWeight: 600 }}>Pre-authorized</span>
          )}
          <span style={{ fontSize: '13px', color: '#6B7280' }}>· {form.treatmentCountry}</span>
        </div>
        {form.description && <p style={{ fontSize: '13px', color: '#6B7280', margin: '8px 0 0' }}>{form.description}</p>}
      </div>

      {/* Treatment + Provider 2 columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={{ padding: '18px 20px', background: '#F8FAFC', borderRadius: '14px', border: '1px solid #E5E7EB' }}>
          <p style={{ fontSize: '10px', fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>Treatment</p>
          {[
            ['Service date', form.serviceDate || '—'],
            ['Service type', form.serviceType],
            form.serviceLocation ? ['Location', form.serviceLocation] : null,
            form.claimType === 'Inpatient' && form.admissionDate ? ['Admission', form.admissionDate] : null,
            form.claimType === 'Inpatient' && form.dischargeDate ? ['Discharge', form.dischargeDate] : null,
          ].filter((x): x is string[] => Array.isArray(x)).map(([k, v]) => (
            <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', color: '#6B7280' }}>{k}</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827', textAlign: 'right' }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ padding: '18px 20px', background: '#F8FAFC', borderRadius: '14px', border: '1px solid #E5E7EB' }}>
          <p style={{ fontSize: '10px', fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>Provider</p>
          {[
            ['Name', form.providerName || '—'],
            ['Type', form.providerType],
            form.providerRegistration ? ['Reg. no.', form.providerRegistration] : null,
          ].filter((x): x is string[] => Array.isArray(x)).map(([k, v]) => (
            <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', color: '#6B7280' }}>{k}</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827', textAlign: 'right' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Amount */}
      <div style={{
        padding: '22px 24px',
        background: 'linear-gradient(135deg, rgba(0,168,157,0.07), rgba(0,168,157,0.13))',
        borderRadius: '14px', border: '1.5px solid rgba(0,168,157,0.25)',
      }}>
        <p style={{ fontSize: '10px', fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 6px' }}>Claim Amount</p>
        <p style={{ fontSize: '36px', fontWeight: 900, color: '#003C3A', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
          {form.currency} {Number(form.totalAmount || 0).toFixed(2)}
        </p>
        <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
          Reimbursement to: <strong style={{ color: '#374151' }}>{form.reimbursementType}</strong>
        </p>
      </div>

      {/* Documents */}
      <div style={{ padding: '18px 20px', background: '#F8FAFC', borderRadius: '14px', border: '1px solid #E5E7EB' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <p style={{ fontSize: '10px', fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Documents</p>
          <span style={{
            fontSize: '12px', fontWeight: 600, padding: '3px 10px', borderRadius: '999px',
            background: files.length > 0 ? 'rgba(0,168,157,0.1)' : '#FEF3C7',
            color: files.length > 0 ? '#00A89D' : '#D97706',
          }}>
            {files.length} uploaded
          </span>
        </div>
        {files.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#D97706', fontSize: '13px', fontWeight: 500 }}>
            <AlertCircle size={15} /> No documents attached — your claim may be delayed
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {files.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: 'white', borderRadius: '10px', border: '1px solid #E5E7EB' }}>
                <FileText size={14} color='#00A89D' />
                <span style={{ flex: 1, fontSize: '13px', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.file.name}</span>
                <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px', background: 'rgba(0,168,157,0.08)', color: '#00A89D', flexShrink: 0 }}>{f.docType}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* GDPR — interactive custom checkbox */}
      <label style={{
        display: 'flex', alignItems: 'flex-start', gap: '14px',
        padding: '18px 20px',
        border: `2px solid ${consent ? '#00A89D' : '#E5E7EB'}`,
        borderRadius: '14px', cursor: 'pointer',
        background: consent ? 'rgba(0,168,157,0.04)' : 'white',
        transition: 'all 0.2s',
      }}>
        <div style={{
          width: '20px', height: '20px', borderRadius: '6px', flexShrink: 0, marginTop: '1px',
          border: `2px solid ${consent ? '#00A89D' : '#D1D5DB'}`,
          background: consent ? '#00A89D' : 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s',
        }}>
          {consent && <CheckCircle2 size={13} color='white' strokeWidth={3} />}
        </div>
        <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} style={{ display: 'none' }} />
        <span style={{ fontSize: '13px', color: '#4B5563', lineHeight: '1.6' }}>
          I confirm that all information provided is correct and I consent to Laya
          Healthcare processing this claim and my personal/medical data in accordance
          with their Privacy Policy and GDPR regulations.
        </span>
      </label>

    </div>
  </div>
)}

          {/* ── Navigation Buttons ── */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
  {step > 1 ? (
    <button type="button" onClick={back} style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '10px 20px', borderRadius: '10px', border: 'none',
      background: '#F3F4F6', color: '#4B5563', fontWeight: 600, fontSize: '14px', cursor: 'pointer',
    }}>
      <ChevronLeft size={16} /> Back
    </button>
  ) : (
    <button type="button" onClick={() => router.push('/dashboard')} style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '10px 20px', borderRadius: '10px', border: 'none',
      background: 'transparent', color: '#6B7280', fontWeight: 600, fontSize: '14px', cursor: 'pointer',
    }}>
      <ChevronLeft size={16} /> Cancel
    </button>
  )}

  {step < 4 ? (
    <button type="button" onClick={next} style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '11px 28px', borderRadius: '12px', border: 'none',
      background: 'linear-gradient(135deg, #003C3A, #00A89D)',
      color: 'white', fontWeight: 700, fontSize: '14px', cursor: 'pointer',
      boxShadow: '0 4px 14px rgba(0,168,157,0.3)',
    }}>
      Continue <ChevronRight size={16} />
    </button>
  ) : (
    <button type="button" onClick={handleSubmit} disabled={submitting || !consent} style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '11px 28px', borderRadius: '12px', border: 'none',
      background: (submitting || !consent) ? '#E5E7EB' : 'linear-gradient(135deg, #003C3A, #00A89D)',
      color: (submitting || !consent) ? '#9CA3AF' : 'white',
      fontWeight: 700, fontSize: '14px',
      cursor: (submitting || !consent) ? 'not-allowed' : 'pointer',
      boxShadow: (submitting || !consent) ? 'none' : '0 4px 14px rgba(0,168,157,0.3)',
      transition: 'all 0.2s',
    }}>
      {submitting
        ? <><Loader2 size={16} className="animate-spin" /> Submitting...</>
        : <><CheckCircle2 size={16} /> Submit Claim</>}
    </button>
  )}
</div>
        </div>
      </div>
    </div>
  )
}
