import { createBrowserClient } from '@supabase/ssr'
import { createMockClient } from '@/lib/mock/client'

export function createClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return createMockClient() as ReturnType<typeof createBrowserClient>
  }
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
