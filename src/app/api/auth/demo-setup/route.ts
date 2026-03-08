import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const demoUsers = [
    { email: 'member@laya-demo.com',    password: 'Demo1234!', full_name: 'Sarah Murphy',    role: 'member' },
    { email: 'assessor@laya-demo.com',  password: 'Demo1234!', full_name: 'James O Brien',   role: 'assessor' },
    { email: 'admin@laya-demo.com',     password: 'Demo1234!', full_name: 'Admin User',       role: 'admin' },
    { email: 'fraud@laya-demo.com',     password: 'Demo1234!', full_name: 'Fraud Analyst',    role: 'fraud' },
  ]

  const results = []
  for (const u of demoUsers) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { full_name: u.full_name, role: u.role }
    })
    if (error && !error.message.includes('already')) {
      results.push({ email: u.email, status: 'error', error: error.message })
    } else {
      if (data.user) {
        await supabase.from('profiles')
          .update({ role: u.role, full_name: u.full_name, plan_name: 'Premium Health' })
          .eq('id', data.user.id)
      }
      results.push({ email: u.email, status: 'ok' })
    }
  }

  return NextResponse.json({ results })
}
