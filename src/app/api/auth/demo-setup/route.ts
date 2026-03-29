import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createMockClient } from '@/lib/mock/client'

const isMock = !process.env.NEXT_PUBLIC_SUPABASE_URL

function getAdminClient() {
  if (isMock) return createMockClient()
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET() {
  if (isMock) {
    return NextResponse.json({
      success: true,
      message: 'Demo users pre-loaded in mock mode',
      results: [
        { email: 'member@laya-demo.com', status: 'exists' },
        { email: 'assessor@laya-demo.com', status: 'exists' },
        { email: 'admin@laya-demo.com', status: 'exists' },
        { email: 'fraud@laya-demo.com', status: 'exists' },
      ],
    })
  }

  const supabaseAdmin = getAdminClient()

  const demoUsers = [
    {
      email: 'member@laya-demo.com',
      password: 'Demo1234!',
      full_name: 'Sarah Murphy',
      role: 'member',
      plan_name: 'Premium Health',
    },
    {
      email: 'assessor@laya-demo.com',
      password: 'Demo1234!',
      full_name: 'James O\'Brien',
      role: 'assessor',
      plan_name: 'Staff',
    },
    {
      email: 'admin@laya-demo.com',
      password: 'Demo1234!',
      full_name: 'Admin User',
      role: 'admin',
      plan_name: 'Staff',
    },
    {
      email: 'fraud@laya-demo.com',
      password: 'Demo1234!',
      full_name: 'Fraud Analyst',
      role: 'fraud',
      plan_name: 'Staff',
    },
  ]

  const results = []

  for (const u of demoUsers) {
    try {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: {
          full_name: u.full_name,
          role: u.role,
        },
      })

      if (error) {
        if (error.message.toLowerCase().includes('already registered') ||
            error.message.toLowerCase().includes('already been registered') ||
            error.message.toLowerCase().includes('duplicate')) {
          const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
          const existing = (existingUsers as any)?.users?.find((usr: any) => usr.email === u.email)
          if (existing) {
            await supabaseAdmin
              .from('profiles')
              .upsert({
                id: existing.id,
                email: u.email,
                full_name: u.full_name,
                role: u.role,
                plan_name: u.plan_name,
              })
            results.push({ email: u.email, status: 'updated' })
          }
        } else {
          results.push({ email: u.email, status: 'error', message: error.message })
        }
      } else if (data.user) {
        await supabaseAdmin
          .from('profiles')
          .upsert({
            id: data.user.id,
            email: u.email,
            full_name: u.full_name,
            role: u.role,
            plan_name: u.plan_name,
          })
        results.push({ email: u.email, status: 'created' })
      }
    } catch (err) {
      results.push({ email: u.email, status: 'exception', message: String(err) })
    }
  }

  return NextResponse.json({
    success: true,
    message: 'Demo user setup complete',
    results,
  })
}
