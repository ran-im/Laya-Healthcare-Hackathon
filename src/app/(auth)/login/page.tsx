'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Shield, AlertCircle, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (signInError) { setError('Invalid email or password. Please try again.'); return }
      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles').select('role').eq('id', data.user.id).single()
        const role = profile?.role || 'member'
        if (role === 'assessor' || role === 'fraud') router.push('/assessor-dashboard')
        else if (role === 'admin') router.push('/analytics')
        else router.push('/dashboard')
      }
    } catch { setError('Something went wrong. Please try again.')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Left Branding Panel ── */}
      <div style={{
        width: '50%',
        background: 'linear-gradient(135deg, #003C3A 0%, #005C58 55%, #00A89D 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '48px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative circles */}
        <div style={{
          position: 'absolute', top: '-60px', right: '-60px',
          width: '300px', height: '300px', borderRadius: '50%',
          background: 'rgba(0,212,200,0.08)',
        }} />
        <div style={{
          position: 'absolute', bottom: '-40px', left: '-40px',
          width: '200px', height: '200px', borderRadius: '50%',
          background: 'rgba(0,212,200,0.06)',
        }} />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px',
            background: 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Shield size={20} color="white" />
          </div>
          <div>
            <div style={{ color: 'white', fontWeight: 700, fontSize: '20px', lineHeight: 1 }}>laya</div>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase', marginTop: '2px' }}>healthcare</div>
          </div>
        </div>

        {/* Main copy */}
        <div style={{ position: 'relative' }}>
          <h1 style={{
            color: 'white', fontWeight: 800,
            fontSize: '42px', lineHeight: 1.15,
            marginBottom: '20px', margin: '0 0 20px 0',
          }}>
            AI-Powered<br />
            Claims Processing<br />
            <span style={{ color: '#00D4C8' }}>Made Simple.</span>
          </h1>
          <p style={{
            color: 'rgba(255,255,255,0.65)', fontSize: '17px',
            lineHeight: 1.6, maxWidth: '360px', margin: '0 0 40px 0',
          }}>
            Submit, track and manage your healthcare claims with intelligent automation
            — decisions in seconds, not days.
          </p>

          {/* Stats */}
          <div style={{ display: 'flex', gap: '40px' }}>
            {[
              { value: '94%',   label: 'Auto-approved' },
              { value: '<2min', label: 'Avg. decision' },
              { value: '700k+', label: 'Members' },
            ].map(stat => (
              <div key={stat.label}>
                <div style={{ color: 'white', fontWeight: 700, fontSize: '26px' }}>{stat.value}</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginTop: '4px' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ADE80' }} />
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
            Regulated by the Central Bank of Ireland · Part of AXA Group
          </p>
        </div>
      </div>

      {/* ── Right Form Panel ── */}
      <div style={{
        width: '50%',
        background: '#F8FAFB',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px',
        overflowY: 'auto',
      }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>

          {/* Header */}
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: 700, color: '#111827', margin: '0 0 8px 0' }}>
              Welcome back
            </h2>
            <p style={{ color: '#6B7280', fontSize: '15px', margin: 0 }}>
              Sign in to your Laya Healthcare account
            </p>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              marginBottom: '20px', display: 'flex', alignItems: 'flex-start', gap: '10px',
              padding: '14px 16px', background: '#FEF2F2',
              border: '1px solid #FECACA', borderRadius: '12px',
              color: '#DC2626', fontSize: '14px',
            }}>
              <AlertCircle size={16} style={{ marginTop: '1px', flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Email */}
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                Email address
              </label>
              <input
                type="email" value={email} required
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={{
                  width: '100%', padding: '12px 16px',
                  borderRadius: '12px', border: '1.5px solid #E5E7EB',
                  background: 'white', fontSize: '14px', color: '#111827',
                  outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = '#00A89D'}
                onBlur={e  => e.target.style.borderColor = '#E5E7EB'}
              />
            </div>

            {/* Password */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '14px', fontWeight: 500, color: '#374151' }}>Password</label>
                <a href="/forgot-password" style={{ fontSize: '13px', color: '#00A89D', fontWeight: 500, textDecoration: 'none' }}>
                  Forgot password?
                </a>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password} required
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%', padding: '12px 48px 12px 16px',
                    borderRadius: '12px', border: '1.5px solid #E5E7EB',
                    background: 'white', fontSize: '14px', color: '#111827',
                    outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s',
                  }}
                  onFocus={e => e.target.style.borderColor = '#00A89D'}
                  onBlur={e  => e.target.style.borderColor = '#E5E7EB'}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: '14px', top: '50%',
                    transform: 'translateY(-50%)', background: 'none',
                    border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: '4px',
                  }}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit button */}
            <button type="submit" disabled={loading}
              style={{
                width: '100%', padding: '13px',
                background: loading ? '#6EBFBA' : 'linear-gradient(135deg, #003C3A 0%, #00A89D 100%)',
                color: 'white', border: 'none', borderRadius: '12px',
                fontSize: '15px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                transition: 'opacity 0.2s',
              }}>
              {loading && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '24px 0' }}>
            <div style={{ flex: 1, height: '1px', background: '#E5E7EB' }} />
            <span style={{ color: '#9CA3AF', fontSize: '13px' }}>or</span>
            <div style={{ flex: 1, height: '1px', background: '#E5E7EB' }} />
          </div>

          {/* Register link */}
          <p style={{ textAlign: 'center', fontSize: '14px', color: '#6B7280', margin: '0 0 32px 0' }}>
            New to Laya Healthcare?{' '}
            <a href="/register" style={{ color: '#00A89D', fontWeight: 600, textDecoration: 'none' }}>
              Create an account
            </a>
          </p>

          {/* Demo box */}
          <div style={{
            padding: '16px', background: '#EFF6FF',
            border: '1px solid #BFDBFE', borderRadius: '12px',
          }}>
            <p style={{ fontSize: '12px', fontWeight: 700, color: '#1D4ED8', marginBottom: '10px', margin: '0 0 10px 0' }}>
              🧪 Demo accounts
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[
                { role: 'Member',   email: 'member@laya-demo.com' },
                { role: 'Assessor', email: 'assessor@laya-demo.com' },
                { role: 'Admin',    email: 'admin@laya-demo.com' },
              ].map(d => (
                <div key={d.role} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: '#1E40AF', fontWeight: 600 }}>{d.role}:</span>
                  <span style={{ color: '#3B82F6', fontFamily: 'monospace' }}>{d.email}</span>
                </div>
              ))}
              <p style={{ fontSize: '12px', color: '#60A5FA', marginTop: '4px', margin: '6px 0 0 0' }}>
                Password: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>Demo1234!</span>
              </p>
            </div>
          </div>

          {/* Legal */}
          <p style={{ marginTop: '24px', fontSize: '12px', color: '#9CA3AF', textAlign: 'center', lineHeight: 1.5 }}>
            By signing in, you agree to our{' '}
            <a href="/terms" style={{ textDecoration: 'underline' }}>Terms of Service</a> and{' '}
            <a href="/privacy" style={{ textDecoration: 'underline' }}>Privacy Policy</a>.
            Protected under GDPR.
          </p>
        </div>

        {/* spin animation */}
        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>
  )
}
