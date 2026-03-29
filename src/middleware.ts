import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const isMock = !process.env.NEXT_PUBLIC_SUPABASE_URL

// Lightweight role map for mock mode (avoids importing the store in Edge runtime)
const MOCK_ROLE_MAP: Record<string, string> = {
  'a1b2c3d4-0001-4000-8000-000000000001': 'member',
  'a1b2c3d4-0002-4000-8000-000000000002': 'assessor',
  'a1b2c3d4-0003-4000-8000-000000000003': 'admin',
  'a1b2c3d4-0004-4000-8000-000000000004': 'fraud',
}

const publicRoutes = ['/login', '/register', '/forgot-password', '/api/auth/demo-setup']

function isPublicRoute(pathname: string) {
  return publicRoutes.some((r) => pathname.startsWith(r))
}

function redirectByRole(role: string, request: NextRequest) {
  const url = request.nextUrl.clone()
  if (role === 'assessor' || role === 'fraud') url.pathname = '/assessor-dashboard'
  else if (role === 'admin') url.pathname = '/analytics'
  else url.pathname = '/dashboard'
  return NextResponse.redirect(url)
}

async function handleMockMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const userId = request.cookies.get('mock-auth-user-id')?.value

  // Allow API routes through
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  if (!userId && !isPublicRoute(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (userId && isPublicRoute(pathname)) {
    const role = MOCK_ROLE_MAP[userId] || 'member'
    return redirectByRole(role, request)
  }

  return NextResponse.next()
}

export async function middleware(request: NextRequest) {
  if (isMock) {
    return handleMockMiddleware(request)
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  if (!user && !isPublicRoute(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isPublicRoute(pathname)) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role || 'member'
    return redirectByRole(role, request)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
