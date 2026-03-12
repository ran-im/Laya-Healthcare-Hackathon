'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '', confirm: '' })
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)

  const C = { dark: '#003C3A', teal: '#00A89D', warm: '#F2FAF9' }

  const strength = form.password.length === 0 ? 0 : form.password.length < 6 ? 1 : form.password.length < 10 ? 2 : /[A-Z]/.test(form.password) && /[0-9]/.test(form.password) ? 4 : 3
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong']
  const strengthColor = ['', '#EF4444', '#F59E0B', '#10B981', '#059669']

  async function handleSubmit() {
    if (!agreed) { setError('Please accept the privacy policy'); return }
    if (form.password !== form.confirm) { setError('Passwords do not match'); return }
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true); setError('')
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: form.email, password: form.password,
        options: { data: { full_name: form.fullName, phone: form.phone } }
      })
      if (signUpError) throw signUpError
      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id, full_name: form.fullName, email: form.email,
          phone: form.phone, role: 'member', plan_name: 'Premium Health',
          member_id: 'LH-' + new Date().getFullYear() + '-' + Math.floor(10000 + Math.random() * 90000)
        })
        router.push('/dashboard')
      }
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex' }}>
      {/* Left brand panel */}
      <div style={{ width: '420px', background: `linear-gradient(160deg, ${C.dark} 0%, #005C58 50%, ${C.teal} 100%)`, padding: '48px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '48px' }}>
            <div style={{ width: '40px', height: '40px', background: 'rgba(255,255,255,0.15)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'white', fontSize: '20px' }}>🛡</span>
            </div>
            <div>
              <div style={{ color: 'white', fontWeight: 800, fontSize: '18px', lineHeight: 1 }}>laya</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '10px', letterSpacing: '0.15em' }}>HEALTHCARE</div>
            </div>
          </div>
          <h2 style={{ color: 'white', fontSize: '28px', fontWeight: 700, margin: '0 0 12px' }}>Join Laya Healthcare</h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '15px', lineHeight: 1.6 }}>Create your account to access your health insurance portal, submit claims and check your benefits.</p>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '12px', padding: '20px' }}>
          <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '13px', fontStyle: 'italic', margin: '0 0 8px' }}>"The claims portal has made it so much easier to manage my healthcare. Submitted a claim in under 5 minutes!"</p>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', margin: 0 }}>— Verified Laya Member</p>
        </div>
      </div>

      {/* Right form panel */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px', background: '#FAFAFA' }}>
        <div style={{ width: '100%', maxWidth: '440px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: C.dark, margin: '0 0 6px' }}>Create your account</h1>
          <p style={{ color: '#6B7280', fontSize: '14px', margin: '0 0 28px' }}>
            Already have an account?{' '}
            <a href="/login" style={{ color: C.teal, textDecoration: 'none', fontWeight: 600 }}>Sign in</a>
          </p>

          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', color: '#DC2626', fontSize: '14px' }}>
              ⚠ {error}
            </div>
          )}

          {/* Fields */}
          {[
            { label: 'Full name *', key: 'fullName', placeholder: 'Jane Smith', type: 'text' },
            { label: 'Email address *', key: 'email', placeholder: 'you@example.com', type: 'email' },
            { label: 'Phone number', key: 'phone', placeholder: '+353 87 000 0000', type: 'tel' },
          ].map(field => (
            <div key={field.key} style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>{field.label}</label>
              <input
                type={field.type}
                placeholder={field.placeholder}
                value={(form as any)[field.key]}
                onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #E5E7EB', fontSize: '14px', outline: 'none', boxSizing: 'border-box', background: 'white' }}
              />
            </div>
          ))}

          {/* Password */}
          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Password *</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="Min. 8 characters"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                style={{ width: '100%', padding: '10px 44px 10px 14px', borderRadius: '8px', border: '1.5px solid #E5E7EB', fontSize: '14px', outline: 'none', boxSizing: 'border-box', background: 'white' }}
              />
              <button onClick={() => setShowPass(s => !s)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: '16px' }}>
                {showPass ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          {/* Strength bar */}
          {form.password.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                {[1,2,3,4].map(i => (
                  <div key={i} style={{ flex: 1, height: '4px', borderRadius: '2px', background: i <= strength ? strengthColor[strength] : '#E5E7EB', transition: 'background 0.2s' }} />
                ))}
              </div>
              <div style={{ fontSize: '11px', color: strengthColor[strength] }}>{strengthLabel[strength]}</div>
            </div>
          )}

          {/* Confirm password */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Confirm password *</label>
            <input
              type="password"
              placeholder="••••••••"
              value={form.confirm}
              onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: `1.5px solid ${form.confirm && form.confirm !== form.password ? '#EF4444' : '#E5E7EB'}`, fontSize: '14px', outline: 'none', boxSizing: 'border-box', background: 'white' }}
            />
          </div>

          {/* Consent */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '24px' }}>
            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ marginTop: '2px', accentColor: C.teal }} />
            <label style={{ fontSize: '13px', color: '#6B7280', lineHeight: 1.5 }}>
              I confirm the information provided is correct and I consent to Laya Healthcare processing my personal data in accordance with our{' '}
              <a href="#" style={{ color: C.teal }}>Privacy Policy</a>.
            </label>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{ width: '100%', padding: '12px', borderRadius: '10px', background: loading ? '#9CA3AF' : `linear-gradient(135deg, ${C.dark}, ${C.teal})`, color: 'white', border: 'none', fontSize: '15px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Creating account...' : 'Create account →'}
          </button>
        </div>
      </div>
    </div>
  )
}
