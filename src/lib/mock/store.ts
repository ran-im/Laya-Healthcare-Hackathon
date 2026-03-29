import {
  SEED_PROFILES,
  SEED_CLAIMS,
  SEED_DOCUMENTS,
  SEED_NOTIFICATIONS,
  DEMO_USERS,
} from './seed'

export interface MockStore {
  profiles: Record<string, unknown>[]
  claims: Record<string, unknown>[]
  claim_documents: Record<string, unknown>[]
  notifications: Record<string, unknown>[]
  claim_assessments: Record<string, unknown>[]
  // Auth users (separate from profiles)
  _users: { id: string; email: string; password: string; user_metadata: Record<string, unknown>; email_confirmed_at: string }[]
}

const STORAGE_KEY = 'laya-mock-store'

function createFreshStore(): MockStore {
  return {
    profiles: structuredClone(SEED_PROFILES),
    claims: structuredClone(SEED_CLAIMS),
    claim_documents: structuredClone(SEED_DOCUMENTS),
    notifications: structuredClone(SEED_NOTIFICATIONS),
    claim_assessments: [],
    _users: structuredClone(DEMO_USERS),
  }
}

// Server-side singleton
let serverStore: MockStore | null = null

function getServerStore(): MockStore {
  if (!serverStore) {
    serverStore = createFreshStore()
  }
  return serverStore
}

// Browser-side: persist to localStorage
function getBrowserStore(): MockStore {
  if (typeof window === 'undefined') return getServerStore()

  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      // Ensure _users always exists (may be missing in older stored data)
      if (!parsed._users) parsed._users = structuredClone(DEMO_USERS)
      return parsed
    }
  } catch {
    // corrupted data, reset
  }
  const fresh = createFreshStore()
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh))
  return fresh
}

function saveBrowserStore(store: MockStore) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // localStorage full or unavailable
  }
}

export function getStore(): MockStore {
  if (typeof window === 'undefined') return getServerStore()
  return getBrowserStore()
}

export function getTable(tableName: string): Record<string, unknown>[] {
  const store = getStore()
  const table = (store as Record<string, unknown>)[tableName]
  if (!Array.isArray(table)) return []
  return table
}

export function insertRow(tableName: string, row: Record<string, unknown>) {
  const store = getStore()
  const table = (store as Record<string, unknown>)[tableName]
  if (!Array.isArray(table)) return
  table.push(row)
  saveBrowserStore(store)
}

export function updateRows(
  tableName: string,
  updates: Record<string, unknown>,
  filterCol: string,
  filterVal: unknown
) {
  const store = getStore()
  const table = (store as Record<string, unknown>)[tableName]
  if (!Array.isArray(table)) return
  for (const row of table) {
    if (row[filterCol] === filterVal) {
      Object.assign(row, updates)
    }
  }
  saveBrowserStore(store)
}

export function upsertRow(tableName: string, row: Record<string, unknown>) {
  const store = getStore()
  const table = (store as Record<string, unknown>)[tableName]
  if (!Array.isArray(table)) return
  const idx = table.findIndex((r) => r.id === row.id)
  if (idx >= 0) {
    Object.assign(table[idx], row)
  } else {
    table.push(row)
  }
  saveBrowserStore(store)
}

export function getUsers() {
  return getStore()._users
}

export function addUser(user: MockStore['_users'][number]) {
  const store = getStore()
  store._users.push(user)
  saveBrowserStore(store)
}
