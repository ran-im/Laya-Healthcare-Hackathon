'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { mapDecisionToRouting, mapDecisionToUiStatus } from '@/lib/claim-status'
import type { DecisionEvidenceItem, HybridDecisionResult, TriggeredRuleSummary } from '@/types'
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
  ai_decision?: string | null
  engine_status?: string | null
  assessor_notes: string | null; rejection_reason: string | null
  submitted_at: string; updated_at: string
  decision_result?: HybridDecisionResult
  member_id?: string
  member_already_paid?: boolean | null
  reimbursement_type?: string | null
  contact_email?: string | null
  provider_registration?: string | null
  submission_date?: string | null
  account_holder_name?: string | null
  iban?: string | null
  bic?: string | null
  profiles?: { full_name: string; member_id: string; policy_id?: string; plan_name: string; email: string }
}

interface Document {
  id: string; document_type: string; file_name: string; file_url: string | null; file_size: number; file_path: string | null
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const demoFallbackByEmail: Record<string, { member_id: string; policy_id: string; member_name: string }> = {
  'member@laya-demo.com': {
    member_id: 'M-1001',
    policy_id: 'P-2001',
    member_name: 'Aisha Khan',
  },
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

function formatScoreLabel(key: string) {
  if (key === 'amount_baseline_eur') return 'Baseline Price (EUR)'
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function splitExplanationItems(text: string) {
  const rawItems = text
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((part) => {
      if (part.startsWith('Triggered rules:')) {
        const rulesText = part.replace(/^Triggered rules:\s*/, '').trim()
        return rulesText
          .split(/(?=(?:[A-Z]{3,5}-\d{3}\s*-))/)
          .map((rule) => rule.trim())
          .filter(Boolean)
      }

      return [part]
    })

  const mergedItems: string[] = []
  for (const item of rawItems) {
    const previous = mergedItems[mergedItems.length - 1]
    if (
      previous &&
      /^[A-Z]$/.test(previous) &&
      /^[A-Z]{2,5}-\d{3}\b/.test(item)
    ) {
      mergedItems[mergedItems.length - 1] = `${previous}${item}`
    } else {
      mergedItems.push(item)
    }
  }

  return mergedItems
}

function ExplanationList({ text }: { text: string }) {
  const items = splitExplanationItems(text)

  return (
    <ul style={{ margin: 0, paddingLeft: '20px', display: 'grid', gap: '10px', color: '#374151' }}>
      {items.map((item, index) => {
        const labelled = item.match(/^(Claim impact|Final decision|Next action|Evidence sources considered|Lead rule|Rule impact)\s*:\s*(.+)$/i)
        const ruleMatch = item.match(/^([A-Z]{3,5}-\d{3}\s*-\s*[^:]+):\s*(.+)$/)

        if (labelled) {
          return (
            <li key={`${item}-${index}`} style={{ lineHeight: 1.6 }}>
              <strong style={{ color: '#111827' }}>{labelled[1]}:</strong> {labelled[2]}
            </li>
          )
        }

        if (ruleMatch) {
          return (
            <li key={`${item}-${index}`} style={{ lineHeight: 1.6 }}>
              <strong style={{ color: '#111827' }}>{ruleMatch[1]}</strong>: {ruleMatch[2]}
            </li>
          )
        }

        return (
          <li key={`${item}-${index}`} style={{ lineHeight: 1.6 }}>
            {item}
          </li>
        )
      })}
    </ul>
  )
}

function formatTraceText(text: unknown) {
  const normalizedText =
    typeof text === 'string'
      ? text
      : Array.isArray(text)
      ? text.map((item) => (typeof item === 'string' ? item : JSON.stringify(item))).join(' | ')
      : text && typeof text === 'object'
      ? JSON.stringify(text)
      : String(text ?? '')

  return normalizedText
    .replace(/([a-z\)])([A-Z])/g, '$1 $2')
    .replace(/([A-Z_])([A-Z][a-z])/g, '$1 $2')
    .replace(/\|/g, '\n')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function TraceBlock({ text }: { text: unknown }) {
  const lines = formatTraceText(text)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  return (
    <div style={{ display: 'grid', gap: '8px' }}>
      {lines.map((line, index) => (
        <div
          key={`${line}-${index}`}
          style={{
            padding: '10px 12px',
            borderRadius: '10px',
            background: '#F9FAFB',
            border: '1px solid #E5E7EB',
            color: '#374151',
            lineHeight: 1.6,
          }}
        >
          {line}
        </div>
      ))}
    </div>
  )
}

function renderInlineBold(text: string) {
  const parts = text.split(/(\*\*.*?\*\*)/g).filter(Boolean)

  return parts.map((part, index) => {
    const boldMatch = part.match(/^\*\*(.*?)\*\*$/)
    if (boldMatch) {
      return <strong key={`${part}-${index}`} style={{ color: '#111827' }}>{boldMatch[1]}</strong>
    }
    return part
  })
}

function AssistantSummaryCard({ text }: { text: string }) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)

  return (
    <div style={{ display: 'grid', gap: '10px' }}>
      {lines.map((line, index) => {
        if (line.startsWith('# ')) {
          return (
            <div key={`${line}-${index}`} style={{ fontSize: '16px', fontWeight: 800, color: '#111827' }}>
              {line.replace(/^# /, '')}
            </div>
          )
        }

        if (line.startsWith('## ')) {
          return (
            <div key={`${line}-${index}`} style={{ fontSize: '13px', fontWeight: 700, color: '#003C3A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {line.replace(/^## /, '')}
            </div>
          )
        }

        if (line.startsWith('### ')) {
          return (
            <div key={`${line}-${index}`} style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>
              {line.replace(/^### /, '')}
            </div>
          )
        }

        if (line.startsWith('- ')) {
          return (
            <div key={`${line}-${index}`} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', color: '#374151', lineHeight: 1.6 }}>
              <span style={{ color: '#00A89D', fontWeight: 700 }}>•</span>
              <span>{renderInlineBold(line.replace(/^- /, ''))}</span>
            </div>
          )
        }

        return (
          <div key={`${line}-${index}`} style={{ color: '#374151', lineHeight: 1.6 }}>
            {renderInlineBold(line)}
          </div>
        )
      })}
    </div>
  )
}

function MarkdownMessage({ text }: { text: string }) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)

  return (
    <div style={{ display: 'grid', gap: '10px' }}>
      {lines.map((line, index) => {
        if (line.startsWith('# ')) {
          return (
            <div key={`${line}-${index}`} style={{ fontSize: '16px', fontWeight: 800, color: '#111827' }}>
              {line.replace(/^# /, '')}
            </div>
          )
        }

        if (line.startsWith('## ')) {
          return (
            <div key={`${line}-${index}`} style={{ fontSize: '13px', fontWeight: 700, color: '#003C3A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {line.replace(/^## /, '')}
            </div>
          )
        }

        if (line.startsWith('### ')) {
          return (
            <div key={`${line}-${index}`} style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>
              {line.replace(/^### /, '')}
            </div>
          )
        }

        if (line.startsWith('- ')) {
          return (
            <div key={`${line}-${index}`} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', color: '#374151', lineHeight: 1.6 }}>
              <span style={{ color: '#00A89D', fontWeight: 700 }}>•</span>
              <span>{renderInlineBold(line.replace(/^- /, ''))}</span>
            </div>
          )
        }

        if (/^\d+\.\s/.test(line)) {
          const [, number, content] = line.match(/^(\d+)\.\s(.+)$/) ?? []
          return (
            <div key={`${line}-${index}`} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', color: '#374151', lineHeight: 1.6 }}>
              <span style={{ color: '#003C3A', fontWeight: 700, minWidth: '18px' }}>{number}.</span>
              <span>{renderInlineBold(content)}</span>
            </div>
          )
        }

        return (
          <div key={`${line}-${index}`} style={{ color: '#374151', lineHeight: 1.6 }}>
            {renderInlineBold(line)}
          </div>
        )
      })}
    </div>
  )
}

function needsFullHybridResult(decisionResult: HybridDecisionResult | null | undefined) {
  if (!decisionResult) return true

  const scorecard = decisionResult.scorecard as Record<string, unknown> | null | undefined
  const hasRichScorecard =
    !!scorecard &&
    (
      'amount_baseline_eur' in scorecard ||
      'auto_approve_probability' in scorecard ||
      'provider_risk_score' in scorecard ||
      'historical_member_claim_count' in scorecard
    )

  return !hasRichScorecard
}

function buildAssistantSummary(engine: HybridDecisionResult | null, claim: Claim | null) {
  if (!engine) return null

  const finalDecision = engine.final_decision ?? engine.decision ?? claim?.status ?? 'UNDER REVIEW'
  const leadRule = engine.triggered_rules_summary?.[0]
  const supportingRules = (engine.triggered_rules_summary ?? []).slice(1, 4)
  const source = engine.decision_source ?? 'rules'
  const confidence =
    typeof engine.llm_confidence === 'number'
      ? `${Math.round(engine.llm_confidence * 100)}% confidence`
      : null

  const lines = [
    '# Claim Assessment',
    '## Decision Summary',
    `**${finalDecision}**`,
    `Decision source: \`${source}\``,
    confidence && engine.llm_decision ? `LLM recommendation: **${engine.llm_decision}** (${confidence})` : null,
    leadRule ? '## Main Rule' : null,
    leadRule ? `**${leadRule.rule_id} - ${leadRule.rule_name}**` : null,
    leadRule?.rule_explanation ?? null,
    leadRule ? '## Claim Impact' : null,
    leadRule?.claim_explanation ?? null,
    supportingRules.length > 0 ? '## Supporting Rules' : null,
    ...supportingRules.map((rule) => `- **${rule.rule_id} - ${rule.rule_name}**: ${rule.claim_explanation}`),
    engine.final_display_summary ? '## Recommended Display Text' : null,
    engine.final_display_summary ? `\`${engine.final_display_summary}\`` : null,
  ].filter(Boolean)

  return lines.join('\n')
}

export default function AIReviewPage() {
  const router  = useRouter()
  const params  = useParams()
  const supabase = createClient()
  const chatEndRef = useRef<HTMLDivElement>(null)
  const routeId = Array.isArray(params.id) ? params.id[0] : params.id

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
  const [requestedDocs, setRequestedDocs] = useState<string[]>([])
  const [showStatusOverride, setShowStatusOverride] = useState(false)
  const [decisionMessage, setDecisionMessage] = useState('')

  // Rule Explanation
  const [ruleExplanation, setRuleExplanation] = useState('')
  const [explainingRules, setExplainingRules] = useState(false)

  // Engine and Rule Arrays
  const engine = (claim?.decision_result ?? null) as HybridDecisionResult | null
  const triggeredRules = engine?.triggered_rules_summary ?? []
  const rejectedRules =
    engine?.all_rule_results?.filter((r) => (r as { outcome?: string }).outcome === 'REJECT') ??
    []
  const needsInfoRules =
    engine?.all_rule_results?.filter((r) => (r as { outcome?: string }).outcome === 'NEEDS_INFO') ??
    []
  const reviewRules =
    engine?.all_rule_results?.filter((r) => (r as { outcome?: string }).outcome === 'HUMAN_REVIEW') ??
    []
  const fraudRules =
    engine?.all_rule_results?.filter((r) => (r as { outcome?: string }).outcome === 'FRAUD_INVESTIGATION') ??
    []
  const evidenceUsed = engine?.evidence_used ?? []
  const policySources = evidenceUsed.filter((e) =>
    ['policy', 'policy_chunk', 'benefit_table', 'schedule_of_benefits'].includes(String(e?.source ?? '').toLowerCase())
  )
  const scorecard = engine?.scorecard as
    | {
        fraud_score?: number
        complexity_score?: number
        anomaly_score?: number
      }
    | undefined
  const resolvedFraudScore =
    typeof scorecard?.fraud_score === 'number' ? scorecard.fraud_score : (claim?.fraud_score ?? 0)
  const resolvedComplexityScore =
    typeof scorecard?.complexity_score === 'number' ? scorecard.complexity_score : (claim?.complexity_score ?? 0)
  const resolvedAnomalyScore =
    typeof scorecard?.anomaly_score === 'number' ? scorecard.anomaly_score : (claim?.anomaly_score ?? 0)
  const reviewScorecard = {
    fraud_score: resolvedFraudScore,
    complexity_score: resolvedComplexityScore,
    anomaly_score: resolvedAnomalyScore,
    ...(scorecard ?? {}),
  }
  const hasReviewScorecard = Object.values(reviewScorecard).some(
    (value) => value !== null && value !== undefined
  )
  const finalDecision =
    engine?.final_decision ??
    (engine?.decision_source === 'llm' && engine?.llm_decision
      ? engine.llm_decision
      : engine?.decision ?? engine?.llm_decision ?? claim?.status ?? null)
  const hasRuleConflict =
    typeof engine?.conflicts_with_rule_engine === 'boolean'
      ? engine.conflicts_with_rule_engine
      : engine?.decision_source === 'llm' && !!engine?.llm_decision && !!engine?.decision && engine.llm_decision !== engine.decision
  const effectiveStatus = finalDecision ? mapDecisionToUiStatus(finalDecision) : claim?.status ?? 'Submitted'
  const currentInfoRequest = engine?.info_request ?? null
  const suggestedRequestedDocs = Array.from(new Set([
    ...(engine?.missing_documents ?? []),
    ...((engine?.llm_missing_items ?? []).filter((item) => !item.includes(':'))),
  ]))

  useEffect(() => { loadData() }, [routeId])
  useEffect(() => {
    async function syncDerivedStatus() {
      if (!claim?.id || !finalDecision) return

      const nextStatus = mapDecisionToUiStatus(finalDecision)
      const nextRouting = mapDecisionToRouting(finalDecision)
      const updates: Record<string, unknown> = {}

      if (claim.status !== nextStatus) {
        updates.status = nextStatus
      }
      if (claim.routing !== nextRouting) {
        updates.routing = nextRouting
      }
      if (claim.ai_decision !== finalDecision) {
        updates.ai_decision = finalDecision
      }
      if (claim.engine_status !== finalDecision) {
        updates.engine_status = finalDecision
      }

      if (Object.keys(updates).length === 0) return

      updates.updated_at = new Date().toISOString()

      const { error } = await supabase
        .from('claims')
        .update(updates)
        .eq('id', claim.id)

      if (!error) {
        setClaim((prev) => prev ? { ...prev, ...updates } as Claim : prev)
      } else {
        console.warn('Could not sync derived claim status:', error.message)
      }
    }

    syncDerivedStatus()
  }, [claim?.id, claim?.status, claim?.routing, claim?.ai_decision, claim?.engine_status, finalDecision, supabase])
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat])
  useEffect(() => {
    if (decision === 'info') {
      if (currentInfoRequest?.requested_documents?.length) {
        setRequestedDocs(currentInfoRequest.requested_documents)
      } else if (requestedDocs.length === 0) {
        setRequestedDocs(suggestedRequestedDocs)
      }
    }
  }, [decision, currentInfoRequest?.requested_documents, suggestedRequestedDocs.join('|')])

  async function loadData() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: reviewerProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (reviewerProfile?.role === 'member') {
        router.push('/dashboard')
        return
      }

      let claimData: Claim | null = null

      const { data: candidateClaims } = await supabase
        .from('claims')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)

      if (candidateClaims) {
        claimData =
          (candidateClaims.find((c) => c.id === routeId) as Claim | undefined) ??
          (candidateClaims.find((c) => c.claim_id === routeId) as Claim | undefined) ??
          (candidateClaims.find((c) => (c as { claim_reference?: string | null }).claim_reference === routeId) as Claim | undefined) ??
          null
      }

      if (!claimData) {
        const { data: byId } = await supabase
          .from('claims')
          .select('*')
          .eq('id', routeId)
          .maybeSingle()

        const { data: byClaimId } = await supabase
          .from('claims')
          .select('*')
          .eq('claim_id', routeId)
          .maybeSingle()

        const { data: byReference } = await supabase
          .from('claims')
          .select('*')
          .eq('claim_reference', routeId)
          .maybeSingle()

        claimData = (byId as Claim | null) ?? (byClaimId as Claim | null) ?? (byReference as Claim | null) ?? null
      }

      if (claimData) {
        const { data: docsData } = await supabase
          .from('claim_documents')
          .select('*')
          .eq('claim_id', claimData.id)

        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name, member_id, policy_id, plan_name, email')
          .eq('id', claimData.member_id)
          .single()
        const normalizedProfile = profileData ?? undefined

        let hydratedClaim: Claim = { ...claimData, profiles: normalizedProfile }
        if (needsFullHybridResult(hydratedClaim.decision_result ?? null)) {
          const evaluatedDecision = await evaluateHybridDecision(hydratedClaim, normalizedProfile, docsData ?? [])
          if (evaluatedDecision) {
            hydratedClaim = { ...hydratedClaim, decision_result: evaluatedDecision }
          }
        }

        setClaim(hydratedClaim)
        setApprovedAmt(claimData.total_amount?.toString() || '')
        // If AI summary already exists, add to chat
        const assistantSummary =
          claimData.decision_result?.ai_assistant_summary ??
          buildAssistantSummary(claimData.decision_result ?? null, claimData)

        if (assistantSummary) {
          setChat([{
            role: 'assistant',
            content: assistantSummary,
            timestamp: new Date(),
          }])
        } else if (claimData.ai_summary) {
          setChat([{
            role: 'assistant',
            content: claimData.ai_summary,
            timestamp: new Date(),
          }])
        }
        if (docsData) setDocs(docsData)
      }
    } finally { setLoading(false) }
  }

  async function evaluateHybridDecision(
    claimRecord: Claim,
    profileData: Claim['profiles'],
    documents: Document[]
  ): Promise<HybridDecisionResult | null> {
    const fallback = claimRecord.contact_email ? demoFallbackByEmail[claimRecord.contact_email] : undefined
    const memberId = profileData?.member_id ?? fallback?.member_id ?? ''
    const policyId = profileData?.policy_id ?? fallback?.policy_id ?? ''

    if (!memberId || !policyId) {
      return null
    }

    const payload = {
      member_id: memberId,
      policy_id: policyId,
      member_name: profileData?.full_name ?? fallback?.member_name ?? 'Unknown member',
      contact_email: claimRecord.contact_email ?? profileData?.email ?? '',
      contact_phone: null,
      claim_type: claimRecord.claim_type,
      service_type: claimRecord.service_type,
      treatment_country: claimRecord.treatment_country === 'Abroad' ? 'Abroad' : 'Ireland',
      short_description: claimRecord.description ?? null,
      service_date: claimRecord.service_date,
      admission_date: claimRecord.admission_date ?? null,
      discharge_date: claimRecord.discharge_date ?? null,
      provider_name: claimRecord.provider_name,
      provider_type: claimRecord.provider_type,
      provider_registration_id: claimRecord.provider_registration ?? null,
      amount_claimed_eur: Number(claimRecord.total_amount),
      currency: claimRecord.currency,
      member_already_paid: claimRecord.member_already_paid ?? true,
      reimbursement_type: claimRecord.reimbursement_type ?? 'Pay member',
      account_holder_name: claimRecord.account_holder_name ?? claimRecord.decision_result?.submitted_claim_input?.account_holder_name ?? null,
      iban: claimRecord.iban ?? claimRecord.decision_result?.submitted_claim_input?.iban ?? null,
      bic_swift:
        claimRecord.bic ??
        claimRecord.decision_result?.submitted_claim_input?.bic_swift ??
        claimRecord.decision_result?.submitted_claim_input?.bic ??
        null,
      document_types: documents.map((doc) => doc.document_type.toLowerCase().replace(/ /g, '_')),
      pre_authorized: claimRecord.is_pre_authorized,
      declaration_confirmed: true,
      consent_medical_data: true,
      terms_accepted: true,
      submission_date: claimRecord.submission_date?.split('T')[0] ?? new Date().toISOString().split('T')[0],
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_FASTAPI_URL}/api/claims/evaluate-hybrid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const decisionJson = await response.json()
    if (!response.ok) {
      console.warn('Hybrid evaluation fallback failed:', decisionJson)
      return null
    }

    const evaluatedDecision = decisionJson as HybridDecisionResult
    const resolvedDecision = evaluatedDecision.final_decision ?? evaluatedDecision.decision
    const scorecard = evaluatedDecision.scorecard as { fraud_score?: number; complexity_score?: number; anomaly_score?: number } | undefined

    await supabase
      .from('claims')
      .update({
        status: mapDecisionToUiStatus(resolvedDecision),
        routing: mapDecisionToRouting(resolvedDecision),
        engine_status: resolvedDecision,
        ai_decision: resolvedDecision,
        ai_decision_reason: evaluatedDecision.decision_with_rules_explanation ?? evaluatedDecision.final_display_summary ?? null,
        decision_result: evaluatedDecision,
        claim_reference: evaluatedDecision.claim_reference ?? claimRecord.claim_id,
        decision: evaluatedDecision.decision ?? null,
        final_decision: resolvedDecision,
        decision_source: evaluatedDecision.decision_source ?? 'rules',
        final_display_summary: evaluatedDecision.final_display_summary ?? null,
        member_decision_summary: evaluatedDecision.member_decision_summary ?? null,
        member_explanation_llm: evaluatedDecision.member_explanation_llm ?? null,
        llm_decision: evaluatedDecision.llm_decision ?? null,
        llm_confidence: evaluatedDecision.llm_confidence ?? null,
        triggered_rules_summary: evaluatedDecision.triggered_rules_summary ?? [],
        decision_evidence: evaluatedDecision.evidence_used ?? [],
        assessor_explanation_llm: evaluatedDecision.assessor_explanation_llm ?? null,
        missing_documents: evaluatedDecision.missing_documents ?? [],
        missing_information: evaluatedDecision.missing_information ?? [],
        fraud_score: typeof scorecard?.fraud_score === 'number' ? scorecard.fraud_score : null,
        complexity_score: typeof scorecard?.complexity_score === 'number' ? scorecard.complexity_score : null,
        anomaly_score: typeof scorecard?.anomaly_score === 'number' ? scorecard.anomaly_score : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', claimRecord.id)

    return evaluatedDecision
  }

  // ── View Document ──
  async function viewDocument(filePath: string) {
    const { data } = supabase.storage
      .from('claim-documents')
      .getPublicUrl(filePath)
    
    if (data?.publicUrl) {
      window.open(data.publicUrl, '_blank')
      return
    }

    const { data: signed, error } = await supabase.storage
      .from('claim-documents')
      .createSignedUrl(filePath, 3600)
    
    if (signed?.signedUrl) {
      window.open(signed.signedUrl, '_blank')
    } else {
      alert('Could not open document: ' + error?.message)
    }
  }

  // ── Generate AI Summary ──
  async function generateSummary() {
    if (!claim) return
    setGenerating(true)
    try {
      const assistantSummary =
        claim.decision_result?.ai_assistant_summary ??
        buildAssistantSummary(claim.decision_result ?? null, claim)

      if (assistantSummary) {
        setChat([{
          role: 'assistant',
          content: assistantSummary,
          timestamp: new Date(),
        }])
        return
      }
    } catch {
      setChat(prev => [...prev, {
        role: 'assistant',
        content: 'Error generating claim analysis. Please reload the claim and try again.',
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
    setDecisionMessage('')
    try {
      const res = await fetch('/api/claims/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          claimId: claim.id, 
          decision: decision,
          amount: decision === 'approve' ? approvedAmt : undefined,
          reason: decision === 'reject' ? rejectionReason : undefined,
          infoRequest: decision === 'info'
            ? {
                requested_at: new Date().toISOString(),
                message: assessorNotes || 'Please provide the requested documents so we can continue reviewing your claim.',
                requested_documents: requestedDocs,
                allow_additional_upload: true,
              }
            : undefined,
        })
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not update claim decision')

      const statusMap = { approve: 'Approved', reject: 'Rejected', info: 'Info Required' } as const
      const updatedStatus = data.status ?? statusMap[decision]
      const updatedRouting = data.routing ?? mapDecisionToRouting(data.normalizedDecision ?? finalDecision)
      const updatedEngineStatus = data.normalizedDecision ?? finalDecision ?? null

      setClaim((prev) => prev ? {
        ...prev,
        status: updatedStatus,
        routing: updatedRouting,
        ai_decision: updatedEngineStatus,
        engine_status: updatedEngineStatus,
        updated_at: new Date().toISOString(),
      } : prev)

      if (Array.isArray(data.warnings) && data.warnings.length > 0) {
        console.warn('Assessor decision completed with warnings:', data.warnings)
      }

      router.push('/assessor-dashboard')
    } catch (error) {
      console.error('Assessor decision failed:', error)
      setDecisionMessage(error instanceof Error ? error.message : 'Could not update claim decision')
    } finally { setDeciding(false) }
  }

  // ── Explain Rules ──
  async function explainRules() {
    if (!engine) return

    const selectedRules =
      finalDecision === 'REJECT'
        ? rejectedRules
        : finalDecision === 'NEEDS_INFO'
        ? needsInfoRules
        : finalDecision === 'HUMAN_REVIEW'
        ? reviewRules
        : finalDecision === 'FRAUD_INVESTIGATION'
        ? fraudRules
        : triggeredRules.length > 0
        ? triggeredRules
        : engine.all_rule_results ?? []

    setExplainingRules(true)
    try {
      const res = await fetch('/api/rules/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: finalDecision,
          rules: selectedRules,
        }),
      })

      const data = await res.json()
      setRuleExplanation(data.text || '')
    } finally {
      setExplainingRules(false)
    }
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

  const fs = scoreColor(Math.round(resolvedFraudScore * 100))
  const cs = scoreColor(Math.round(resolvedComplexityScore * 100))

  function RuleSection({
    title,
    rules,
  }: {
    title: string
    rules: any[]
  }) {
    if (!rules?.length) return null

    return (
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '14px',
          padding: '16px',
          marginTop: '16px',
        }}
      >
        <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 700 }}>
          {title} ({rules.length})
        </h3>

        <div style={{ display: 'grid', gap: '12px' }}>
          {rules.map((rule: any) => (
            <div
              key={`${rule.rule_id}-${rule.message}`}
              style={{
                border: '1px solid #E5E7EB',
                borderRadius: '12px',
                padding: '12px',
                background: '#F9FAFB',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '14px', color: '#111827' }}>
                {rule.rule_id} — {rule.rule_name}
              </div>

              <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
                {rule.outcome} • {rule.category}
                {rule.source_reference ? ` • ${rule.source_reference}` : ''}
              </div>

              {rule.message && (
                <div style={{ marginTop: '8px', fontSize: '14px', color: '#374151' }}>
                  {rule.message}
                </div>
              )}

              {rule.notes && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#6B7280' }}>
                  {rule.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

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
              <div style={{ color:'#9CA3AF', fontSize:'9px', letterSpacing:'2px', textTransform:'uppercase' }}>decision engine review</div>
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
                         background: effectiveStatus === 'Approved' ? '#ECFDF5' :
                                     effectiveStatus === 'Rejected' ? '#FEF2F2' :
                                     effectiveStatus === 'In Review' ? '#FFFBEB' : '#EFF6FF',
                         color:      effectiveStatus === 'Approved' ? '#059669' :
                                     effectiveStatus === 'Rejected' ? '#DC2626' :
                                     effectiveStatus === 'In Review' ? '#D97706' : '#2563EB' }}>
            {effectiveStatus}
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
                { label:'Fraud Score',      value: Math.round(resolvedFraudScore * 100),      style: fs },
                { label:'Complexity Score', value: Math.round(resolvedComplexityScore * 100),  style: cs },
                { label:'Anomaly Score',    value: Math.round(resolvedAnomalyScore * 100),
                  style: scoreColor(Math.round(resolvedAnomalyScore * 100)) },
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
                    {doc.file_path && (
                      <button onClick={() => viewDocument(doc.file_path!)}
                        style={{ padding:'6px 10px', borderRadius:'8px', background:'#003C3A',
                                 color:'white', fontSize:'11px', fontWeight:600, display:'flex',
                                 alignItems:'center', gap:'4px', border:'none', cursor:'pointer' }}>
                        <Download size={12} /> View
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ENGINE DECISION PANELS */}
          {engine && (
              <>
                {/* Model Decision */}
                {(finalDecision || engine.internal_summary) && (
                  <div style={{ background:'white', borderRadius:'16px', border:'1px solid #F3F4F6',
                                boxShadow:'0 1px 3px rgba(0,0,0,0.05)', padding:'20px 24px' }}>
                    <h3 style={{ fontSize:'14px', fontWeight:600, color:'#111827', margin:'0 0 12px 0' }}>
                      🤖 Model Decision
                    </h3>
                    {finalDecision && (
                      <p style={{ fontSize:'13px', fontWeight:700, color:
                        finalDecision === 'APPROVE' ? '#059669' :
                        finalDecision === 'REJECT' ? '#DC2626' :
                        finalDecision === 'NEEDS_INFO' ? '#D97706' : '#6B7280',
                        margin:'0 0 8px 0' }}>
                        {finalDecision === 'APPROVE' ? '✓' :
                         finalDecision === 'REJECT' ? '✗' :
                         finalDecision === 'NEEDS_INFO' ? '📋' : '→'} {finalDecision}
                      </p>
                    )}
                    {engine.internal_summary && (
                      <p style={{ fontSize:'13px', color:'#374151', lineHeight:1.6, margin:0 }}>
                        {engine.internal_summary}
                      </p>
                    )}
                  </div>
                )}

                {/* Decision Engine Output */}
                {engine && (
                  <div
                    style={{
                      background: '#F8FAFC',
                      border: '1px solid #E5E7EB',
                      borderRadius: '14px',
                      padding: '16px',
                      marginTop: '16px',
                    }}
                  >
                    <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: 700 }}>
                      Decision Engine Output
                    </h3>

                    <div style={{ display: 'grid', gap: '6px', marginBottom: '8px' }}>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: '#111827' }}>
                        Decision: {engine.decision || finalDecision || claim.status}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: '#111827' }}>
                        Final Decision: {finalDecision || claim.status}
                      </div>
                      <div style={{ fontSize: '13px', color: '#4B5563' }}>
                        Source: {engine.decision_source ?? 'rules'}
                      </div>
                    </div>

                    {(engine.decision_with_rules_explanation || engine.final_display_summary) && (
                      <div style={{ marginBottom: '8px' }}>
                        <ExplanationList text={engine.decision_with_rules_explanation || engine.final_display_summary} />
                      </div>
                    )}

                    {engine.next_action_text && (
                      <p style={{ margin: 0, color: '#374151' }}>
                        <strong>Next action:</strong> {engine.next_action_text}
                      </p>
                    )}
                  </div>
                )}

                {/* Grounded Decision Panels */}
                {engine && (
                  <div
                    style={{
                      display: 'grid',
                      gap: '16px',
                      marginTop: '16px',
                    }}
                  >
                    <div style={{
                      padding: '16px',
                      borderRadius: '12px',
                      background: '#F8FAFC',
                      border: '1px solid #E5E7EB',
                    }}>
                      <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: 700 }}>
                        Final Decision
                      </h3>
                      <p style={{ margin: '0 0 8px 0', color: '#111827', fontWeight: 700 }}>
                        {finalDecision || claim.status}
                      </p>
                      <p style={{ margin: 0, color: '#4B5563' }}>
                        Source: {engine.decision_source ?? 'rules'}
                        {typeof engine.llm_confidence === 'number' ? ` · LLM confidence: ${engine.llm_confidence}` : ''}
                      </p>
                    </div>

                    {(engine.decision_with_rules_explanation || engine.final_display_summary) && (
                      <div style={{
                        padding: '16px',
                        borderRadius: '12px',
                        background: '#FFFFFF',
                        border: '1px solid #E5E7EB',
                      }}>
                        <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: 700 }}>
                          Rule-engine reason
                        </h3>
                        <ExplanationList text={engine.decision_with_rules_explanation || engine.final_display_summary} />
                      </div>
                    )}

                    {engine.assessor_explanation_llm && (
                      <div style={{
                        padding: '16px',
                        borderRadius: '12px',
                        background: '#F8FAFC',
                        border: '1px solid #E5E7EB',
                      }}>
                        <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: 700 }}>
                          LLM grounded explanation
                        </h3>
                        <ExplanationList text={engine.assessor_explanation_llm} />
                      </div>
                    )}

                    {engine.assessor_rule_trace && (
                      <div style={{
                        padding: '16px',
                        borderRadius: '12px',
                        background: '#FFFFFF',
                        border: '1px solid #E5E7EB',
                      }}>
                        <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: 700 }}>
                          Assessor rule trace
                        </h3>
                        <TraceBlock text={engine.assessor_rule_trace} />
                      </div>
                    )}

                    {evidenceUsed.length > 0 && (
                      <div style={{
                        padding: '16px',
                        borderRadius: '12px',
                        background: '#FFFFFF',
                        border: '1px solid #E5E7EB',
                      }}>
                        <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: 700 }}>
                          Evidence used
                        </h3>
                        {evidenceUsed.map((e, i: number) => (
                          <div key={i} style={{ marginBottom: i < evidenceUsed.length - 1 ? 10 : 0, color: '#374151' }}>
                            <strong>{e.source ?? 'Unknown source'}</strong> {e.id ? `- ${e.id}` : ''}
                            {e.why_relevant && <div>{e.why_relevant}</div>}
                          </div>
                        ))}
                      </div>
                    )}

                    {engine.llm_missing_items && engine.llm_missing_items.length > 0 && (
                      <div style={{
                        padding: '16px',
                        borderRadius: '12px',
                        background: '#FFFBEB',
                        border: '1px solid #FDE68A',
                      }}>
                        <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: 700 }}>
                          LLM missing items
                        </h3>
                        <ul style={{ margin: 0, paddingLeft: '20px', color: '#78350F' }}>
                          {engine.llm_missing_items.map((item, index) => (
                            <li key={`${item}-${index}`}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div style={{
                      padding: '16px',
                      borderRadius: '12px',
                      background: hasRuleConflict ? '#FEF2F2' : '#F0FDF4',
                      border: `1px solid ${hasRuleConflict ? '#FECACA' : '#BBF7D0'}`,
                    }}>
                      <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: 700 }}>
                        Conflict with rules?
                      </h3>
                      <p style={{ margin: 0, color: hasRuleConflict ? '#B91C1C' : '#166534', fontWeight: 600 }}>
                        {hasRuleConflict ? 'Yes' : 'No'}
                      </p>
                    </div>

                    {policySources.length > 0 && (
                      <div style={{
                        padding: '16px',
                        borderRadius: '12px',
                        background: '#FFFFFF',
                        border: '1px solid #E5E7EB',
                      }}>
                        <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: 700 }}>
                          Retrieved policy sources
                        </h3>
                        {policySources.map((e, i: number) => (
                          <div key={i} style={{ marginBottom: i < policySources.length - 1 ? 10 : 0, color: '#374151' }}>
                            <strong>{e.source ?? 'Policy source'}</strong> {e.id ? `- ${e.id}` : ''}
                            {e.why_relevant && <div>{e.why_relevant}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {triggeredRules.length > 0 && (
                  <div style={{
                    background: '#FFFFFF',
                    border: '1px solid #E5E7EB',
                    borderRadius: '14px',
                    padding: '16px',
                    marginTop: '16px',
                  }}>
                    <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 700 }}>
                      Triggered Rules Summary ({triggeredRules.length})
                    </h3>
                    <div style={{ display: 'grid', gap: '12px' }}>
                      {triggeredRules.map((rule: TriggeredRuleSummary) => (
                        <div
                          key={`${rule.rule_id}-${rule.outcome}`}
                          style={{
                            border: '1px solid #E5E7EB',
                            borderRadius: '12px',
                            padding: '12px',
                            background: '#F9FAFB',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '6px' }}>
                            <div style={{ fontWeight: 700, fontSize: '14px', color: '#111827' }}>
                              {rule.rule_id} - {rule.rule_name}
                            </div>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: '#6B7280' }}>
                              {rule.outcome}
                            </div>
                          </div>
                          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '8px' }}>
                            {rule.category}
                          </div>
                          <div style={{ fontSize: '13px', color: '#374151', marginBottom: '6px' }}>
                            <strong>Rule explanation:</strong> {rule.rule_explanation}
                          </div>
                          <div style={{ fontSize: '13px', color: '#374151' }}>
                            <strong>Claim explanation:</strong> {rule.claim_explanation}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Explain Rules Button */}
                {engine && (
                  <div style={{ marginTop: '16px' }}>
                    <button
                      onClick={explainRules}
                      disabled={explainingRules}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1px solid #E5E7EB',
                        background: '#FFFFFF',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      {explainingRules ? 'Explaining...' : 'Explain these rules'}
                    </button>
                  </div>
                )}

                {/* Decision-Aware Rule Sections */}
                {finalDecision === 'REJECT' && (
                  <RuleSection title="Rejected by Rules" rules={rejectedRules} />
                )}

                {finalDecision === 'NEEDS_INFO' && (
                  <RuleSection title="Needs More Information" rules={needsInfoRules} />
                )}

                {finalDecision === 'HUMAN_REVIEW' && (
                  <RuleSection title="Manual Review Triggers" rules={reviewRules} />
                )}

                {finalDecision === 'FRAUD_INVESTIGATION' && (
                  <RuleSection title="Fraud Investigation Triggers" rules={fraudRules} />
                )}

                <RuleSection
                  title="Complete Rule Trace"
                  rules={engine?.all_rule_results ?? []}
                />

                {/* Rule Explanation */}
                {ruleExplanation && (
                  <div
                    style={{
                      marginTop: '16px',
                      background: '#F9FAFB',
                      border: '1px solid #E5E7EB',
                      borderRadius: '12px',
                      padding: '16px',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {ruleExplanation}
                  </div>
                )}

                {/* Missing Documents / Information */}
                {((engine.missing_documents?.length ?? 0) > 0 || (engine.missing_information?.length ?? 0) > 0) && (
                  <div style={{ background:'white', borderRadius:'16px', border:'1px solid #F3F4F6',
                                boxShadow:'0 1px 3px rgba(0,0,0,0.05)', padding:'20px 24px' }}>
                    <h3 style={{ fontSize:'14px', fontWeight:600, color:'#111827', margin:'0 0 12px 0' }}>
                      Missing Info
                    </h3>
                    {(engine.missing_documents?.length ?? 0) > 0 && (
                      <div style={{ marginBottom: (engine.missing_information?.length ?? 0) > 0 ? '16px' : 0 }}>
                        <p style={{ margin:'0 0 10px 0', fontSize:'12px', fontWeight:700, color:'#92400E', textTransform:'uppercase', letterSpacing:'0.04em' }}>
                          Missing documents
                        </p>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:'8px' }}>
                          {(engine.missing_documents ?? []).map((doc, index) => (
                            <span
                              key={`${doc}-${index}`}
                              style={{
                                fontSize:'12px',
                                padding:'5px 10px',
                                borderRadius:'999px',
                                background:'#FFFBEB',
                                border:'1px solid #FDE68A',
                                color:'#B45309',
                                fontWeight:600,
                              }}
                            >
                              {doc}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {(engine.missing_information?.length ?? 0) > 0 && (
                      <div>
                        <p style={{ margin:'0 0 10px 0', fontSize:'12px', fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.04em' }}>
                          Missing information
                        </p>
                        <div style={{ display:'grid', gap:'8px' }}>
                          {(engine.missing_information ?? []).map((item, index) => (
                            <div
                              key={`${item}-${index}`}
                              style={{
                                padding:'10px 12px',
                                borderRadius:'10px',
                                background:'#F9FAFB',
                                border:'1px solid #E5E7EB',
                                color:'#374151',
                                fontSize:'13px',
                              }}
                            >
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {currentInfoRequest && (
                  <div style={{ marginTop: '16px', background:'#FFF7ED', border:'1px solid #FED7AA', borderRadius:'14px', padding:'16px' }}>
                    <h3 style={{ margin:'0 0 10px 0', fontSize:'16px', fontWeight:700, color:'#9A3412' }}>
                      Member info request
                    </h3>
                    <p style={{ margin:'0 0 8px 0', color:'#7C2D12', fontWeight:600 }}>
                      Status: {currentInfoRequest.status}
                    </p>
                    {currentInfoRequest.message && (
                      <p style={{ margin:'0 0 10px 0', color:'#7C2D12' }}>{currentInfoRequest.message}</p>
                    )}
                    {currentInfoRequest.requested_documents?.length > 0 && (
                      <div style={{ display:'flex', flexWrap:'wrap', gap:'8px' }}>
                        {currentInfoRequest.requested_documents.map((doc, index) => (
                          <span key={`${doc}-${index}`} style={{ fontSize:'12px', padding:'4px 10px', borderRadius:'999px', background:'white', color:'#B45309', border:'1px solid #FDE68A', fontWeight:600 }}>
                            {doc}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </>
            )}
          {hasReviewScorecard && (
            <div style={{ background:'white', borderRadius:'16px', border:'1px solid #F3F4F6',
                          boxShadow:'0 1px 3px rgba(0,0,0,0.05)', padding:'20px 24px' }}>
              <h3 style={{ fontSize:'14px', fontWeight:600, color:'#111827', margin:'0 0 12px 0' }}>
                Scorecard
              </h3>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:'12px' }}>
                {Object.entries(reviewScorecard)
                  .filter(([, value]) => value !== null && value !== undefined)
                  .map(([key, value]) => {
                    const isNumeric = typeof value === 'number'
                    const isProbability = isNumeric && key !== 'amount_baseline_eur' && value <= 1
                    const displayValue =
                      typeof value === 'number'
                        ? isProbability
                          ? `${Math.round(value * 100)}%`
                          : key === 'amount_baseline_eur'
                          ? `EUR ${value.toFixed(2)}`
                          : value.toFixed(2)
                        : String(value)

                    return (
                      <div
                        key={key}
                        style={{
                          padding:'14px',
                          borderRadius:'12px',
                          background:'#F9FAFB',
                          border:'1px solid #E5E7EB',
                        }}
                      >
                        <div style={{ fontSize:'11px', fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:'6px' }}>
                          {formatScoreLabel(key)}
                        </div>
                        <div style={{ fontSize:'18px', fontWeight:700, color:'#111827' }}>
                          {displayValue}
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
          {['Approved','Rejected','Paid'].includes(effectiveStatus) && !showStatusOverride && (
            <div style={{ background:'white', borderRadius:'16px', border:'1px solid #F3F4F6',
                          boxShadow:'0 1px 3px rgba(0,0,0,0.05)', padding:'20px 24px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'16px', flexWrap:'wrap' }}>
                <div>
                  <h3 style={{ fontSize:'14px', fontWeight:600, color:'#111827', margin:'0 0 6px 0' }}>
                    Status Locked By Current Decision
                  </h3>
                  <p style={{ margin:0, fontSize:'13px', color:'#6B7280', lineHeight:1.5 }}>
                    This claim is currently marked as <strong>{effectiveStatus}</strong>. If you found an issue and need to override it, use the button on the right.
                  </p>
                </div>
                <button
                  onClick={() => setShowStatusOverride(true)}
                  style={{
                    padding:'10px 16px',
                    borderRadius:'10px',
                    border:'1px solid #E5E7EB',
                    background:'#F9FAFB',
                    color:'#111827',
                    fontSize:'13px',
                    fontWeight:600,
                    cursor:'pointer',
                  }}
                >
                  Update Status
                </button>
              </div>
            </div>
          )}
          {(!['Approved','Rejected','Paid'].includes(effectiveStatus) || showStatusOverride) && (
            <div style={{ background:'white', borderRadius:'16px', border:'1px solid #F3F4F6',
                          boxShadow:'0 1px 3px rgba(0,0,0,0.05)', padding:'20px 24px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px', margin:'0 0 16px 0' }}>
                <h3 style={{ fontSize:'14px', fontWeight:600, color:'#111827', margin:0 }}>
                  Issue Decision
                </h3>
                {showStatusOverride && (
                  <button
                    onClick={() => {
                      setShowStatusOverride(false)
                      setDecision(null)
                    }}
                    style={{
                      padding:'8px 12px',
                      borderRadius:'10px',
                      border:'1px solid #E5E7EB',
                      background:'white',
                      color:'#6B7280',
                      fontSize:'12px',
                      fontWeight:600,
                      cursor:'pointer',
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>

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

                  {decision === 'info' && (
                    <>
                      <div>
                        <label style={{ fontSize:'13px', fontWeight:500, color:'#374151',
                                        display:'block', marginBottom:'6px' }}>
                          Request message <span style={{ color:'#D97706' }}>*</span>
                        </label>
                        <textarea value={assessorNotes} onChange={e => setAssessorNotes(e.target.value)}
                          placeholder="Explain what the member needs to provide..."
                          rows={3}
                          style={{ width:'100%', padding:'10px 14px', borderRadius:'10px',
                                   border:'1.5px solid #E5E7EB', fontSize:'13px', resize:'none',
                                   outline:'none', fontFamily:'inherit' }}
                          onFocus={e => e.target.style.borderColor = '#D97706'}
                          onBlur={e  => e.target.style.borderColor = '#E5E7EB'}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize:'13px', fontWeight:500, color:'#374151', display:'block', marginBottom:'8px' }}>
                          Requested documents
                        </label>
                        <div style={{ display:'grid', gap:'8px' }}>
                          {(suggestedRequestedDocs.length > 0 ? suggestedRequestedDocs : ['pre_authorization_letter', 'invoice', 'receipt', 'discharge_summary']).map((doc) => (
                            <label key={doc} style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'13px', color:'#374151' }}>
                              <input
                                type="checkbox"
                                checked={requestedDocs.includes(doc)}
                                onChange={(e) => setRequestedDocs((prev) =>
                                  e.target.checked ? Array.from(new Set([...prev, doc])) : prev.filter((item) => item !== doc)
                                )}
                              />
                              <span>{doc}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {decision !== 'info' && (
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
                  )}

                  <button onClick={submitDecision}
                    disabled={deciding || (decision === 'reject' && !rejectionReason) || (decision === 'info' && !assessorNotes.trim())}
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

                  {decisionMessage && (
                    <div style={{
                      padding:'10px 12px',
                      borderRadius:'10px',
                      background:'#FEF2F2',
                      border:'1px solid #FECACA',
                      color:'#B91C1C',
                      fontSize:'13px',
                      lineHeight:1.5,
                    }}>
                      {decisionMessage}
                    </div>
                  )}
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
                  Claims Intelligence
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
                      {msg.role === 'assistant' ? (
                        <div style={{ margin:'0 0 6px 0' }}>
                          {msg.content.includes('# Claim Assessment') ? (
                            <AssistantSummaryCard text={msg.content} />
                          ) : (
                            <MarkdownMessage text={msg.content} />
                          )}
                        </div>
                      ) : (
                        <p style={{ fontSize:'13px', lineHeight:1.6, margin:'0 0 6px 0',
                                    whiteSpace:'pre-wrap', wordBreak:'break-word' }}>
                          {msg.content}
                        </p>
                      )}
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
