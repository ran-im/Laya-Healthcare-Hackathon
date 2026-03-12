'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      supabase.from('profiles').select('*').eq('id', user.id).single()
        .then(({ data }) => setProfile(data))
    })
  }, [])

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/claims', label: 'My Claims' },
    { href: '/submit-claim', label: 'Submit Claim' },
    { href: '/benefit-check', label: 'Benefit Check' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFA' }}>
      {/* PERSISTENT NAV BAR */}
      <nav style={{
        background: 'white', borderBottom: '1px solid #E5E7EB',
        padding: '0 32px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', height: '64px',
        position: 'sticky', top: 0, zIndex: 50,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '32px', height: '32px', background: '#003C3A', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'white', fontSize: '14px', fontWeight: 800 }}>L</span>
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#003C3A', lineHeight: 1 }}>laya</div>
              <div style={{ fontSize: '9px', color: '#6B7280', letterSpacing: '0.1em', lineHeight: 1 }}>HEALTHCARE</div>
            </div>
          </div>

          {/* Nav Links */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {navLinks.map(link => {
              const active = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href))
              return (
                <a key={link.href} href={link.href} style={{
                  padding: '6px 14px', borderRadius: '8px', fontSize: '14px', fontWeight: active ? 600 : 400,
                  color: active ? '#00A89D' : '#374151', textDecoration: 'none',
                  background: active ? '#F2FAF9' : 'transparent',
                  transition: 'all 0.15s'
                }}>{link.label}</a>
              )
            })}
          </div>
        </div>

        {/* Right side — Profile + Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Notification bell */}
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#6B7280', padding: '4px' }}>🔔</button>

          {/* Profile pill */}
          {profile && (
            <a href="/profile" style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              background: '#F9FAFB', border: '1px solid #E5E7EB',
              borderRadius: '24px', padding: '4px 14px 4px 4px',
              textDecoration: 'none', cursor: 'pointer'
            }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: '#003C3A', display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: 'white', fontSize: '13px', fontWeight: 700
              }}>
                {profile.full_name?.charAt(0) || 'U'}
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827', lineHeight: 1.2 }}>{profile.full_name?.split(' ')[0]}</div>
                <div style={{ fontSize: '11px', color: '#00A89D', fontFamily: 'monospace', lineHeight: 1.2 }}>{profile.member_id}</div>
              </div>
            </a>
          )}

          {/* Logout */}
          <button onClick={logout} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#9CA3AF', padding: '4px' }} title="Sign out">⎋</button>
        </div>
      </nav>

      {/* PAGE CONTENT */}
      {children}
    </div>
  )
}
