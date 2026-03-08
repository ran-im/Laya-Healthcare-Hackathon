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

// ── Types ──────────────────────────────────────────────
interface Profile {
  id: string
  full_name: string
  email: string
  member_id: string
  plan_name: string
  role: string
}

interface Claim {
  id: string
  claim_id: string
  claim_type: string
  status: string
  provider_name: string
  total_amount: number
  currency: string
  service_date: string
  created_at: string
}

interface Notification {
  id: string
  title: string
  message: string
  type: string
  is_read: boolean
  created_at: string
}

// ── Helpers ────────────────────────────────────────────
function statusConfig(status: string) {
  const map: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
    'Submitted':     { color: '#2563EB', bg: '#EFF6FF', icon: <Clock className="w-3.5 h-3.5" /> },
    'In Review':     { color: '#D97706', bg: '#FFFBEB', icon: <Activity className="w-3.5 h-3.5" /> },
    'Approved':      { color: '#059669', bg: '#ECFDF5', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    'Paid':          { color: '#00A89D', bg: '#F2FAF9', icon: <CreditCard className="w-3.5 h-3.5" /> },
    'Rejected':      { color: '#DC2626', bg: '#FEF2F2', icon: <XCircle className="w-3.5 h-3.5" /> },
    'Info Required': { color: '#EA580C', bg: '#FFF7ED', icon: <AlertCircle className="w-3.5 h-3.5" /> },
  }
  return map[status] || { color: '#6B7280', bg: '#F9FAFB', icon: <Clock className="w-3.5 h-3.5" /> }
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(amount)
}

// ── Stat Card ──────────────────────────────────────────
function StatCard({
  label, value, sub, icon, color
}: {
  label: string; value: string | number; sub?: string
  icon: React.ReactNode; color: string
}) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between mb-4">
        <div className="p-2.5 rounded-xl" style={{ background: color + '18' }}>
          <div style={{ color }}>{icon}</div>
        </div>
      </div>
      <div className="text-2xl font-bold text-gray-900 mb-1">{value}</div>
      <div className="text-sm font-medium text-gray-500">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  )
}

// ── Main Component ──────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [claims, setClaims] = useState<Claim[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [showNotifications, setShowNotifications] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [profileRes, claimsRes, notifRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('claims').select('*').eq('member_id', user.id)
          .order('created_at', { ascending: false }).limit(10),
        supabase.from('notifications').select('*').eq('user_id', user.id)
          .order('created_at', { ascending: false }).limit(5),
      ])

      if (profileRes.data) setProfile(profileRes.data)
      if (claimsRes.data) setClaims(claimsRes.data)
      if (notifRes.data) setNotifications(notifRes.data)
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Computed stats
  const totalClaims = claims.length
  const pendingClaims = claims.filter(c => ['Submitted','In Review'].includes(c.status)).length
  const approvedClaims = claims.filter(c => ['Approved','Paid'].includes(c.status)).length
  const totalPaid = claims.filter(c => c.status === 'Paid').reduce((s, c) => s + c.total_amount, 0)
  const unreadNotifications = notifications.filter(n => !n.is_read).length

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
           style={{ background: 'linear-gradient(135deg, #003C3A 0%, #00A89D 100%)' }}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full
                          animate-spin mx-auto mb-4" />
          <p className="text-white/70 text-sm">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Top Navigation ── */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                   style={{ background: 'linear-gradient(135deg, #003C3A, #00A89D)' }}>
                <Shield className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="font-bold text-gray-900 text-sm leading-none">laya</div>
                <div className="text-gray-400 text-xs tracking-widest uppercase leading-none mt-0.5">
                  healthcare
                </div>
              </div>
            </div>

            {/* Nav Links */}
            <div className="hidden md:flex items-center gap-1">
              {[
                { label: 'Dashboard', href: '/dashboard', active: true },
                { label: 'My Claims', href: '/claims' },
                { label: 'Submit Claim', href: '/submit-claim' },
                { label: 'Benefit Check', href: '/benefit-check' },
              ].map((item) => (
                <a key={item.label} href={item.href}
                   className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                   style={{
                     background: item.active ? '#F2FAF9' : 'transparent',
                     color: item.active ? '#00A89D' : '#6B7280',
                   }}>
                  {item.label}
                </a>
              ))}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100
                             hover:text-gray-700 transition-colors">
                  <Bell className="w-5 h-5" />
                  {unreadNotifications > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 rounded-full
                                     flex items-center justify-center text-white text-xs font-bold"
                          style={{ background: '#E8505B', fontSize: '9px' }}>
                      {unreadNotifications}
                    </span>
                  )}
                </button>

                {/* Notification dropdown */}
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl
                                  border border-gray-100 overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                      <span className="font-semibold text-gray-900 text-sm">Notifications</span>
                      {unreadNotifications > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                              style={{ background: '#FEF2F2', color: '#DC2626' }}>
                          {unreadNotifications} new
                        </span>
                      )}
                    </div>
                    {notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-gray-400 text-sm">
                        No notifications yet
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div key={n.id}
                             className="px-4 py-3 border-b border-gray-50 hover:bg-gray-50
                                        transition-colors cursor-pointer"
                             style={{ background: n.is_read ? 'white' : '#F2FAF9' }}>
                          <p className="text-sm font-medium text-gray-900">{n.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                          <p className="text-xs text-gray-400 mt-1">{formatDate(n.created_at)}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Profile */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl
                              bg-gray-50 border border-gray-200 cursor-pointer hover:bg-gray-100
                              transition-colors">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                     style={{ background: 'linear-gradient(135deg, #003C3A, #00A89D)' }}>
                  {profile?.full_name?.[0] || 'M'}
                </div>
                <div className="hidden sm:block">
                  <div className="text-xs font-semibold text-gray-900 leading-none">
                    {profile?.full_name || 'Member'}
                  </div>
                  <div className="text-xs text-gray-400 leading-none mt-0.5">
                    {profile?.member_id || ''}
                  </div>
                </div>
              </div>

              {/* Logout */}
              <button onClick={handleLogout}
                      className="p-2 rounded-lg text-gray-400 hover:text-red-500
                                 hover:bg-red-50 transition-colors">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Main Content ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Welcome Banner */}
        <div className="rounded-2xl p-6 mb-8 text-white relative overflow-hidden"
             style={{ background: 'linear-gradient(135deg, #003C3A 0%, #005C58 50%, #00A89D 100%)' }}>
          <div className="relative z-10">
            <p className="text-white/70 text-sm mb-1">Good day 👋</p>
            <h1 className="text-2xl font-bold mb-1">
              {profile?.full_name || 'Member'}
            </h1>
            <p className="text-white/60 text-sm">
              {profile?.plan_name || 'Essential Health'} · Member ID:{' '}
              <span className="font-mono text-white/90">{profile?.member_id || '—'}</span>
            </p>
          </div>
          <button
            onClick={() => router.push('/submit-claim')}
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                       text-sm font-semibold transition-all duration-200
                       hover:shadow-lg hover:-translate-y-0.5"
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', color: 'white' }}>
            <Plus className="w-4 h-4" />
            Submit New Claim
          </button>

          {/* Decorative circle */}
          <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full"
               style={{ background: 'rgba(0,212,200,0.1)' }} />
          <div className="absolute -right-4 -bottom-8 w-32 h-32 rounded-full"
               style={{ background: 'rgba(0,212,200,0.07)' }} />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Total Claims"
            value={totalClaims}
            sub="All time"
            icon={<FileText className="w-5 h-5" />}
            color="#2563EB"
          />
          <StatCard
            label="Pending"
            value={pendingClaims}
            sub="Awaiting decision"
            icon={<Clock className="w-5 h-5" />}
            color="#D97706"
          />
          <StatCard
            label="Approved"
            value={approvedClaims}
            sub="Successful claims"
            icon={<CheckCircle2 className="w-5 h-5" />}
            color="#059669"
          />
          <StatCard
            label="Total Paid"
            value={formatCurrency(totalPaid)}
            sub="Reimbursed to you"
            icon={<TrendingUp className="w-5 h-5" />}
            color="#00A89D"
          />
        </div>

        {/* Two column layout */}
        <div className="grid lg:grid-cols-3 gap-6">

          {/* Claims Table — 2/3 width */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Recent Claims</h2>
                <a href="/claims"
                   className="text-sm font-medium flex items-center gap-1 transition-colors hover:opacity-80"
                   style={{ color: '#00A89D' }}>
                  View all <ChevronRight className="w-4 h-4" />
                </a>
              </div>

              {claims.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                       style={{ background: '#F2FAF9' }}>
                    <FileText className="w-7 h-7" style={{ color: '#00A89D' }} />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">No claims yet</h3>
                  <p className="text-gray-500 text-sm mb-5">
                    Submit your first claim to get started
                  </p>
                  <button
                    onClick={() => router.push('/submit-claim')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                               text-white text-sm font-semibold transition-all hover:-translate-y-0.5"
                    style={{ background: 'linear-gradient(135deg, #003C3A, #00A89D)' }}>
                    <Plus className="w-4 h-4" />
                    Submit a claim
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {claims.map((claim) => {
                    const sc = statusConfig(claim.status)
                    return (
                      <div key={claim.id}
                           className="px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer
                                      flex items-center gap-4"
                           onClick={() => router.push(`/claims/${claim.id}`)}>
                        {/* Icon */}
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                             style={{ background: '#F2FAF9' }}>
                          <Stethoscope className="w-4 h-4" style={{ color: '#00A89D' }} />
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-gray-900 text-sm truncate">
                              {claim.provider_name}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                                  style={{ background: '#F2FAF9', color: '#00A89D' }}>
                              {claim.claim_type}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-400">
                            <span className="font-mono">{claim.claim_id}</span>
                            <span>·</span>
                            <span>{formatDate(claim.service_date)}</span>
                          </div>
                        </div>

                        {/* Amount + Status */}
                        <div className="text-right flex-shrink-0">
                          <div className="font-bold text-gray-900 text-sm mb-1.5">
                            {formatCurrency(claim.total_amount)}
                          </div>
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5
                                           rounded-full font-medium"
                                style={{ background: sc.bg, color: sc.color }}>
                            {sc.icon}
                            {claim.status}
                          </span>
                        </div>

                        <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar — 1/3 */}
          <div className="space-y-5">

            {/* Quick Actions */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-2">
                {[
                  {
                    icon: <Plus className="w-4 h-4" />,
                    label: 'Submit a Claim',
                    sub: 'Upload receipts & invoices',
                    href: '/submit-claim',
                    color: '#00A89D',
                  },
                  {
                    icon: <Eye className="w-4 h-4" />,
                    label: 'Check Benefits',
                    sub: 'Is my treatment covered?',
                    href: '/benefit-check',
                    color: '#2563EB',
                  },
                  {
                    icon: <FileText className="w-4 h-4" />,
                    label: 'View All Claims',
                    sub: 'Full claims history',
                    href: '/claims',
                    color: '#7C3AED',
                  },
                  {
                    icon: <User className="w-4 h-4" />,
                    label: 'My Profile',
                    sub: 'Update details & bank info',
                    href: '/profile',
                    color: '#D97706',
                  },
                ].map((action) => (
                  <a key={action.label} href={action.href}
                     className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50
                                transition-colors cursor-pointer group">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center
                                    flex-shrink-0 transition-colors"
                         style={{ background: action.color + '15', color: action.color }}>
                      {action.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">{action.label}</div>
                      <div className="text-xs text-gray-400 truncate">{action.sub}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500
                                             transition-colors flex-shrink-0" />
                  </a>
                ))}
              </div>
            </div>

            {/* Plan Info Card */}
            <div className="rounded-2xl p-5 text-white relative overflow-hidden"
                 style={{ background: 'linear-gradient(135deg, #003C3A, #005C58)' }}>
              <div className="relative z-10">
                <p className="text-white/60 text-xs uppercase tracking-widest mb-1">
                  Your Plan
                </p>
                <h4 className="font-bold text-lg mb-1">
                  {profile?.plan_name || 'Essential Health'}
                </h4>
                <p className="text-white/60 text-xs mb-4">Active · Renews annually</p>
                <a href="/benefit-check"
                   className="inline-flex items-center gap-1.5 text-xs font-semibold
                              px-3 py-1.5 rounded-lg transition-colors"
                   style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}>
                  <Eye className="w-3.5 h-3.5" />
                  Check coverage
                </a>
              </div>
              <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full"
                   style={{ background: 'rgba(0,212,200,0.12)' }} />
            </div>

          </div>
        </div>
      </main>
    </div>
  )
}
