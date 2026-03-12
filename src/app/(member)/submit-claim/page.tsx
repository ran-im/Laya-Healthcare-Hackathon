'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
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

function generateClaimId() {
  const year = new Date().getFullYear()
  const rand = Math.floor(Math.random() * 100000).toString().padStart(5, '0')
  return `CLM-${year}-${rand}`
}

// ── Step indicator ─────────────────────────────────────
function StepIndicator({ current, steps }: { current: number; steps: string[] }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((step, i) => {
        const done    = i < current
        const active  = i === current
        return (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center
                               text-sm font-bold transition-all duration-300 ${
                 done   ? 'text-white' :
                 active ? 'text-white' : 'text-gray-400 bg-gray-100'}`}
                style={{
                  background: done ? '#00A89D' : active
                    ? 'linear-gradient(135deg,#003C3A,#00A89D)' : undefined,
                }}>
                {done ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-xs mt-1.5 font-medium whitespace-nowrap ${
                active ? 'text-gray-900' : done ? 'text-teal-600' : 'text-gray-400'}`}>
                {step}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-16 h-0.5 mx-2 mb-5 transition-all duration-300 ${
                done ? 'bg-teal-400' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
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
    />
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
    const newFiles = accepted.map(file => ({
      file,
      docType,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }))
    onAdd(newFiles)
  }, [docType, onAdd])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': [], 'image/jpeg': [], 'image/png': [] },
    maxSize: 10 * 1024 * 1024,
  })

  const uploadedTypes = files.map(f => f.docType)
  const missingDocs   = required.filter(r => !uploadedTypes.includes(r))

  return (
    <div className="space-y-4">
      {/* Required docs notice */}
      {required.length > 0 && (
        <div className="p-4 rounded-xl border text-sm"
             style={{ background: '#F2FAF9', borderColor: '#00A89D30' }}>
          <p className="font-medium mb-2" style={{ color: '#003C3A' }}>
            Required for {claimType} claims:
          </p>
          <div className="flex flex-wrap gap-2">
            {required.map(doc => {
              const uploaded = uploadedTypes.includes(doc)
              return (
                <span key={doc}
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1
                                 rounded-full font-medium"
                      style={{
                        background: uploaded ? '#ECFDF5' : '#FEF3C7',
                        color: uploaded ? '#059669' : '#D97706',
                      }}>
                  {uploaded ? '✓' : '!'} {doc}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Doc type selector + drop zone */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Document type
        </label>
        <Select value={docType} onChange={(e) => setDocType(e.target.value)}>
          {['Invoice','Receipt','Discharge Summary','Prescription',
            'Referral Letter','Lab Report','Pre-authorization','Other'].map(t => (
            <option key={t}>{t}</option>
          ))}
        </Select>
      </div>

      <div {...getRootProps()}
           className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer
                       transition-all duration-200 ${
             isDragActive
               ? 'border-teal-400 bg-teal-50'
               : 'border-gray-200 hover:border-teal-300 hover:bg-gray-50'
           }`}>
        <input {...getInputProps()} />
        <Upload className={`w-8 h-8 mx-auto mb-3 ${isDragActive ? 'text-teal-500' : 'text-gray-400'}`} />
        <p className="text-sm font-medium text-gray-700 mb-1">
          {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
        </p>
        <p className="text-xs text-gray-400">PDF, JPG, PNG · Max 10MB per file</p>
        <button type="button"
                className="mt-4 px-4 py-2 rounded-xl text-sm font-medium text-white"
                style={{ background: 'linear-gradient(135deg, #003C3A, #00A89D)' }}>
          Browse files
        </button>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f, i) => (
            <div key={i}
                 className="flex items-center gap-3 p-3 bg-white border border-gray-100
                            rounded-xl shadow-sm">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                   style={{ background: '#F2FAF9' }}>
                <FileText className="w-4 h-4" style={{ color: '#00A89D' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{f.file.name}</p>
                <p className="text-xs text-gray-400">
                  {f.docType} · {(f.file.size / 1024).toFixed(0)} KB
                </p>
              </div>
              <button type="button" onClick={() => onRemove(i)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400
                                 hover:text-red-500 transition-colors flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Missing warning */}
      {missingDocs.length > 0 && files.length > 0 && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200
                        rounded-xl text-sm text-amber-700">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Missing documents</p>
            <p className="text-xs mt-0.5">
              Please upload: {missingDocs.join(', ')}
            </p>
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
}

export default function SubmitClaimPage() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep]   = useState(0)
  const [form, setForm]   = useState<FormData>(initialForm)
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)
  const [claimId, setClaimId]       = useState('')

  const update = (field: keyof FormData, value: string | boolean) =>
    setForm(prev => ({ ...prev, [field]: value }))

  // ── Validation per step ──
  function validateStep(s: number): boolean {
    const e: Partial<Record<keyof FormData, string>> = {}
    if (s === 0) {
      if (!form.claimType) e.claimType = 'Please select a claim type'
    }
    if (s === 1) {
      if (!form.serviceDate)   e.serviceDate   = 'Service date is required'
      if (!form.providerName)  e.providerName  = 'Provider name is required'
      if (!form.providerType)  e.providerType  = 'Provider type is required'
      if (!form.totalAmount || Number(form.totalAmount) <= 0)
        e.totalAmount = 'Enter a valid amount'
      if (form.claimType === 'Inpatient') {
        if (!form.admissionDate) e.admissionDate = 'Admission date required for inpatient'
        if (!form.dischargeDate) e.dischargeDate = 'Discharge date required for inpatient'
      }
      // Future date check
      if (form.serviceDate && new Date(form.serviceDate) > new Date())
        e.serviceDate = 'Service date cannot be in the future'
    }
    if (s === 2) {
      if (files.length === 0) {
        // soft warning — we allow submission but will show warning
      }
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function next() {
    if (validateStep(step)) setStep(s => s + 1)
  }
  function back() {
    setErrors({})
    setStep(s => s - 1)
  }

  // ── Submit ──
  async function handleSubmit() {
    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const newClaimId = generateClaimId()

      // 1. Insert claim
      const { data: claim, error: claimErr } = await supabase
        .from('claims')
        .insert({
          claim_id: newClaimId,
          member_id: user.id,
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
          status: 'Submitted',
          routing: 'pending',
        })
        .select()
        .single()

      if (claimErr) throw claimErr

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
      console.error(err)
      alert('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Success screen ──
  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
               style={{ background: '#F2FAF9' }}>
            <CheckCircle2 className="w-10 h-10" style={{ color: '#00A89D' }} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Claim Submitted!</h2>
          <p className="text-gray-500 mb-2">Your claim reference number is:</p>
          <div className="inline-block px-4 py-2 rounded-xl font-mono font-bold text-lg mb-6"
               style={{ background: '#F2FAF9', color: '#003C3A' }}>
            {claimId}
          </div>
          <p className="text-gray-500 text-sm mb-8">
            We have received your claim and it is now being processed. You will receive
            an email confirmation shortly. Most claims are decided within 2 business days.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => router.push('/claims')}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm"
              style={{ background: 'linear-gradient(135deg, #003C3A, #00A89D)' }}>
              View My Claims
            </button>
            <button
              onClick={() => { setSubmitted(false); setStep(0); setForm(initialForm); setFiles([]) }}
              className="w-full py-3 rounded-xl text-gray-600 font-semibold text-sm
                         bg-gray-100 hover:bg-gray-200 transition-colors">
              Submit Another Claim
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="text-white py-8 px-4"
           style={{ background: 'linear-gradient(135deg, #003C3A 0%, #005C58 60%, #00A89D 100%)' }}>
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold">Submit a Claim</h1>
          <p className="text-white/70 text-sm mt-1">
            Complete all steps to submit your healthcare claim
          </p>
        </div>
      </div>

      {/* Form Card */}
      <div className="max-w-2xl mx-auto px-4 -mt-4 pb-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
          <StepIndicator current={step} steps={STEPS} />

          {/* ── STEP 0: Claim Type ── */}
          {step === 0 && (
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
                <div className="space-y-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Pre-authorized claim?</p>
                      <p className="text-xs text-gray-400">Was this treatment pre-approved by Laya?</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => update('isPreAuthorized', !form.isPreAuthorized)}
                      className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                        form.isPreAuthorized ? 'bg-teal-500' : 'bg-gray-300'
                      }`}>
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white
                                        shadow transition-transform duration-200 ${
                        form.isPreAuthorized ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>

                  <Field label="Treatment country">
                    <Select value={form.treatmentCountry}
                            onChange={e => update('treatmentCountry', e.target.value)}>
                      <option>Ireland</option>
                      <option>Abroad</option>
                    </Select>
                  </Field>

                  <Field label="Brief description (optional)">
                    <textarea
                      value={form.description}
                      onChange={e => update('description', e.target.value)}
                      placeholder="Brief description of the treatment or reason for claim..."
                      rows={3}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm
                                 text-gray-900 placeholder-gray-400 bg-white focus:outline-none
                                 resize-none transition-all"
                      onFocus={e => e.target.style.boxShadow = '0 0 0 2px #00A89D40'}
                      onBlur={e  => e.target.style.boxShadow = 'none'}
                    />
                  </Field>
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
              <p className="text-gray-500 text-sm mb-6">
                Please review your claim details before submitting
              </p>

              <div className="space-y-4">
                {/* Claim type */}
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Claim Type
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{form.claimType}</span>
                    {form.isPreAuthorized && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: '#F2FAF9', color: '#00A89D' }}>
                        Pre-authorized
                      </span>
                    )}
                    <span className="text-xs text-gray-500">· {form.treatmentCountry}</span>
                  </div>
                  {form.description && (
                    <p className="text-sm text-gray-500 mt-1">{form.description}</p>
                  )}
                </div>

                {/* Treatment */}
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    Treatment Details
                  </p>
                  <div className="grid grid-cols-2 gap-y-2 text-sm">
                    <span className="text-gray-500">Service date:</span>
                    <span className="font-medium text-gray-900">{form.serviceDate}</span>
                    <span className="text-gray-500">Service type:</span>
                    <span className="font-medium text-gray-900">{form.serviceType}</span>
                    {form.serviceLocation && (<>
                      <span className="text-gray-500">Location:</span>
                      <span className="font-medium text-gray-900">{form.serviceLocation}</span>
                    </>)}
                    {form.claimType === 'Inpatient' && (<>
                      <span className="text-gray-500">Admission:</span>
                      <span className="font-medium text-gray-900">{form.admissionDate}</span>
                      <span className="text-gray-500">Discharge:</span>
                      <span className="font-medium text-gray-900">{form.dischargeDate}</span>
                    </>)}
                  </div>
                </div>

                {/* Provider */}
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    Provider
                  </p>
                  <div className="grid grid-cols-2 gap-y-2 text-sm">
                    <span className="text-gray-500">Name:</span>
                    <span className="font-medium text-gray-900">{form.providerName}</span>
                    <span className="text-gray-500">Type:</span>
                    <span className="font-medium text-gray-900">{form.providerType}</span>
                  </div>
                </div>

                {/* Amount */}
                <div className="p-4 rounded-xl border-2 border-teal-100"
                     style={{ background: '#F2FAF9' }}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Claim Amount
                  </p>
                  <p className="text-2xl font-bold" style={{ color: '#003C3A' }}>
                    {form.currency} {Number(form.totalAmount).toFixed(2)}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Reimbursement to: {form.reimbursementType}
                  </p>
                </div>

                {/* Documents */}
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Documents ({files.length})
                  </p>
                  {files.length === 0 ? (
                    <p className="text-sm text-amber-600 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      No documents attached — your claim may be delayed
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {files.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <FileText className="w-4 h-4 text-teal-500" />
                          <span className="text-gray-700 truncate">{f.file.name}</span>
                          <span className="text-gray-400 text-xs">({f.docType})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* GDPR Consent */}
                <div className="p-4 border border-gray-200 rounded-xl">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" required id="gdpr"
                           className="mt-0.5 rounded accent-teal-600" />
                    <span className="text-xs text-gray-600">
                      I confirm that all information provided is correct and I consent to Laya
                      Healthcare processing this claim and my personal/medical data in accordance
                      with their Privacy Policy and GDPR regulations.
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ── Navigation Buttons ── */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
            {step > 0 ? (
              <button type="button" onClick={back}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm
                                 font-medium text-gray-600 bg-gray-100 hover:bg-gray-200
                                 transition-colors">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            ) : (
              <button type="button" onClick={() => router.push('/dashboard')}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm
                                 font-medium text-gray-500 hover:text-gray-700 transition-colors">
                <ChevronLeft className="w-4 h-4" /> Cancel
              </button>
            )}

            {step < STEPS.length - 1 ? (
              <button type="button" onClick={next}
                      disabled={step === 0 && !form.claimType}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm
                                 font-semibold text-white transition-all hover:-translate-y-0.5
                                 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
                      style={{ background: 'linear-gradient(135deg, #003C3A, #00A89D)' }}>
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button type="button" onClick={handleSubmit} disabled={submitting}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm
                                 font-semibold text-white transition-all hover:-translate-y-0.5
                                 disabled:opacity-60 disabled:cursor-not-allowed"
                      style={{ background: 'linear-gradient(135deg, #003C3A, #00A89D)' }}>
                {submitting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
                  : <><CheckCircle2 className="w-4 h-4" /> Submit Claim</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
