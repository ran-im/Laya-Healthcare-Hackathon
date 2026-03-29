import { getStore, addUser, upsertRow } from './store'

const AUTH_COOKIE = 'mock-auth-user-id'

interface AuthUser {
  id: string
  email: string
  user_metadata: Record<string, unknown>
  email_confirmed_at: string
  aud: string
  role: string
}

function findUserById(id: string) {
  return getStore()._users.find((u) => u.id === id)
}

function findUserByEmail(email: string) {
  return getStore()._users.find((u) => u.email === email)
}

function toAuthUser(u: { id: string; email: string; user_metadata: Record<string, unknown>; email_confirmed_at: string }): AuthUser {
  return {
    id: u.id,
    email: u.email,
    user_metadata: u.user_metadata,
    email_confirmed_at: u.email_confirmed_at,
    aud: 'authenticated',
    role: 'authenticated',
  }
}

function setSession(userId: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(AUTH_COOKIE, userId)
    document.cookie = `${AUTH_COOKIE}=${userId}; path=/; max-age=86400; SameSite=Lax`
  }
}

function clearSession() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(AUTH_COOKIE)
    document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0`
  }
}

function getSessionUserId(cookieGetter?: () => string | undefined): string | null {
  // Try cookie getter (server-side)
  if (cookieGetter) {
    const val = cookieGetter()
    if (val) return val
  }
  // Try localStorage (browser-side)
  if (typeof window !== 'undefined') {
    return localStorage.getItem(AUTH_COOKIE)
  }
  return null
}

export interface MockAuthOptions {
  cookieGetter?: () => string | undefined
}

export function createMockAuth(options?: MockAuthOptions) {
  const auth = {
    async getUser() {
      const userId = getSessionUserId(options?.cookieGetter)
      if (!userId) {
        return { data: { user: null }, error: null }
      }
      const u = findUserById(userId)
      if (!u) {
        return { data: { user: null }, error: null }
      }
      return { data: { user: toAuthUser(u) }, error: null }
    },

    async signInWithPassword({ email, password }: { email: string; password: string }) {
      const u = findUserByEmail(email)
      if (!u || u.password !== password) {
        return { data: { user: null, session: null }, error: { message: 'Invalid login credentials' } }
      }
      setSession(u.id)
      return {
        data: { user: toAuthUser(u), session: { access_token: 'mock-token', user: toAuthUser(u) } },
        error: null,
      }
    },

    async signUp({ email, password, options: signUpOptions }: {
      email: string
      password: string
      options?: { data?: Record<string, unknown> }
    }) {
      if (findUserByEmail(email)) {
        return { data: { user: null }, error: { message: 'User already registered' } }
      }
      const id = crypto.randomUUID()
      const newUser = {
        id,
        email,
        password,
        user_metadata: signUpOptions?.data || {},
        email_confirmed_at: new Date().toISOString(),
      }
      addUser(newUser)
      setSession(id)
      return { data: { user: toAuthUser(newUser) }, error: null }
    },

    async signOut() {
      clearSession()
      return { error: null }
    },

    async exchangeCodeForSession(_code: string) {
      return { data: { session: null }, error: null }
    },

    admin: {
      async createUser({ email, password, email_confirm, user_metadata }: {
        email: string
        password: string
        email_confirm?: boolean
        user_metadata?: Record<string, unknown>
      }) {
        const existing = findUserByEmail(email)
        if (existing) {
          return { data: { user: toAuthUser(existing) }, error: { message: 'User already registered' } }
        }
        const id = crypto.randomUUID()
        const newUser = {
          id,
          email,
          password,
          user_metadata: user_metadata || {},
          email_confirmed_at: email_confirm ? new Date().toISOString() : '',
        }
        addUser(newUser)
        return { data: { user: toAuthUser(newUser) }, error: null }
      },

      async listUsers() {
        const users = getStore()._users.map(toAuthUser)
        return { data: { users }, error: null }
      },
    },
  }

  return auth
}
